'use strict';

const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const VISUAL_TYRE = {
  16: 'SOFT', 17: 'MEDIUM', 18: 'HARD', 7: 'INTER', 8: 'WET',
};
const ACTUAL_TYRE = {
  16: 'C5', 17: 'C4', 18: 'C3', 19: 'C2', 20: 'C1', 21: 'C0', 22: 'C6',
  7: 'INTER', 8: 'WET',
};

function compoundName(visual, actual) {
  return VISUAL_TYRE[visual] || ACTUAL_TYRE[actual] || 'UNKNOWN';
}

const NUM_CARS = 22;

class Recorder {
  constructor(dataDir) {
    this._dir = path.join(dataDir, 'recordings');
    if (!fs.existsSync(this._dir)) {
      fs.mkdirSync(this._dir, { recursive: true });
    }
    this._resetState();
  }

  _resetState() {
    this._session     = null;
    this._isRecording = false;
    this._frameCount  = 0;
    this._frameIdx    = 0;
    this._currentLap  = 0;
    this._lapStartFrameIdx = 0;
    this._lastLapNum  = 0;
    this._lastCompound = null;

    // Cached values from previous frame (for lap completion)
    this._prevS1        = 0;
    this._prevS2        = 0;
    this._prevLastLapMs = 0;
    this._prevTyreAge   = 0;
    this._prevCompound  = null;

    // Accumulators for the current lap
    this._lapThrottleSum = 0;
    this._lapBrakeSum    = 0;
    this._lapFrameCount  = 0;
    this._lapMaxSpeed    = 0;

    // Per-lap setup tracking
    this._lastSetupHash = null;
    this._lastSetupLap  = 0;

    // Multi-car tracking (all 22 cars)
    this._carLastLapNum   = new Array(NUM_CARS).fill(0);
    this._carLastCompound = new Array(NUM_CARS).fill(null);
    this._carBestLapMs    = new Array(NUM_CARS).fill(Infinity);
  }

  // ── Start a new session recording ──────────────────────────────────────────

  start(sessionInfo) {
    if (this._isRecording) this.stop();

    this._resetState();

    const id = uuidv4();
    this._session = {
      version:     2,
      id,
      startTime:   Date.now(),
      endTime:     null,
      track:       sessionInfo?.trackName       || 'Unknown',
      sessionType: sessionInfo?.sessionTypeName || 'Unknown',
      weather:     sessionInfo?.weatherName     || 'Unknown',
      setup:       null,
      lapSetups:   {},
      laps:        [],
      stints:      [],
      frames:      [],
      raceData: {
        participants: [],
        carLaps:   {},
        carStints: {},
      },
    };

    this._isRecording = true;

    console.log(`[Recorder] Started session ${id} — ${this._session.track} ${this._session.sessionType}`);
    return id;
  }

  // ── Stop and save ───────────────────────────────────────────────────────────

  stop() {
    if (!this._isRecording || !this._session) return null;

    this._session.endTime = Date.now();
    this._isRecording = false;

    const id = this._session.id;
    this._saveSession(this._session);

    console.log(`[Recorder] Stopped session ${id} (${this._session.laps.length} laps, ${this._frameCount} frames)`);
    this._session = null;
    return id;
  }

  // ── Get current in-progress session (for live view) ────────────────────────

  getCurrentSession() {
    if (!this._isRecording || !this._session) return null;
    return this._session;
  }

  // ── Save setup snapshot (with per-lap tracking) ────────────────────────────

  setSetup(setupData, currentLapNum) {
    if (!this._isRecording || !this._session || !setupData) return;

    // Always save the first setup as session default
    if (!this._session.setup) {
      this._session.setup = setupData;
    }

    // Per-lap setup tracking: save when setup changes
    const hash = JSON.stringify(setupData);
    if (hash !== this._lastSetupHash) {
      const lap = currentLapNum || this._currentLap || 1;
      this._session.lapSetups[lap] = setupData;
      this._lastSetupHash = hash;
      this._lastSetupLap  = lap;
      this._session.setup = setupData; // always keep latest as default
    }
  }

  // ── Save participants roster ───────────────────────────────────────────────

  setParticipants(participantsData) {
    if (!this._isRecording || !this._session || !participantsData) return;
    if (this._session.raceData.participants.length > 0) return; // already set

    const all = participantsData.allDrivers || participantsData.drivers || [];
    this._session.raceData.participants = all.map(d => ({
      name:       d.name || '',
      teamId:     d.teamId ?? 0,
      raceNumber: d.raceNumber ?? 0,
    }));
  }

  // ── Update session metadata if still Unknown ────────────────────────────────

  updateSessionInfo(sessionInfo) {
    if (!this._isRecording || !this._session || !sessionInfo) return;
    if (this._session.track === 'Unknown' && sessionInfo.trackName)
      this._session.track = sessionInfo.trackName;
    if (this._session.sessionType === 'Unknown' && sessionInfo.sessionTypeName)
      this._session.sessionType = sessionInfo.sessionTypeName;
    if (this._session.weather === 'Unknown' && sessionInfo.weatherName)
      this._session.weather = sessionInfo.weatherName;
  }

  // ── Overwrite lap data from authoritative SessionHistory packet ────────────

  updateFromHistory(historyData) {
    if (!this._isRecording || !this._session || !historyData) return;
    if (!historyData.laps || historyData.laps.length === 0) return;

    for (const hLap of historyData.laps) {
      if (!hLap.lapTimeInMS || hLap.lapTimeInMS === 0) continue;

      const existing = this._session.laps.find(l => l.lapNum === hLap.lapNum);
      if (existing) {
        existing.lapTimeMs = hLap.lapTimeInMS;
        existing.s1Ms      = hLap.sector1TimeInMS || 0;
        existing.s2Ms      = hLap.sector2TimeInMS || 0;
        existing.s3Ms      = hLap.sector3TimeInMS || 0;
        existing.valid     = hLap.lapValid;
      }
    }
  }

  // ── Track all 22 cars' lap completions (for race data) ─────────────────────

  updateAllCarsLapData(lapDataPacket, carStatusPacket) {
    if (!this._isRecording || !this._session) return;
    if (!lapDataPacket || !lapDataPacket.allCars) return;

    const allLaps   = lapDataPacket.allCars;
    const allStatus = carStatusPacket?.allCars || [];

    for (let i = 0; i < Math.min(allLaps.length, NUM_CARS); i++) {
      const car = allLaps[i];
      if (!car) continue;

      const lapNum = car.currentLapNum || 0;
      if (lapNum < 1 || lapNum > 200) continue;

      const prevLapNum = this._carLastLapNum[i];
      const status = allStatus[i];
      const compound = status
        ? compoundName(status.visualTyreCompound, status.actualTyreCompound)
        : (this._carLastCompound[i] || 'UNKNOWN');

      // Detect lap completion
      if (prevLapNum > 0 && lapNum > prevLapNum) {
        const lapTimeMs = car.lastLapTimeInMS || 0;
        const s1Ms = 0; // not available from live lapData for other cars on lap change
        const s2Ms = 0;
        const s3Ms = 0;

        if (!this._session.raceData.carLaps[i]) {
          this._session.raceData.carLaps[i] = [];
        }

        this._session.raceData.carLaps[i].push({
          lapNum:      prevLapNum,
          lapTimeMs,
          s1Ms, s2Ms, s3Ms,
          position:    car.carPosition || 0,
          compound,
          tyreAge:     status ? (status.tyresAgeLaps || 0) : 0,
          pitStatus:   car.pitStatus || 0,
          numPitStops: car.numPitStops || 0,
          valid:       !car.currentLapInvalid,
        });

        // Track best lap
        if (lapTimeMs > 0 && lapTimeMs < this._carBestLapMs[i]) {
          this._carBestLapMs[i] = lapTimeMs;
        }
      }

      // Detect stint change for this car
      if (status && this._carLastCompound[i] !== null && compound !== this._carLastCompound[i]) {
        if (!this._session.raceData.carStints[i]) {
          this._session.raceData.carStints[i] = [];
        }
        const stints = this._session.raceData.carStints[i];
        const startLap = stints.length > 0 ? stints[stints.length - 1].endLap + 1 : 1;
        stints.push({
          startLap,
          endLap:   lapNum - 1,
          compound: this._carLastCompound[i],
        });
      }

      this._carLastLapNum[i] = lapNum;
      if (status) this._carLastCompound[i] = compound;
    }
  }

  // ── Update all-car histories from SessionHistory packets ───────────────────

  updateCarHistory(carIdx, historyData) {
    if (!this._isRecording || !this._session || !historyData) return;
    if (!historyData.laps) return;

    if (!this._session.raceData.carLaps[carIdx]) {
      this._session.raceData.carLaps[carIdx] = [];
    }
    const existing = this._session.raceData.carLaps[carIdx];

    for (const hLap of historyData.laps) {
      if (!hLap.lapTimeInMS || hLap.lapTimeInMS === 0) continue;

      const found = existing.find(l => l.lapNum === hLap.lapNum);
      if (found) {
        // Overwrite with authoritative data
        found.lapTimeMs = hLap.lapTimeInMS;
        found.s1Ms = hLap.sector1TimeInMS || 0;
        found.s2Ms = hLap.sector2TimeInMS || 0;
        found.s3Ms = hLap.sector3TimeInMS || 0;
        found.valid = hLap.lapValid;
      }
    }
  }

  // ── Feed a telemetry frame (player car only) ──────────────────────────────

  addFrame(telemetry, lapData, carStatus, carDamage, motion, frameInterval) {
    if (!this._isRecording || !this._session) return;

    const interval = frameInterval || 3;

    // Always check for lap change (even if we skip this frame)
    if (lapData) {
      const lapNum = lapData.currentLapNum || 0;

      // Skip garbage lap numbers
      if (lapNum > 100 || lapNum < 0) {
        // Still do frame recording below, just skip lap logic
      } else {

        const currS1        = lapData.sector1TimeInMS || 0;
        const currS2        = lapData.sector2TimeInMS || 0;
        const currLastLapMs = lapData.lastLapTimeInMS || 0;
        const currCompound  = carStatus ? compoundName(carStatus.visualTyreCompound, carStatus.actualTyreCompound) : this._prevCompound;
        const currTyreAge   = carStatus ? (carStatus.tyresAgeLaps || 0) : this._prevTyreAge;

        if (lapNum > 0 && this._lastLapNum > 0 && lapNum !== this._lastLapNum) {
          const lastLapMs = currLastLapMs || this._prevLastLapMs;
          const s1        = this._prevS1;
          const s2        = this._prevS2;
          const lapValid  = !lapData.currentLapInvalid;
          const compound  = currCompound || 'UNKNOWN';
          const tyreAge   = currTyreAge;
          this._onLapComplete(this._lastLapNum, lastLapMs, s1, s2, lapValid, compound, tyreAge);
        }

        this._prevS1        = currS1;
        this._prevS2        = currS2;
        this._prevLastLapMs = currLastLapMs;
        if (carStatus) {
          this._prevCompound = currCompound;
          this._prevTyreAge  = currTyreAge;
        }

        this._lastLapNum = lapNum;
        this._currentLap = lapNum;

        // Check for stint change
        if (carStatus) {
          const cmp = compoundName(carStatus.visualTyreCompound, carStatus.actualTyreCompound);
          if (this._lastCompound !== null && cmp !== this._lastCompound) {
            const stintStart = this._session.stints.length > 0
              ? (this._session.stints[this._session.stints.length - 1].endLap + 1)
              : 1;
            this._session.stints.push({
              startLap: stintStart, endLap: lapNum - 1,
              compound: this._lastCompound, compoundName: this._lastCompound,
            });
          }
          this._lastCompound = cmp;
        }
      }
    }

    // Frame interval skip
    this._frameIdx++;
    if (this._frameIdx % interval !== 0) return;

    const car = telemetry?.playerData;
    if (!car) return;

    const lapD    = lapData   || {};
    const statD   = carStatus || {};
    const motionD = motion?.playerData || {};

    const throttle = car.throttle || 0;
    const brake    = car.brake    || 0;
    const speed    = car.speed    || 0;

    this._lapThrottleSum += throttle;
    this._lapBrakeSum    += brake;
    this._lapFrameCount++;
    if (speed > this._lapMaxSpeed) this._lapMaxSpeed = speed;

    const ersRaw = statD.ersStoreEnergy || 0;
    const ersPct = Math.round(Math.min(100, (ersRaw / 4000000) * 100));
    const fuel   = typeof statD.fuelInTank === 'number' ? +statD.fuelInTank.toFixed(1) : 0;

    this._session.frames.push({
      t:  lapD.currentLapTimeInMS || 0,
      s:  speed,
      th: Math.round(throttle * 100),
      br: Math.round(brake * 100),
      g:  car.gear || 0,
      r:  car.engineRPM || 0,
      d:  car.drs || 0,
      st: Math.round((car.steer || 0) * 100),
      ln: lapD.currentLapNum || this._currentLap || 1,
      p:  lapD.carPosition || 0,
      ts: car.tyresSurfaceTemperature || [0, 0, 0, 0],
      fl: fuel,
      er: ersPct,
      gL: +(motionD.gForceLateral     || 0).toFixed(2),
      gN: +(motionD.gForceLongitudinal || 0).toFixed(2),
    });
    this._frameCount++;
  }

  // ── Lap complete ────────────────────────────────────────────────────────────

  _onLapComplete(completedLapNum, lastLapMs, s1, s2, lapValid, compound, tyreAge) {
    if (!this._session) return;
    if (completedLapNum > 100 || completedLapNum < 1) return;

    const endFrameIdx = this._session.frames.length - 1;
    const s3 = (lastLapMs > 0 && s1 > 0 && s2 > 0) ? Math.max(0, lastLapMs - s1 - s2) : 0;

    const avgThrottle = this._lapFrameCount > 0
      ? +(this._lapThrottleSum / this._lapFrameCount).toFixed(2) : 0;
    const avgBrake = this._lapFrameCount > 0
      ? +(this._lapBrakeSum / this._lapFrameCount).toFixed(2) : 0;

    const lapEntry = {
      lapNum:        completedLapNum,
      lapTimeMs:     lastLapMs,
      s1Ms:          s1,
      s2Ms:          s2,
      s3Ms:          s3,
      valid:         lapValid,
      compound,
      tyreAge,
      maxSpeed:      this._lapMaxSpeed,
      avgThrottle,
      avgBrake,
      startFrameIdx: this._lapStartFrameIdx,
      endFrameIdx,
      setupLapRef:   this._lastSetupLap || null,
    };

    this._session.laps.push(lapEntry);
    this._lapStartFrameIdx = endFrameIdx + 1;
    this._resetLapAccumulators();

    console.log(`[Recorder] Lap ${completedLapNum} complete — ${this._fmtMs(lastLapMs)}`);
  }

  _resetLapAccumulators() {
    this._lapThrottleSum = 0;
    this._lapBrakeSum    = 0;
    this._lapFrameCount  = 0;
    this._lapMaxSpeed    = 0;
  }

  // ── Lap mutation methods (for context menu) ────────────────────────────────

  updateLap(sessionId, lapIdx, changes) {
    try {
      const session = this.get(sessionId);
      if (!session || !session.laps[lapIdx]) return false;

      if (changes.valid !== undefined) session.laps[lapIdx].valid = changes.valid;
      if (changes.notes !== undefined) session.laps[lapIdx].notes = changes.notes;

      this._saveSession(session);
      return true;
    } catch (err) {
      console.error('[Recorder] updateLap error:', err.message);
      return false;
    }
  }

  deleteLap(sessionId, lapIdx) {
    try {
      const session = this.get(sessionId);
      if (!session || !session.laps[lapIdx]) return false;

      session.laps[lapIdx].deleted = true;
      this._saveSession(session);
      return true;
    } catch (err) {
      console.error('[Recorder] deleteLap error:', err.message);
      return false;
    }
  }

  getLapFrames(sessionId, lapIdx) {
    try {
      const session = this.get(sessionId);
      if (!session || !session.laps[lapIdx]) return null;

      const lap = session.laps[lapIdx];
      const frames = session.frames.slice(lap.startFrameIdx, lap.endFrameIdx + 1);
      const setup = this._getSetupForLap(session, lap.lapNum);

      return { lap, frames, setup };
    } catch (err) {
      console.error('[Recorder] getLapFrames error:', err.message);
      return null;
    }
  }

  _getSetupForLap(session, lapNum) {
    if (!session.lapSetups || Object.keys(session.lapSetups).length === 0) {
      return session.setup || null;
    }
    // Find the setup that was active at this lap (highest lap key <= lapNum)
    const keys = Object.keys(session.lapSetups).map(Number).sort((a, b) => a - b);
    let setupKey = keys[0];
    for (const k of keys) {
      if (k <= lapNum) setupKey = k;
      else break;
    }
    return session.lapSetups[setupKey] || session.setup || null;
  }

  // ── Save to disk ────────────────────────────────────────────────────────────

  _saveSession(session) {
    try {
      const filePath = path.join(this._dir, `${session.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(session), 'utf8');
      console.log(`[Recorder] Saved to ${filePath}`);
    } catch (err) {
      console.error('[Recorder] Save failed:', err.message);
    }
  }

  // ── List sessions ───────────────────────────────────────────────────────────

  list() {
    try {
      const files = fs.readdirSync(this._dir).filter(f => f.endsWith('.json'));
      const summaries = [];

      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(this._dir, file), 'utf8');
          const s = JSON.parse(raw);

          const laps = (s.laps || []).filter(l => !l.deleted);
          const validLaps = laps.filter(l => l.valid && l.lapTimeMs > 0);
          const bestLapMs = validLaps.length > 0
            ? Math.min(...validLaps.map(l => l.lapTimeMs))
            : null;

          summaries.push({
            id:          s.id,
            startTime:   s.startTime,
            endTime:     s.endTime,
            track:       s.track,
            sessionType: s.sessionType,
            weather:     s.weather,
            lapCount:    laps.length,
            bestLapMs,
            duration:    s.endTime ? s.endTime - s.startTime : null,
            hasRaceData: !!(s.raceData && Object.keys(s.raceData.carLaps || {}).length > 0),
          });
        } catch (e) {
          // skip corrupt files
        }
      }

      summaries.sort((a, b) => b.startTime - a.startTime);
      return summaries;
    } catch (err) {
      console.error('[Recorder] list() error:', err.message);
      return [];
    }
  }

  // ── Get full session ────────────────────────────────────────────────────────

  get(id) {
    try {
      const filePath = path.join(this._dir, `${id}.json`);
      if (!fs.existsSync(filePath)) return null;
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error('[Recorder] get() error:', err.message);
      return null;
    }
  }

  // ── Delete session ──────────────────────────────────────────────────────────

  delete(id) {
    try {
      const filePath = path.join(this._dir, `${id}.json`);
      if (!fs.existsSync(filePath)) return false;
      fs.unlinkSync(filePath);
      return true;
    } catch (err) {
      console.error('[Recorder] delete() error:', err.message);
      return false;
    }
  }

  // ── Batch delete ────────────────────────────────────────────────────────────

  batchDelete(ids) {
    let deleted = 0;
    for (const id of ids) {
      if (this.delete(id)) deleted++;
    }
    return deleted;
  }

  // ── Status ──────────────────────────────────────────────────────────────────

  getStatus() {
    return {
      isRecording: this._isRecording,
      sessionId:   this._session?.id || null,
      lapCount:    this._session?.laps?.length || 0,
      frameCount:  this._frameCount,
      startTime:   this._session?.startTime || null,
      currentLap:  this._currentLap,
    };
  }

  // ── Utility ─────────────────────────────────────────────────────────────────

  _fmtMs(ms) {
    if (!ms) return '—';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const x = ms % 1000;
    return `${m}:${String(s).padStart(2,'0')}.${String(x).padStart(3,'0')}`;
  }
}

module.exports = Recorder;
