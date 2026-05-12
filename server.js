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
const analysis      = require('./server/analysis');

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
  telemetry:           null,
  lapData:             null,
  carStatus:           null,
  carSetups:           null,
  session:             null,
  participants:        null,
  carDamage:           null,
  motion:              null,
  motionEx:            null,
  sessionHistory:      null,
  lobbyInfo:           null,
  timeTrial:           null,
  lapPositions:        null,
  finalClassification: null,
  tyreSets:            {}, // keyed by carIdx (one packet per car)
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
      // Server-only: tracks the pit-stop count from the *previous* packet so
      // we can detect pit-onto-same-compound (medium → fresh medium) — the
      // visual-compound check alone misses those, collapsing the stint bar.
      _prevNumPitStops: 0,
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
  // The parser exposes `participants` on ParticipantsData; the two older
  // aliases are left in for backwards compatibility with any mock data.
  const allParts  = state.participants?.participants
    || state.participants?.allDrivers
    || state.participants?.drivers
    || [];

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
    const newNumPitStops = lap.numPitStops || 0;
    car.numPitStops   = newNumPitStops;

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

      const prev = car.currentCompound;
      const valid = (c) => c && c !== 'UNKNOWN';

      // Two ways a stint ends:
      //   1. Compound CHANGED (medium → hard) — visual-compound diff.
      //   2. Pit stop onto the SAME compound (medium → fresh medium).
      //      Without this branch the bar collapses into a single segment
      //      that misrepresents tyre age, since `prev === compound`.
      const compoundChanged = valid(prev) && prev !== compound;
      const pittedSameCompound =
        newNumPitStops > car._prevNumPitStops && valid(prev) && prev === compound;

      // Don't write stints from formation-lap / grid-procedure packets.
      // The F1 game often flickers visualTyreCompound between SOFT and the
      // actual race compound during the grid procedure, when currentLap is
      // still 0 or 1. Without this guard we'd land a 1-lap phantom SOFT
      // segment at L1 on every driver's stint bar.
      const raceStarted = car.currentLap >= 2;

      if ((compoundChanged || pittedSameCompound) && raceStarted) {
        car.stints.push({
          compound: prev,
          startLap: car.stints.length > 0
            ? car.stints[car.stints.length - 1].endLap + 1
            : 1,
          endLap: Math.max(car.currentLap - 1, 1),
        });
      }
      car.currentCompound = compound;
    }

    car._prevNumPitStops = newNumPitStops;
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
  const order = [
    'session', 'participants', 'carStatus', 'carSetups', 'lapData', 'telemetry',
    'carDamage', 'motion', 'motionEx', 'sessionHistory', 'lobbyInfo',
    'timeTrial', 'lapPositions', 'finalClassification',
  ];
  for (const key of order) {
    if (state[key]) {
      ws.send(JSON.stringify({ type: key, data: state[key] }));
    }
  }
  // Replay per-car tyre sets
  if (state.tyreSets && Object.keys(state.tyreSets).length > 0) {
    for (const carIdx of Object.keys(state.tyreSets)) {
      ws.send(JSON.stringify({ type: 'tyreSets', data: state.tyreSets[carIdx] }));
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

// ── Manual stint split / merge ─────────────────────────────────────────────
// Recompute per-run aggregates from an already-finalized laps[] array. Used
// by the split/merge endpoints below — lets the workbook re-normalise without
// needing access to the original session recording.
// `recomputeRunAggregates` lives in `./server/analysis.js` so the live
// finalize path and the split/merge endpoints share one source of truth.
// The previous in-file copy stopped at degradation and silently dropped
// engine + tyre-temp aggregates, so a manual run split wiped fields that
// StintComparison.tsx reads — leaving the UI showing em-dash for laps
// whose data was actually present.
const { recomputeRunAggregates } = analysis;

app.post('/api/practice/:track/runs/:runId/split', (req, res) => {
  const wb = loadPracticeWorkbook(req.params.track);
  const idx = wb.runs.findIndex(r => r.id === req.params.runId);
  if (idx < 0) return res.status(404).json({ error: 'Run not found' });
  const run = wb.runs[idx];
  const atLap = parseInt(req.body?.atLap, 10);
  if (!Number.isFinite(atLap)) return res.status(400).json({ error: 'atLap required' });

  const before = (run.laps || []).filter(l => l.lapNum < atLap);
  const after  = (run.laps || []).filter(l => l.lapNum >= atLap);
  if (before.length === 0 || after.length === 0) {
    return res.status(400).json({ error: 'Split lap falls outside the run' });
  }

  const baseLabel = run.label || run.compound || 'STINT';
  const partA = { ...run, id: `${run.id}_a`, label: `${baseLabel} (1)`, laps: before };
  const partB = { ...run, id: `${run.id}_b`, label: `${baseLabel} (2)`, laps: after };
  recomputeRunAggregates(partA);
  recomputeRunAggregates(partB);

  wb.runs.splice(idx, 1, partA, partB);
  savePracticeWorkbook(wb);
  res.json(wb);
});

app.post('/api/practice/:track/runs/:runId/merge', (req, res) => {
  const wb = loadPracticeWorkbook(req.params.track);
  const primary = wb.runs.find(r => r.id === req.params.runId);
  const otherId = req.body?.withRunId;
  const other = wb.runs.find(r => r.id === otherId);
  if (!primary || !other) return res.status(404).json({ error: 'Run(s) not found' });
  if (primary.id === other.id) return res.status(400).json({ error: 'Cannot merge a run with itself' });

  // Merge: keep primary's id, compound, setup, etc. Concatenate laps
  // (sorted by lapNum), concatenate lapIndices.
  const mergedLaps = [...(primary.laps || []), ...(other.laps || [])]
    .sort((a, b) => a.lapNum - b.lapNum);
  const mergedIndices = [...(primary.lapIndices || []), ...(other.lapIndices || [])]
    .sort((a, b) => a - b);
  primary.laps = mergedLaps;
  primary.lapIndices = mergedIndices;
  primary.label = `${primary.label || primary.compound} + ${other.label || other.compound}`;
  recomputeRunAggregates(primary);

  wb.runs = wb.runs.filter(r => r.id !== other.id);
  savePracticeWorkbook(wb);
  res.json(wb);
});

// Update a lap's metadata (flag / notes / valid). The workbook is the source
// of truth for these — the downstream session JSON is untouched. We re-compute
// the traffic-lap best-lap roll-up if the valid flag changed.
app.patch('/api/practice/:track/runs/:runId/laps/:lapNum', (req, res) => {
  const wb = loadPracticeWorkbook(req.params.track);
  const run = wb.runs.find(r => r.id === req.params.runId);
  if (!run || !run.laps) return res.status(404).json({ error: 'Run not found' });
  const lapNum = parseInt(req.params.lapNum, 10);
  const lap = run.laps.find(l => l.lapNum === lapNum);
  if (!lap) return res.status(404).json({ error: 'Lap not found' });

  const { flag, notes, valid } = req.body || {};
  if (flag !== undefined) lap.flag = flag || null;
  if (notes !== undefined) lap.notes = String(notes || '').slice(0, 500);
  if (valid !== undefined) lap.valid = !!valid;

  // Recompute headline stats if the valid flag moved, so the sidebar "BEST"
  // stays in sync with manually-invalidated laps.
  if (valid !== undefined) {
    const cleanLaps = run.laps.filter(l => l.valid && !l.trafficLap && l.lapTimeMs > 0);
    if (cleanLaps.length > 0) {
      const times = cleanLaps.map(l => l.lapTimeMs);
      run.bestLapMs = Math.min(...times);
      run.avgLapMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      run.validLapCount = cleanLaps.length;
    }
  }

  savePracticeWorkbook(wb);
  res.json(run);
});

// Export a single run as CSV (one row per lap) or JSON (full run record).
// Query: ?format=csv (default) | json
app.get('/api/practice/:track/runs/:runId/export', (req, res) => {
  const wb = loadPracticeWorkbook(req.params.track);
  const run = wb.runs.find(r => r.id === req.params.runId);
  if (!run) return res.status(404).json({ error: 'Run not found' });

  const format = (req.query.format || 'csv').toString().toLowerCase();
  const safeName = (run.label || run.compound || 'stint').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${req.params.track.replace(/[^a-zA-Z0-9_-]/g, '_')}_${safeName}_${run.id.slice(0, 8)}.${format}`;

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(run, null, 2));
  }

  // CSV — one row per lap. Columns are flattened so the file opens cleanly in
  // MoTeC i2, Excel, numbers, etc.
  const header = [
    'lapNum', 'lapTimeMs', 's1Ms', 's2Ms', 's3Ms',
    'maxSpeed', 'avgThrottle', 'avgBrake', 'tyreAge',
    'fuel', 'valid', 'isOutLap', 'isPitLap', 'trafficLap', 'flag',
    'tyreWear_RL', 'tyreWear_RR', 'tyreWear_FL', 'tyreWear_FR',
    'surfTemp_RL', 'surfTemp_RR', 'surfTemp_FL', 'surfTemp_FR',
    'innerTemp_RL', 'innerTemp_RR', 'innerTemp_FL', 'innerTemp_FR',
    'engineTemp', 'notes',
  ];
  const rows = [header.join(',')];
  for (const l of (run.laps || [])) {
    const row = [
      l.lapNum, l.lapTimeMs, l.s1Ms, l.s2Ms, l.s3Ms,
      l.maxSpeed, l.avgThrottle, l.avgBrake, l.tyreAge,
      l.fuel, l.valid, !!l.isOutLap, !!l.isPitLap, !!l.trafficLap, l.flag || '',
      ...(l.tyreWear || [0, 0, 0, 0]),
      ...(l.avgSurfaceTemp || [0, 0, 0, 0]),
      ...(l.avgInnerTemp || [0, 0, 0, 0]),
      l.avgEngineTemp || 0,
      // Notes quoting: wrap in "" and escape embedded quotes
      `"${(l.notes || '').replace(/"/g, '""')}"`,
    ];
    rows.push(row.join(','));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(rows.join('\n'));
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
    if (lap.deleted || lap.isPitLap) {
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
        avgFuelPerLap: 0,
        maxFuelPerLap: 0,
        avgDegradationMs: 0,
        maxDegradationMs: 0,
        tyreWearEnd: [0, 0, 0, 0],
        avgTyreWear: 0,
        maxTyreWear: 0,
        avgEngineTemp: 0,
        maxEngineTemp: 0,
        avgTyreSurfaceTemp: [0, 0, 0, 0],
        avgTyreInnerTemp: [0, 0, 0, 0],
        maxTyreSurfaceTemp: [0, 0, 0, 0],
        maxTyreInnerTemp: [0, 0, 0, 0],
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

// Extract per-lap telemetry stats from frame data
function computeLapFrameStats(lap, session) {
  const noFrames = !session.frames || session.frames.length === 0;
  const startIdx = lap.startFrameIdx;
  const endIdx = lap.endFrameIdx;
  const hasRange = startIdx != null && endIdx != null &&
    startIdx < (session.frames?.length || 0) && endIdx < (session.frames?.length || 0);

  const result = {
    fuel: 0,
    tyreWear: [0, 0, 0, 0],
    avgSurfaceTemp: [0, 0, 0, 0],
    avgInnerTemp: [0, 0, 0, 0],
    avgBrakeTemp: [0, 0, 0, 0],
    avgPressure: [0, 0, 0, 0],
    avgEngineTemp: 0,
    avgBatteryPct: 0,
    ersHarvestedMJ: 0,
    ersDeployedMJ: 0,
  };

  if (noFrames || !hasRange) return result;

  // Find the real lap-start frame by walking forward until we see the
  // `currentLapTimeInMS` (frame.t) reset to near-zero. This strips out
  // warmup / Time-Trial "Start Flying Lap" teleport frames that would
  // otherwise inflate lap 1's fuel delta.
  let realStartIdx = startIdx;
  let prevT = session.frames[startIdx]?.t ?? 0;
  for (let i = startIdx + 1; i <= endIdx; i++) {
    const t = session.frames[i]?.t ?? 0;
    if (t < 500 && prevT > 2000) {
      realStartIdx = i;
    }
    prevT = t;
  }

  // Fuel: consumed = start - end (start = first frame AFTER timer reset)
  const startFuel = session.frames[realStartIdx]?.fl ?? 0;
  const endFuel = session.frames[endIdx]?.fl ?? 0;
  const consumed = startFuel - endFuel;
  result.fuel = consumed > 0 ? +consumed.toFixed(2) : 0;

  // Tyre wear at lap end
  const endFrame = session.frames[endIdx];
  if (endFrame?.tw) {
    result.tyreWear = endFrame.tw.map(v => +((v || 0)).toFixed(1));
  }

  // Average temps / pressures across lap frames (scan from realStartIdx so
  // warmup frames before the timer reset don't skew these either).
  let frameCount = 0;
  const sumSurface = [0, 0, 0, 0];
  const sumInner = [0, 0, 0, 0];
  const sumBrake = [0, 0, 0, 0];
  const sumPressure = [0, 0, 0, 0];
  let brakeFrames = 0;
  let pressureFrames = 0;
  let sumEngine = 0;
  let sumBattery = 0;
  let batteryFrames = 0;
  let maxHarvest = 0;
  let maxDeploy = 0;

  for (let i = realStartIdx; i <= endIdx; i++) {
    const f = session.frames[i];
    if (!f) continue;
    frameCount++;
    if (f.ts) for (let w = 0; w < 4; w++) sumSurface[w] += (f.ts[w] || 0);
    if (f.ti) for (let w = 0; w < 4; w++) sumInner[w] += (f.ti[w] || 0);
    if (f.bt) {
      brakeFrames++;
      for (let w = 0; w < 4; w++) sumBrake[w] += (f.bt[w] || 0);
    }
    if (f.tp) {
      pressureFrames++;
      for (let w = 0; w < 4; w++) sumPressure[w] += (f.tp[w] || 0);
    }
    sumEngine += (f.et || 0);
    if (f.er != null) {
      sumBattery += f.er;
      batteryFrames++;
    }
    // eh / ep are "this lap" totals that grow through the lap — take the max
    // rather than trusting the endIdx frame alone (late interval decimation
    // can leave the final frame slightly below peak).
    if (f.eh != null && f.eh > maxHarvest) maxHarvest = f.eh;
    if (f.ep != null && f.ep > maxDeploy) maxDeploy = f.ep;
  }

  if (frameCount > 0) {
    for (let w = 0; w < 4; w++) {
      result.avgSurfaceTemp[w] = Math.round(sumSurface[w] / frameCount);
      result.avgInnerTemp[w] = Math.round(sumInner[w] / frameCount);
    }
    result.avgEngineTemp = Math.round(sumEngine / frameCount);
  }
  if (brakeFrames > 0) {
    for (let w = 0; w < 4; w++) {
      result.avgBrakeTemp[w] = Math.round(sumBrake[w] / brakeFrames);
    }
  }
  if (pressureFrames > 0) {
    for (let w = 0; w < 4; w++) {
      result.avgPressure[w] = +((sumPressure[w] / pressureFrames)).toFixed(2);
    }
  }
  if (batteryFrames > 0) {
    result.avgBatteryPct = Math.round(sumBattery / batteryFrames);
  }
  // eh/ep are Joules; convert to MJ for display convenience.
  result.ersHarvestedMJ = +(maxHarvest / 1_000_000).toFixed(2);
  result.ersDeployedMJ = +(maxDeploy / 1_000_000).toFixed(2);

  return result;
}

function finalizeRun(run, laps, session) {
  const runLaps = run.lapIndices.map(i => laps[i]);
  const validLaps = runLaps.filter(l => l.valid !== false && l.lapTimeMs > 0);

  run.lapCount = run.lapIndices.length;
  run.validLapCount = validLaps.length;

  // Embed individual lap details with telemetry stats from frames
  run.laps = runLaps.map(l => {
    const stats = computeLapFrameStats(l, session);
    return {
      lapNum: l.lapNum,
      lapTimeMs: l.lapTimeMs || 0,
      s1Ms: l.s1Ms || 0,
      s2Ms: l.s2Ms || 0,
      s3Ms: l.s3Ms || 0,
      maxSpeed: l.maxSpeed || 0,
      avgThrottle: l.avgThrottle || 0,
      avgBrake: l.avgBrake || 0,
      tyreAge: l.tyreAge || 0,
      fuel: stats.fuel,
      tyreWear: stats.tyreWear,
      avgSurfaceTemp: stats.avgSurfaceTemp,
      avgInnerTemp: stats.avgInnerTemp,
      avgBrakeTemp: stats.avgBrakeTemp,
      avgPressure: stats.avgPressure,
      avgEngineTemp: stats.avgEngineTemp,
      avgBatteryPct: stats.avgBatteryPct,
      ersHarvestedMJ: stats.ersHarvestedMJ,
      ersDeployedMJ: stats.ersDeployedMJ,
      valid: l.valid !== false,
      isOutLap: l.isOutLap || false,
      isPitLap: l.isPitLap || false,
      trackTemp: l.trackTemp != null ? l.trackTemp : null,
      airTemp:   l.airTemp   != null ? l.airTemp   : null,
      weather:   l.weather   || null,
      // trafficLap is filled in below once we have the stint-wide medians
      trafficLap: false,
      // Preserve any user-set per-lap metadata (notes, flag overrides) so the
      // frontend can round-trip these without losing them.
      notes: l.notes || '',
      flag: l.flag || null,
    };
  });

  // ── Traffic-lap heuristic ──────────────────────────────────────────────────
  // A lap is flagged as "traffic" if its lap time, max speed, or S3 time falls
  // significantly outside the stint-wide median. Robust median absolute
  // deviation (MAD) — less sensitive to the very outliers we're trying to
  // catch than a mean/stddev pair would be.
  //
  // Threshold: 2.5 × MAD (≈ 1.7σ for normally-distributed data). Lap must
  // have at least one of (lapTimeMs, maxSpeed, s3Ms) exceeding the threshold
  // to be marked.
  //
  // Outlaps, pit laps, and already-invalid laps are exempt (they are slow
  // for legitimate reasons, not traffic).
  if (validLaps.length >= 4) {
    const median = (xs) => {
      const s = [...xs].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    const mad = (xs, m) => median(xs.map((x) => Math.abs(x - m)));

    const lapTimes  = validLaps.map((l) => l.lapTimeMs);
    const maxSpeeds = validLaps.map((l) => l.maxSpeed || 0).filter((v) => v > 0);
    const s3Times   = validLaps.map((l) => l.s3Ms || 0).filter((v) => v > 0);

    const lapTimeMed = median(lapTimes);
    const lapTimeMad = mad(lapTimes, lapTimeMed);
    const maxSpeedMed = maxSpeeds.length ? median(maxSpeeds) : 0;
    const maxSpeedMad = maxSpeeds.length ? mad(maxSpeeds, maxSpeedMed) : 0;
    const s3Med = s3Times.length ? median(s3Times) : 0;
    const s3Mad = s3Times.length ? mad(s3Times, s3Med) : 0;

    const K = 2.5;
    for (const rl of run.laps) {
      if (!rl.valid || rl.isOutLap || rl.isPitLap) continue;
      // Respect user-set flag: if a human already classified, leave it.
      if (rl.flag === 'clean' || rl.flag === 'mistake' || rl.flag === 'reference') continue;

      const slowLap  = lapTimeMad > 0 && rl.lapTimeMs > lapTimeMed + K * lapTimeMad;
      const slowTrap = maxSpeedMad > 0 && rl.maxSpeed > 0 && rl.maxSpeed < maxSpeedMed - K * maxSpeedMad;
      const slowS3   = s3Mad > 0 && rl.s3Ms > 0 && rl.s3Ms > s3Med + K * s3Mad;

      if (slowLap || slowTrap || slowS3) {
        rl.trafficLap = true;
        if (!rl.flag) rl.flag = 'traffic';
      }
    }
  }

  // Roll up every per-lap field into the run-level aggregates. Shared
  // with the split/merge endpoints via `recomputeRunAggregates` so the two
  // paths can't drift in what they advertise.
  recomputeRunAggregates(run);
}

// ─── Live Practice Update ─────────────────────────────────────────────────────
// Called when we receive authoritative lap data during a practice/TT session.
// Extracts runs from the in-progress recording, saves the workbook, and broadcasts.

const PRACTICE_SESSION_TYPES = new Set(['P1', 'P2', 'P3', 'Short P', 'Time Trial']);
let lastPracticeLapCount = 0;

function livePracticeUpdate() {
  try {
    const session = recorder.getCurrentSession();
    if (!session) return;

    // Only for practice and time-trial sessions
    if (!PRACTICE_SESSION_TYPES.has(session.sessionType)) return;

    // Only update when a new lap has been recorded
    const lapCount = session.laps.length;
    if (lapCount === 0 || lapCount === lastPracticeLapCount) return;
    lastPracticeLapCount = lapCount;

    const trackName = session.track || 'Unknown';
    if (trackName === 'Unknown') return;

    const runs = extractPracticeRuns(session);
    if (runs.length === 0) return;

    const wb = loadPracticeWorkbook(trackName);

    // Upsert runs from this live session (replace existing by id, add new)
    for (const run of runs) {
      const existingIdx = wb.runs.findIndex(r => r.id === run.id);
      if (existingIdx >= 0) {
        wb.runs[existingIdx] = run;
      } else {
        wb.runs.push(run);
      }
    }

    savePracticeWorkbook(wb);
    broadcast('practiceUpdate', wb);
  } catch (err) {
    // Non-critical — don't crash the server
    console.error('[Practice] Live update error:', err.message);
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
        lastPracticeLapCount = 0;
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
            // Live practice update after authoritative lap data arrives
            livePracticeUpdate();
          }
          recorder.updateCarHistory(carIdx, packet.data);
        }
      }
      break;

    case PACKET_IDS.FINAL_CLASSIFICATION:
      state.finalClassification = packet.data;
      broadcast('finalClassification', packet.data);

      // Race/session ended — persist classification before stopping recording
      if (recorder.getStatus().isRecording) {
        console.log('[Session] Final classification received — auto-saving recording');
        recorder.setFinalClassification(packet.data);
        recorder.stop();
        broadcast('recStatus', recorder.getStatus());
      }
      break;

    case PACKET_IDS.EVENT:
      // Always forward events (SSTA, FTLP, PENA, OVTK, ...)
      broadcast('event', packet.data);
      if (recorder.getStatus().isRecording) {
        recorder.recordEvent(packet.data, packet.header);
      }
      break;

    case PACKET_IDS.LOBBY_INFO:
      state.lobbyInfo = packet.data;
      broadcast('lobbyInfo', packet.data);
      if (recorder.getStatus().isRecording) {
        recorder.setLobbyInfo(packet.data);
      }
      break;

    case PACKET_IDS.TYRE_SETS:
      if (packet.data) {
        state.tyreSets[packet.data.carIdx] = packet.data;
        broadcast('tyreSets', packet.data);
        if (recorder.getStatus().isRecording) {
          recorder.setTyreSets(packet.data);
        }
      }
      break;

    case PACKET_IDS.MOTION_EX:
      state.motionEx = packet.data;
      broadcast('motionEx', packet.data);
      if (recorder.getStatus().isRecording && cfg.recording?.captureFrames) {
        recorder.addMotionExFrame(packet.data);
      }
      break;

    case PACKET_IDS.TIME_TRIAL:
      state.timeTrial = packet.data;
      broadcast('timeTrial', packet.data);
      if (recorder.getStatus().isRecording) {
        recorder.setTimeTrial(packet.data);
      }
      break;

    case PACKET_IDS.LAP_POSITIONS:
      state.lapPositions = packet.data;
      broadcast('lapPositions', packet.data);
      if (recorder.getStatus().isRecording) {
        recorder.setLapPositions(packet.data);
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

// ─── Graceful shutdown — save in-progress recording ──────────────────────────

function gracefulShutdown(signal) {
  console.log(`\n[Server] ${signal} received — saving in-progress recording...`);
  if (recorder.getStatus().isRecording) {
    recorder.saveCheckpoint();
  }
  process.exit(0);
}

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
