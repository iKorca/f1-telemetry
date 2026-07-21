'use strict';

const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Soft cap on per-session frame buffer so a multi-hour session doesn't balloon
// memory unchecked. 1h at 20 Hz ≈ 72k frames × ~260 bytes ≈ 18 MB. We keep
// 200k which is ~3h and trim the oldest quarter when we overflow — lap
// indices are adjusted in parallel so existing laps still point at the right
// frames.
const FRAME_CAP = 200_000;
const FRAME_TRIM = 50_000;

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
    this._prevLapTimeMs = null; // currentLapTimeInMS — for timer-reset detection

    // Accumulators for the current lap
    this._lapThrottleSum = 0;
    this._lapBrakeSum    = 0;
    this._lapFrameCount  = 0;
    this._lapMaxSpeed    = 0;

    // Pit tracking for out-lap / pit-lap detection
    this._wasInPit         = false; // Determined from actual telemetry on first frame
    this._pitEnteredThisLap = false;
    this._prevPitStatus    = -1; // -1 = unknown (first frame not yet seen)

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
      version:     3,
      id,
      startTime:   Date.now(),
      endTime:     null,
      track:       sessionInfo?.trackName       || 'Unknown',
      sessionType: sessionInfo?.sessionTypeName || 'Unknown',
      weather:     sessionInfo?.weatherName     || 'Unknown',
      sessionInfo: sessionInfo || null,
      setup:       null,
      lapSetups:   {},
      laps:        [],
      stints:      [],
      frames:      [],
      motionExFrames: [],
      events:      [],
      tyreSets:    {},  // keyed by carIdx
      timeTrial:   null,
      lapPositions: null,
      lobbyInfo:   null,
      finalClassification: null,
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

    // Finalize open stints for all cars
    this._finalizeStints();

    this._isRecording = false;

    const id = this._session.id;
    this._saveSession(this._session);

    console.log(`[Recorder] Stopped session ${id} (${this._session.laps.length} laps, ${this._frameCount} frames)`);
    this._session = null;
    return id;
  }

  // ── Save checkpoint (persist without stopping) ─────────────────────────────

  saveCheckpoint() {
    if (!this._isRecording || !this._session) return;
    this._saveSession(this._session);
    console.log(`[Recorder] Checkpoint saved — ${this._session.id} (${this._session.laps.length} laps, ${this._frameCount} frames)`);
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
    const all = participantsData.participants || [];
    if (all.length === 0) return;

    // Always update — participants may arrive after initial recording start
    this._session.raceData.participants = all.map(d => ({
      name:       d.name || '',
      teamId:     d.teamId ?? 255,
      raceNumber: d.raceNumber ?? 0,
    }));

    console.log(`[Recorder] Participants set: ${all.filter(d => d.name).length} drivers`);
  }

  // ── Update session metadata if still Unknown ────────────────────────────────

  updateSessionInfo(sessionInfo) {
    if (!this._isRecording || !this._session || !sessionInfo) return;
    // Always update — session type can change (e.g. Time Trial → Race if user switches)
    if (sessionInfo.trackName && sessionInfo.trackName !== 'Unknown')
      this._session.track = sessionInfo.trackName;
    if (sessionInfo.sessionTypeName && sessionInfo.sessionTypeName !== 'Unknown')
      this._session.sessionType = sessionInfo.sessionTypeName;
    if (sessionInfo.weatherName && sessionInfo.weatherName !== 'Unknown')
      this._session.weather = sessionInfo.weatherName;

    // Keep the latest full session snapshot so assists, game mode, rule set,
    // weather forecast, marshal zones, safety-car counters etc. are all saved.
    this._session.sessionInfo = sessionInfo;
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

  updateAllCarsLapData(lapDataPacket, carStatusPacket, sessionData) {
    if (!this._isRecording || !this._session) return;
    if (!lapDataPacket || !lapDataPacket.allCars) return;

    const allLaps   = lapDataPacket.allCars;
    const allStatus = carStatusPacket?.allCars || [];
    const safetyCarActive = sessionData?.safetyCarStatus > 0;

    for (let i = 0; i < Math.min(allLaps.length, NUM_CARS); i++) {
      const car = allLaps[i];
      if (!car) continue;

      // Skip retired/DNF drivers
      if (car.resultStatus >= 4) continue;

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
          safetyCar:   safetyCarActive || false,
        });

        // Track best lap
        if (lapTimeMs > 0 && lapTimeMs < this._carBestLapMs[i]) {
          this._carBestLapMs[i] = lapTimeMs;
        }
      }

      // Detect stint change for this car (skip UNKNOWN → real transitions)
      if (status && this._carLastCompound[i] !== null && this._carLastCompound[i] !== 'UNKNOWN' && compound !== this._carLastCompound[i]) {
        if (!this._session.raceData.carStints[i]) {
          this._session.raceData.carStints[i] = [];
        }
        const stints = this._session.raceData.carStints[i];
        const startLap = stints.length > 0 ? stints[stints.length - 1].endLap + 1 : 1;
        stints.push({
          startLap,
          endLap:   Math.max(lapNum - 1, startLap),
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

        // Timer-reset detection: Time-Trial "Start Flying Lap" teleports the
        // car with a fresh tank while the lap number stays the same; the only
        // reliable signal is currentLapTimeInMS snapping back to ~0. Treat the
        // next frame we push as the real lap start so fuel/throttle/brake/
        // max-speed aggregates don't include the warmup burn.
        if (this._prevLapTimeMs != null &&
            currLastLapMs === 0 && // no finished lap yet
            lapData.currentLapTimeInMS < 500 &&
            this._prevLapTimeMs > 2000) {
          this._lapStartFrameIdx = this._session.frames.length;
          this._resetLapAccumulators();
        }
        this._prevLapTimeMs = lapData.currentLapTimeInMS;

        // Track pit status for out-lap / pit-lap detection
        const pitStatus = lapData.pitStatus || 0;

        // First frame: detect whether car started in pit or on track
        if (this._prevPitStatus === -1) {
          this._prevPitStatus = pitStatus;
          if (pitStatus > 0) {
            // Car started in pit lane (normal garage exit)
            this._wasInPit = true;
          }
          // If pitStatus === 0, car started on track (flying start) — _wasInPit stays false
        } else {
          if (pitStatus > 0 && this._prevPitStatus === 0) {
            // Just entered pit lane
            this._pitEnteredThisLap = true;
          }
          if (pitStatus === 0 && this._prevPitStatus > 0) {
            // Just exited pit lane — detected by transition to 0.
            // Check speed to distinguish between real pit exit and flying start teleport.
            const speed = telemetry?.playerData?.speed || 0;
            if (speed < 100) {
              // Real pit exit: car is moving slowly off the limiter
              this._wasInPit = true;
            } else {
              // Flying start: car was teleported to track at high speed
              this._wasInPit = false;
            }
          }
          this._prevPitStatus = pitStatus;
        }

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

    // Skip frames when car is stationary in pit/garage (speed 0, not on track)
    // This prevents recording garage/pause menu frames
    const driverStatus = lapData?.driverStatus ?? 0;
    const carSpeed = car.speed || 0;
    if (carSpeed < 1 && driverStatus === 0) return; // 0 = In Garage

    const lapD    = lapData   || {};
    const statD   = carStatus || {};
    const motionD = motion?.playerData || {};
    const dmgD    = carDamage?.playerData || {};

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
      cl: car.clutch || 0,
      st: Math.round((car.steer || 0) * 100),
      ln: lapD.currentLapNum || this._currentLap || 1,
      p:  lapD.carPosition || 0,
      ts: car.tyresSurfaceTemperature || [0, 0, 0, 0],
      ti: car.tyresInnerTemperature   || [0, 0, 0, 0],
      bt: car.brakesTemperature       || [0, 0, 0, 0],
      tp: car.tyresPressure           || [0, 0, 0, 0],
      sf: car.surfaceType             || [0, 0, 0, 0],
      et: car.engineTemperature       || 0,
      tw: dmgD.tyresWear              || [0, 0, 0, 0],
      td: dmgD.tyresDamage            || [0, 0, 0, 0],
      bd: dmgD.brakesDamage           || [0, 0, 0, 0],
      wd: [dmgD.frontLeftWingDamage || 0, dmgD.frontRightWingDamage || 0, dmgD.rearWingDamage || 0],
      ed: dmgD.engineDamage || 0,
      gd: dmgD.gearBoxDamage || 0,
      ew: [
        dmgD.engineMGUHWear || 0, dmgD.engineESWear || 0, dmgD.engineCEWear || 0,
        dmgD.engineICEWear || 0, dmgD.engineMGUKWear || 0, dmgD.engineTCWear || 0,
      ],
      fl: fuel,
      fm: statD.fuelMix || 0,
      fr: +(statD.fuelRemainingLaps || 0).toFixed(2),
      er: ersPct,
      em: statD.ersDeployMode || 0,
      eh: +(statD.ersHarvestedThisLapMGUK || 0).toFixed(0),
      ep: +(statD.ersDeployedThisLap || 0).toFixed(0),
      da: statD.drsAllowed || 0,
      dd: statD.drsActivationDistance || 0,
      fb: statD.frontBrakeBias || 0,
      ta: statD.tyresAgeLaps || 0,
      vf: statD.vehicleFiaFlags || 0,
      pLap: lapD.lapDistance || 0,
      sec:  lapD.sector || 0,
      gL:   +(motionD.gForceLateral     || 0).toFixed(2),
      gN:   +(motionD.gForceLongitudinal || 0).toFixed(2),
      gV:   +(motionD.gForceVertical    || 0).toFixed(2),
      yaw:  +(motionD.yaw   || 0).toFixed(3),
      pit:  +(motionD.pitch || 0).toFixed(3),
      rol:  +(motionD.roll  || 0).toFixed(3),
      wpx:  +(motionD.worldPositionX || 0).toFixed(2),
      wpz:  +(motionD.worldPositionZ || 0).toFixed(2),
    });
    this._frameCount++;

    // Guard against unbounded growth on very long sessions.
    if (this._session.frames.length > FRAME_CAP) {
      this._trimFrameBuffer(FRAME_TRIM);
    }
  }

  // Drop the oldest `n` frames and shift every lap's startFrameIdx/endFrameIdx
  // so existing laps keep pointing at the right frames. Laps whose whole frame
  // range falls inside the dropped region become "frameless" (indices set to
  // null) — they'll still have lap-time + sector data but per-lap frame stats
  // won't be recomputable.
  _trimFrameBuffer(n) {
    if (!this._session) return;
    const frames = this._session.frames;
    if (frames.length <= n) return;
    const drop = Math.min(n, frames.length);
    frames.splice(0, drop);
    for (const lap of this._session.laps) {
      if (lap.startFrameIdx != null) lap.startFrameIdx -= drop;
      if (lap.endFrameIdx != null) lap.endFrameIdx -= drop;
      if (lap.endFrameIdx != null && lap.endFrameIdx < 0) {
        lap.startFrameIdx = null;
        lap.endFrameIdx = null;
      } else if (lap.startFrameIdx != null && lap.startFrameIdx < 0) {
        lap.startFrameIdx = 0;
      }
    }
    this._lapStartFrameIdx = Math.max(0, this._lapStartFrameIdx - drop);
    const mu = process.memoryUsage();
    console.log(`[Recorder] Trimmed ${drop} frames (buffer=${frames.length}). RSS=${(mu.rss / 1024 / 1024).toFixed(1)} MB heapUsed=${(mu.heapUsed / 1024 / 1024).toFixed(1)} MB`);
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

    // Detect out-laps and pit laps:
    // - Out-lap: lap after a pit stop (determined from actual pit status telemetry)
    // - Pit entry lap: car entered pit during this lap (pitStatus was > 0)
    const isOutLap = this._wasInPit;
    const isPitEntryLap = this._pitEnteredThisLap;

    // Mark as invalid if it's an out-lap or pit-entry lap with missing sectors
    const isIncomplete = isOutLap || isPitEntryLap;
    const effectiveValid = isIncomplete ? false : lapValid;

    // Snapshot ambient conditions at lap completion — lets the practice UI
    // show weather drift alongside lap-time evolution without having to scan
    // frames (which don't carry track/air temps).
    const si = this._session.sessionInfo || {};
    const lapEntry = {
      lapNum:        completedLapNum,
      lapTimeMs:     lastLapMs,
      s1Ms:          s1,
      s2Ms:          s2,
      s3Ms:          s3,
      valid:         effectiveValid,
      compound,
      tyreAge,
      maxSpeed:      this._lapMaxSpeed,
      avgThrottle,
      avgBrake,
      startFrameIdx: this._lapStartFrameIdx,
      endFrameIdx,
      setupLapRef:   this._lastSetupLap || null,
      isOutLap:      isOutLap || false,
      isPitLap:      isPitEntryLap || false,
      trackTemp:     si.trackTemperature != null ? si.trackTemperature : null,
      airTemp:       si.airTemperature != null ? si.airTemperature : null,
      weather:       si.weatherName || null,
    };

    this._session.laps.push(lapEntry);
    this._lapStartFrameIdx = endFrameIdx + 1;
    this._resetLapAccumulators();

    // Reset pit tracking for next lap
    this._wasInPit = false;
    this._pitEnteredThisLap = false;

    const tag = isOutLap ? ' [OUT LAP]' : isPitEntryLap ? ' [PIT LAP]' : '';
    console.log(`[Recorder] Lap ${completedLapNum} complete — ${this._fmtMs(lastLapMs)}${tag}`);

    // Auto-save checkpoint on every lap completion to ensure disk is always in-sync with memory
    this._saveSession(this._session);
  }

  // Finalize open stints for all cars (called on stop)
  _finalizeStints() {
    if (!this._session) return;
    const rd = this._session.raceData;

    // Finalize player stint
    if (this._lastCompound) {
      const lastStint = this._session.stints[this._session.stints.length - 1];
      const startLap = lastStint ? lastStint.endLap + 1 : 1;
      this._session.stints.push({
        startLap,
        endLap: this._currentLap || startLap,
        compound: this._lastCompound,
        compoundName: this._lastCompound,
      });
    }

    // Finalize all car stints
    for (let i = 0; i < NUM_CARS; i++) {
      const compound = this._carLastCompound[i];
      if (!compound || compound === 'UNKNOWN') continue;
      if (!rd.carStints[i]) rd.carStints[i] = [];
      const stints = rd.carStints[i];
      const lastStint = stints[stints.length - 1];
      const startLap = lastStint ? lastStint.endLap + 1 : 1;
      const laps = rd.carLaps[i] || [];
      const endLap = laps.length > 0 ? laps[laps.length - 1].lapNum : startLap;
      stints.push({ startLap, endLap, compound });
    }
  }

  _resetLapAccumulators() {
    this._lapThrottleSum = 0;
    this._lapBrakeSum    = 0;
    this._lapFrameCount  = 0;
    this._lapMaxSpeed    = 0;
  }

  // ── Event packets (SSTA, FTLP, PENA, SPTP, OVTK, SCAR, COLL, ...) ──────────

  recordEvent(eventData, header) {
    if (!this._isRecording || !this._session || !eventData) return;
    this._session.events.push({
      t:        header?.sessionTime ?? 0,
      frame:    header?.frameIdentifier ?? 0,
      code:     eventData.eventStringCode,
      name:     eventData.eventName,
      details:  eventData.details || {},
    });
  }

  // ── Per-car tyre set inventory (packet 12) ──────────────────────────────────

  setTyreSets(tyreSetsData) {
    if (!this._isRecording || !this._session || !tyreSetsData) return;
    this._session.tyreSets[tyreSetsData.carIdx] = {
      fittedIdx: tyreSetsData.fittedIdx,
      sets:      tyreSetsData.sets,
      updatedAt: Date.now(),
    };
  }

  // ── Time Trial best lap snapshot (packet 14) ────────────────────────────────

  setTimeTrial(timeTrialData) {
    if (!this._isRecording || !this._session || !timeTrialData) return;
    this._session.timeTrial = timeTrialData;
  }

  // ── Lap positions matrix (packet 15) ────────────────────────────────────────

  setLapPositions(lapPositionsData) {
    if (!this._isRecording || !this._session || !lapPositionsData) return;
    this._session.lapPositions = lapPositionsData;
  }

  // ── Lobby info (packet 9) ───────────────────────────────────────────────────

  setLobbyInfo(lobbyInfoData) {
    if (!this._isRecording || !this._session || !lobbyInfoData) return;
    this._session.lobbyInfo = lobbyInfoData;
  }

  // ── Final classification (packet 8) — called before stop() ──────────────────

  setFinalClassification(classificationData) {
    if (!this._isRecording || !this._session || !classificationData) return;
    this._session.finalClassification = classificationData;
  }

  // ── Motion Ex frame (suspension, wheel forces, chassis attitude) ────────────
  // These are high-rate — decimate at the same interval as telemetry frames.

  addMotionExFrame(motionEx) {
    if (!this._isRecording || !this._session || !motionEx) return;
    // Piggyback on _frameIdx so cadence matches addFrame().
    if (this._frameIdx % 3 !== 0) return;
    this._session.motionExFrames.push({
      // lap reference: matches the last recorded telemetry frame
      f:   this._frameCount,
      sp:  motionEx.suspensionPosition,
      sv:  motionEx.suspensionVelocity,
      sa:  motionEx.suspensionAcceleration,
      ws:  motionEx.wheelSpeed,
      sr:  motionEx.wheelSlipRatio,
      sag: motionEx.wheelSlipAngle,
      wlf: motionEx.wheelLatForce,
      wlg: motionEx.wheelLongForce,
      h:   motionEx.heightOfCOGAboveGround,
      lvx: motionEx.localVelocityX,
      lvy: motionEx.localVelocityY,
      lvz: motionEx.localVelocityZ,
      avx: motionEx.angularVelocityX,
      avy: motionEx.angularVelocityY,
      avz: motionEx.angularVelocityZ,
      aax: motionEx.angularAccelerationX,
      aay: motionEx.angularAccelerationY,
      aaz: motionEx.angularAccelerationZ,
      fwa: motionEx.frontWheelsAngle,
      wvf: motionEx.wheelVertForce,
      fah: motionEx.frontAeroHeight,
      rah: motionEx.rearAeroHeight,
      fra: motionEx.frontRollAngle,
      rra: motionEx.rearRollAngle,
      cy:  motionEx.chassisYaw,
      cp:  motionEx.chassisPitch,
    });
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
