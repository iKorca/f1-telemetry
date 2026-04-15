'use strict';

const express   = require('express');
const http      = require('http');
const WebSocket = require('ws');
const dgram     = require('dgram');
const path      = require('path');
const os        = require('os');

const { parsePacket, PACKET_IDS } = require('./f1-parser');
const Recorder      = require('./recorder');
const Settings      = require('./settings');
const TRACK_OUTLINES = require('./track-outlines');

// ─── Data directory ───────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, 'data');
const { mkdirSync, existsSync } = require('fs');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

// ─── Settings + Recorder ─────────────────────────────────────────────────────

const settings = new Settings(DATA_DIR);
const recorder = new Recorder(DATA_DIR);

let cfg = settings.get();

// ─── HTTP + WebSocket server ──────────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// ─── Telemetry state ──────────────────────────────────────────────────────────

const state = {
  telemetry:      null,
  lapData:        null,
  carStatus:      null,
  carSetups:      null,
  session:        null,
  participants:   null,
  carDamage:      null,
  motion:         null,
  sessionHistory: null,
};

let lastSessionUID = null;

// ─── Race Engineer live state (accumulated in-memory) ────────────────────────

const NUM_CARS = 22;

const VISUAL_TYRE = { 16: 'SOFT', 17: 'MEDIUM', 18: 'HARD', 7: 'INTER', 8: 'WET' };
const ACTUAL_TYRE_MAP = { 16: 'C5', 17: 'C4', 18: 'C3', 19: 'C2', 20: 'C1', 7: 'INTER', 8: 'WET' };

function tyreName(visual, actual) {
  return VISUAL_TYRE[visual] || ACTUAL_TYRE_MAP[actual] || 'UNKNOWN';
}

function makeRaceState() {
  return {
    active: false,
    cars: Array.from({ length: NUM_CARS }, () => ({
      name: '', teamId: 0, raceNumber: 0,
      position: 0, currentLap: 0,
      lastLapMs: 0, bestLapMs: 0,
      currentCompound: '', tyreAge: 0,
      stints: [],
      numPitStops: 0,
      gapToLeaderMs: 0, gapToAheadMs: 0,
      driverStatus: 0, resultStatus: 0,
      lapTimes: [],
    })),
  };
}

let raceState = makeRaceState();
let raceStateDirty = false;
let lastRaceBroadcast = 0;

function updateRaceState() {
  if (!state.lapData || !state.lapData.allCars) return;

  raceState.active = true;
  const allLaps   = state.lapData.allCars;
  const allStatus = state.carStatus?.allCars || [];
  const allParts  = state.participants?.allDrivers || state.participants?.drivers || [];

  for (let i = 0; i < Math.min(allLaps.length, NUM_CARS); i++) {
    const lap = allLaps[i];
    const st  = allStatus[i];
    const car = raceState.cars[i];

    // Participant info
    if (allParts[i]) {
      car.name       = allParts[i].name || '';
      car.teamId     = allParts[i].teamId ?? 0;
      car.raceNumber = allParts[i].raceNumber ?? 0;
    }

    if (!lap) continue;

    car.position      = lap.carPosition || 0;
    car.currentLap    = lap.currentLapNum || 0;
    car.gapToLeaderMs = lap.deltaToLeaderInMS || 0;
    car.gapToAheadMs  = lap.deltaToCarInFrontInMS || 0;
    car.driverStatus  = lap.driverStatus || 0;
    car.resultStatus  = lap.resultStatus || 0;
    car.numPitStops   = lap.numPitStops || 0;

    // Detect lap completion
    const lastLapMs = lap.lastLapTimeInMS || 0;
    if (lastLapMs > 0 && lastLapMs !== car.lastLapMs) {
      car.lastLapMs = lastLapMs;
      if (car.bestLapMs === 0 || lastLapMs < car.bestLapMs) {
        car.bestLapMs = lastLapMs;
      }
      car.lapTimes.push(lastLapMs);
    }

    // Tyre info
    if (st) {
      const compound = tyreName(st.visualTyreCompound, st.actualTyreCompound);
      car.tyreAge = st.tyresAgeLaps || 0;

      // Detect compound change
      if (car.currentCompound && compound !== car.currentCompound) {
        car.stints.push({
          compound: car.currentCompound,
          startLap: car.stints.length > 0
            ? car.stints[car.stints.length - 1].endLap + 1
            : 1,
          endLap: Math.max(car.currentLap - 1, 1),
        });
      }
      car.currentCompound = compound;
    }
  }

  raceStateDirty = true;
}

// Throttled broadcast of race state (every 2 seconds)
setInterval(() => {
  if (raceStateDirty && raceState.active) {
    broadcast('raceEngineer', raceState);
    raceStateDirty = false;
  }
}, 2000);

// ─── WebSocket ────────────────────────────────────────────────────────────────

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg, err => { /* ignore */ });
    }
  });
}

wss.on('connection', ws => {
  console.log('[WS] Browser connected');

  // Replay cached state
  const order = ['session', 'participants', 'carStatus', 'carSetups', 'lapData', 'telemetry', 'carDamage', 'motion', 'sessionHistory'];
  for (const key of order) {
    if (state[key]) {
      ws.send(JSON.stringify({ type: key, data: state[key] }));
    }
  }

  // Send recording status
  ws.send(JSON.stringify({ type: 'recStatus', data: recorder.getStatus() }));

  // Send race engineer state if active
  if (raceState.active) {
    ws.send(JSON.stringify({ type: 'raceEngineer', data: raceState }));
  }

  // Send tunnel status if active
  if (tunnelUrl) {
    ws.send(JSON.stringify({ type: 'tunnel', data: { url: tunnelUrl, active: true } }));
  }

  ws.on('close', () => console.log('[WS] Browser disconnected'));
});

// ─── REST API ─────────────────────────────────────────────────────────────────

// Settings
app.get('/api/settings', (req, res) => {
  res.json(settings.get());
});

app.post('/api/settings', (req, res) => {
  try {
    const updated = settings.update(req.body);
    cfg = updated;
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Recordings – list
app.get('/api/recordings', (req, res) => {
  res.json(recorder.list());
});

// Recordings – status
app.get('/api/recordings/status', (req, res) => {
  res.json(recorder.getStatus());
});

// Recordings – batch delete
app.post('/api/recordings/batch-delete', (req, res) => {
  const ids = req.body.ids;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
  const deleted = recorder.batchDelete(ids);
  res.json({ deleted });
});

// Recordings – get current in-progress session
app.get('/api/recordings/current', (req, res) => {
  const session = recorder.getCurrentSession();
  if (!session) return res.json(null);
  // Return a lightweight copy: laps + frames count + metadata (skip full frames for speed)
  const skipFrames = req.query.meta === '1';
  if (skipFrames) {
    const { frames, ...meta } = session;
    res.json({ ...meta, frameCount: frames.length });
  } else {
    res.json(session);
  }
});

// Recordings – get full session
app.get('/api/recordings/:id', (req, res) => {
  const session = recorder.get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Not found' });
  res.json(session);
});

// Recordings – get single lap frames (for cross-session comparison)
app.get('/api/recordings/:id/lap/:lapIdx', (req, res) => {
  const result = recorder.getLapFrames(req.params.id, parseInt(req.params.lapIdx, 10));
  if (!result) return res.status(404).json({ error: 'Not found' });
  res.json(result);
});

// Recordings – update lap (context menu mutations)
app.patch('/api/recordings/:id/lap/:lapIdx', (req, res) => {
  const ok = recorder.updateLap(req.params.id, parseInt(req.params.lapIdx, 10), req.body);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// Recordings – delete lap (mark as deleted)
app.delete('/api/recordings/:id/lap/:lapIdx', (req, res) => {
  const ok = recorder.deleteLap(req.params.id, parseInt(req.params.lapIdx, 10));
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// Recordings – delete session
app.delete('/api/recordings/:id', (req, res) => {
  const ok = recorder.delete(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

// Recordings – start
app.post('/api/recordings/start', (req, res) => {
  const id = recorder.start(state.session);
  // Feed participants immediately if available
  if (state.participants) recorder.setParticipants(state.participants);
  broadcast('recStatus', recorder.getStatus());
  res.json({ id });
});

// Recordings – stop
app.post('/api/recordings/stop', (req, res) => {
  const id = recorder.stop();
  broadcast('recStatus', recorder.getStatus());
  res.json({ id });
});

// Network info
app.get('/api/network', (req, res) => {
  const ips = getLocalIPs();
  res.json({
    ips,
    udpPort:  cfg.udpPort  || 20777,
    httpPort: cfg.httpPort || 3000,
    tunnelUrl: tunnelUrl || null,
    tunnelActive: !!tunnelUrl,
  });
});

// Track outlines — saved per trackId
const TRACKS_DIR = path.join(DATA_DIR, 'tracks');
if (!existsSync(TRACKS_DIR)) mkdirSync(TRACKS_DIR, { recursive: true });

app.get('/api/tracks/:trackId', (req, res) => {
  const trackId = req.params.trackId;
  const filePath = path.join(TRACKS_DIR, `${trackId}.json`);

  if (existsSync(filePath)) {
    try {
      const data = JSON.parse(require('fs').readFileSync(filePath, 'utf8'));
      return res.json(data);
    } catch (err) { /* fall through */ }
  }

  const prebuilt = TRACK_OUTLINES[parseInt(trackId, 10)];
  if (prebuilt) {
    return res.json({ points: prebuilt, prebuilt: true });
  }

  res.status(404).json({ error: 'No track data' });
});

app.post('/api/tracks/:trackId', (req, res) => {
  try {
    const filePath = path.join(TRACKS_DIR, `${req.params.trackId}.json`);
    const points = req.body.points;
    if (!Array.isArray(points) || points.length < 10) {
      return res.status(400).json({ error: 'Need at least 10 points' });
    }
    require('fs').writeFileSync(filePath, JSON.stringify({ points, savedAt: Date.now() }), 'utf8');
    res.json({ success: true, pointCount: points.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tunnel
app.get('/api/tunnel', (req, res) => {
  res.json({ url: tunnelUrl || null, active: !!tunnelUrl });
});

app.post('/api/tunnel/start', async (req, res) => {
  try {
    const subdomain = (req.body && req.body.subdomain) ? req.body.subdomain.trim() : '';
    await startTunnel(subdomain || undefined);
    res.json({ url: tunnelUrl, active: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tunnel/stop', async (req, res) => {
  await stopTunnel();
  res.json({ active: false });
});

// ─── Practice Lab API ────────────────────────────────────────────────────────

const PRACTICE_DIR = path.join(DATA_DIR, 'practice');
if (!existsSync(PRACTICE_DIR)) mkdirSync(PRACTICE_DIR, { recursive: true });

const { readFileSync, writeFileSync, readdirSync } = require('fs');

function loadPracticeWorkbook(trackName) {
  const file = path.join(PRACTICE_DIR, `${trackName.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
  if (existsSync(file)) {
    try { return JSON.parse(readFileSync(file, 'utf8')); }
    catch { return { trackName, runs: [], baselineRunId: null, lastUpdated: 0 }; }
  }
  return { trackName, runs: [], baselineRunId: null, lastUpdated: 0 };
}

function savePracticeWorkbook(wb) {
  const file = path.join(PRACTICE_DIR, `${wb.trackName.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
  wb.lastUpdated = Date.now();
  writeFileSync(file, JSON.stringify(wb, null, 2));
}

// List tracks with practice data
app.get('/api/practice', (req, res) => {
  try {
    const files = readdirSync(PRACTICE_DIR).filter(f => f.endsWith('.json'));
    const tracks = files.map(f => {
      try {
        const wb = JSON.parse(readFileSync(path.join(PRACTICE_DIR, f), 'utf8'));
        return { trackName: wb.trackName, runCount: wb.runs?.length || 0, lastUpdated: wb.lastUpdated || 0 };
      } catch { return null; }
    }).filter(Boolean);
    res.json(tracks);
  } catch { res.json([]); }
});

// Get workbook for a track
app.get('/api/practice/:track', (req, res) => {
  const wb = loadPracticeWorkbook(req.params.track);
  res.json(wb);
});

// Save workbook (full replace)
app.put('/api/practice/:track', (req, res) => {
  const wb = req.body;
  wb.trackName = req.params.track;
  savePracticeWorkbook(wb);
  res.json(wb);
});

// Add a run to a track workbook
app.post('/api/practice/:track/runs', (req, res) => {
  const wb = loadPracticeWorkbook(req.params.track);
  const run = req.body;
  // Avoid duplicates
  if (!wb.runs.find(r => r.id === run.id)) {
    wb.runs.push(run);
    savePracticeWorkbook(wb);
  }
  res.json(wb);
});

// Update a run (label, notes, pinned, condition)
app.patch('/api/practice/:track/runs/:runId', (req, res) => {
  const wb = loadPracticeWorkbook(req.params.track);
  const idx = wb.runs.findIndex(r => r.id === req.params.runId);
  if (idx >= 0) {
    Object.assign(wb.runs[idx], req.body);
    savePracticeWorkbook(wb);
  }
  res.json(wb);
});

// Delete a run
app.delete('/api/practice/:track/runs/:runId', (req, res) => {
  const wb = loadPracticeWorkbook(req.params.track);
  wb.runs = wb.runs.filter(r => r.id !== req.params.runId);
  savePracticeWorkbook(wb);
  res.json(wb);
});

// Auto-extract practice runs from a recording session
app.post('/api/practice/extract/:sessionId', (req, res) => {
  try {
    const session = recorder.getSessionById?.(req.params.sessionId)
      || JSON.parse(readFileSync(path.join(DATA_DIR, 'recordings', `${req.params.sessionId}.json`), 'utf8'));
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const runs = extractPracticeRuns(session);
    const trackName = session.track || 'Unknown';
    const wb = loadPracticeWorkbook(trackName);

    for (const run of runs) {
      if (!wb.runs.find(r => r.id === run.id)) {
        wb.runs.push(run);
      }
    }
    savePracticeWorkbook(wb);
    res.json({ trackName, runsAdded: runs.length, workbook: wb });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function extractPracticeRuns(session) {
  const laps = session.laps || [];
  if (laps.length === 0) return [];

  const runs = [];
  let currentRun = null;

  for (let i = 0; i < laps.length; i++) {
    const lap = laps[i];
    if (lap.deleted || lap.isOutLap || lap.isPitLap) {
      // End current run if exists
      if (currentRun && currentRun.lapIndices.length > 0) {
        finalizeRun(currentRun, laps, session);
        runs.push(currentRun);
        currentRun = null;
      }
      continue;
    }

    // Detect stint boundary: compound change or setup change
    const prevLap = i > 0 ? laps[i - 1] : null;
    const compoundChanged = prevLap && lap.compound !== prevLap.compound;
    const setupChanged = prevLap && lap.setupLapRef !== prevLap.setupLapRef;
    const isNewStint = !currentRun || compoundChanged || setupChanged;

    if (isNewStint) {
      if (currentRun && currentRun.lapIndices.length > 0) {
        finalizeRun(currentRun, laps, session);
        runs.push(currentRun);
      }

      const isWet = /rain|storm|wet|inter/i.test(session.weather || '') || /INTER|WET/i.test(lap.compound || '');

      currentRun = {
        id: `${session.id}_stint_${i}`,
        sessionId: session.id,
        timestamp: session.startTime + (lap.lapNum * 90000), // approx
        label: `${session.sessionType || 'Practice'} — ${lap.compound || 'Unknown'}`,
        condition: isWet ? 'wet' : 'dry',
        compound: lap.compound || 'Unknown',
        setup: null,
        weather: session.weather || '',
        notes: '',
        pinned: false,
        lapCount: 0,
        validLapCount: 0,
        bestLapMs: 0,
        avgLapMs: 0,
        bestS1Ms: 0,
        bestS2Ms: 0,
        bestS3Ms: 0,
        maxSpeed: 0,
        avgThrottle: 0,
        avgBrake: 0,
        consistency: 0,
        lapIndices: [],
      };

      // Resolve setup for this stint
      if (session.lapSetups) {
        const setupLaps = Object.keys(session.lapSetups).map(Number).sort((a, b) => a - b);
        const setupLap = setupLaps.filter(l => l <= lap.lapNum).pop();
        if (setupLap != null) currentRun.setup = session.lapSetups[setupLap];
      }
      if (!currentRun.setup && session.setup) currentRun.setup = session.setup;
    }

    currentRun.lapIndices.push(i);
  }

  if (currentRun && currentRun.lapIndices.length > 0) {
    finalizeRun(currentRun, laps, session);
    runs.push(currentRun);
  }

  return runs;
}

function finalizeRun(run, laps, session) {
  const validLaps = run.lapIndices
    .map(i => laps[i])
    .filter(l => l.valid !== false && l.lapTimeMs > 0);

  run.lapCount = run.lapIndices.length;
  run.validLapCount = validLaps.length;

  if (validLaps.length === 0) return;

  const times = validLaps.map(l => l.lapTimeMs);
  run.bestLapMs = Math.min(...times);
  run.avgLapMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

  run.bestS1Ms = Math.min(...validLaps.filter(l => l.s1Ms > 0).map(l => l.s1Ms)) || 0;
  run.bestS2Ms = Math.min(...validLaps.filter(l => l.s2Ms > 0).map(l => l.s2Ms)) || 0;
  run.bestS3Ms = Math.min(...validLaps.filter(l => l.s3Ms > 0).map(l => l.s3Ms)) || 0;
  run.maxSpeed = Math.max(...validLaps.map(l => l.maxSpeed || 0));
  run.avgThrottle = Math.round(validLaps.reduce((s, l) => s + (l.avgThrottle || 0), 0) / validLaps.length);
  run.avgBrake = Math.round(validLaps.reduce((s, l) => s + (l.avgBrake || 0), 0) / validLaps.length);

  // Consistency score (same formula as frontend)
  if (times.length >= 2) {
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const variance = times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length;
    const cv = (Math.sqrt(variance) / mean) * 100;
    run.consistency = Math.round(Math.max(0, Math.min(100, 100 - cv * 10)));
  } else {
    run.consistency = 100;
  }
}

// ─── Local IP helper ──────────────────────────────────────────────────────────

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
    }
  }
  return ips;
}

// ─── Localtunnel ─────────────────────────────────────────────────────────────

let tunnelInstance = null;
let tunnelUrl      = null;

async function startTunnel(subdomain) {
  if (tunnelInstance) await stopTunnel();

  const localtunnel = require('localtunnel');
  const port = cfg.httpPort || 3000;
  const opts = { port };
  if (subdomain) opts.subdomain = subdomain;

  tunnelInstance = await localtunnel(opts);
  tunnelUrl = tunnelInstance.url;

  tunnelInstance.on('close', () => {
    console.log('[Tunnel] Closed');
    tunnelUrl = null;
    tunnelInstance = null;
    broadcast('tunnel', { url: null, active: false });
  });

  tunnelInstance.on('error', err => {
    console.error('[Tunnel] Error:', err.message);
    tunnelUrl = null;
    tunnelInstance = null;
    broadcast('tunnel', { url: null, active: false });
  });

  console.log(`[Tunnel] Started: ${tunnelUrl}`);
  broadcast('tunnel', { url: tunnelUrl, active: true });
  return tunnelUrl;
}

async function stopTunnel() {
  if (tunnelInstance) {
    try { tunnelInstance.close(); } catch (_) { /* ignore */ }
    tunnelInstance = null;
  }
  tunnelUrl = null;
  broadcast('tunnel', { url: null, active: false });
}

// ─── UDP listener ─────────────────────────────────────────────────────────────

const udp = dgram.createSocket({ type: 'udp4', reuseAddr: true });

let packetCount = 0;

udp.on('message', msg => {
  const packet = parsePacket(msg);
  if (!packet) return;

  packetCount++;
  if (packetCount % 1000 === 0) {
    console.log(`[UDP] ${packetCount} packets processed`);
  }

  switch (packet.type) {

    case PACKET_IDS.MOTION:
      state.motion = packet.data;
      broadcast('motion', packet.data);
      break;

    case PACKET_IDS.SESSION: {
      const newUID = packet.header.sessionUID;
      state.session = packet.data;
      broadcast('session', packet.data);

      // Update recording session info if still Unknown
      if (recorder.getStatus().isRecording) {
        recorder.updateSessionInfo(packet.data);
      }

      // Auto-manage recording on session change
      if (newUID !== lastSessionUID && newUID !== '0') {
        // New session detected — if already recording, stop the old one first
        if (recorder.getStatus().isRecording) {
          console.log(`[Session] Session changed (${lastSessionUID} → ${newUID}), stopping old recording`);
          recorder.stop();
          broadcast('recStatus', recorder.getStatus());
        }

        // Auto-start new recording if enabled
        if (cfg.recording?.autoRecord) {
          recorder.start(packet.data);
          if (state.participants) recorder.setParticipants(state.participants);
          broadcast('recStatus', recorder.getStatus());
        }

        raceState = makeRaceState();
        lastSessionUID = newUID;
      }
      break;
    }

    case PACKET_IDS.LAP_DATA:
      state.lapData = packet.data;
      broadcast('lapData', packet.data);

      // Update race engineer state
      updateRaceState();

      // Feed all-car lap data to recorder
      if (recorder.getStatus().isRecording) {
        recorder.updateAllCarsLapData(packet.data, state.carStatus, state.session);
      }
      break;

    case PACKET_IDS.PARTICIPANTS:
      state.participants = packet.data;
      broadcast('participants', packet.data);

      // Feed participants to recorder
      if (recorder.getStatus().isRecording) {
        recorder.setParticipants(packet.data);
      }
      break;

    case PACKET_IDS.CAR_TELEMETRY:
      state.telemetry = packet.data;
      broadcast('telemetry', packet.data);

      // Feed recorder on every telemetry packet (player frames)
      if (recorder.getStatus().isRecording && cfg.recording?.captureFrames) {
        recorder.addFrame(
          state.telemetry,
          state.lapData?.playerData,
          state.carStatus?.playerData,
          state.carDamage,
          state.motion,
          cfg.recording?.frameInterval || 3,
        );
      }
      break;

    case PACKET_IDS.CAR_STATUS:
      state.carStatus = packet.data;
      broadcast('carStatus', packet.data);
      break;

    case PACKET_IDS.CAR_SETUPS:
      state.carSetups = packet.data;
      broadcast('carSetups', packet.data);
      // Save setup with recording (with current lap number for per-lap tracking)
      if (recorder.getStatus().isRecording && packet.data.playerData) {
        const currentLap = state.lapData?.playerData?.currentLapNum || 0;
        recorder.setSetup(packet.data.playerData, currentLap);
      }
      break;

    case PACKET_IDS.CAR_DAMAGE:
      state.carDamage = packet.data;
      broadcast('carDamage', packet.data);
      break;

    case PACKET_IDS.SESSION_HISTORY:
      if (packet.data) {
        const carIdx = packet.data.carIdx;
        const playerIdx = packet.header.playerCarIndex;

        // Store all cars' session histories
        if (!state.allSessionHistories) state.allSessionHistories = {};
        state.allSessionHistories[carIdx] = packet.data;

        // Broadcast player's history for dashboard
        if (carIdx === playerIdx) {
          state.sessionHistory = packet.data;
          broadcast('sessionHistory', packet.data);
        }

        // Feed authoritative lap data to recorder
        if (recorder.getStatus().isRecording) {
          if (carIdx === playerIdx) {
            recorder.updateFromHistory(packet.data);
          }
          recorder.updateCarHistory(carIdx, packet.data);
        }
      }
      break;

    case PACKET_IDS.FINAL_CLASSIFICATION:
      // Race/session ended — auto-save recording immediately
      if (recorder.getStatus().isRecording) {
        console.log('[Session] Final classification received — auto-saving recording');
        recorder.stop();
        broadcast('recStatus', recorder.getStatus());
      }
      break;
  }
});

udp.on('error', err => {
  console.error('[UDP] Error:', err.message);
});

udp.on('listening', () => {
  const { address, port } = udp.address();
  console.log(`[UDP] Listening on ${address}:${port}`);
});

const UDP_PORT  = cfg.udpPort  || 20777;
const HTTP_PORT = process.env.PORT || cfg.httpPort || 3000;

udp.bind(UDP_PORT);

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(HTTP_PORT, () => {
  const ips = getLocalIPs();
  console.log('\n  F1 25 Telemetry Dashboard v3');
  console.log('  ────────────────────────────');
  console.log(`  Local:  http://localhost:${HTTP_PORT}`);
  ips.forEach(({ address }) => {
    console.log(`  Network: http://${address}:${HTTP_PORT}`);
  });
  console.log(`  UDP:    port ${UDP_PORT}`);
  console.log('');
});
