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
// Serve React build if it exists, otherwise fall back to legacy public/
const distPath = path.join(__dirname, 'dist');
const publicPath = path.join(__dirname, 'public');
app.use(express.static(fs.existsSync(distPath) ? distPath : publicPath));

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
          endLap: car.currentLap > 0 ? car.currentLap - 1 : 0,
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

      // Auto-start recording on new session if enabled
      if (cfg.recording?.autoRecord && newUID !== lastSessionUID && newUID !== '0') {
        if (!recorder.getStatus().isRecording) {
          recorder.start(packet.data);
          if (state.participants) recorder.setParticipants(state.participants);
          broadcast('recStatus', recorder.getStatus());
        }
        lastSessionUID = newUID;
      }

      // Reset race state on new session
      if (newUID !== lastSessionUID) {
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
        recorder.updateAllCarsLapData(packet.data, state.carStatus);
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
