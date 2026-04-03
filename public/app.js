/**
 * F1 25 Telemetry Dashboard – Client v3
 * All 13 features: Timing tower, Track map, Telemetry charts, Countdown,
 * Weather forecast, Fuel strategy, Pit window, Mobile responsive, Lap delta,
 * DRS zones, Keyboard shortcuts, Notification sounds, Full telemetry export
 */

'use strict';

// ══════════════════════════════════════════════════════════════════════════════
// 1. STATE
// ══════════════════════════════════════════════════════════════════════════════

const state = {
  maxRPM:       15000,
  bestLap:      null,
  lastSector1:  0,
  lastSector2:  0,
  lastLapMs:    0,
  sector:       0,
  totalLaps:    0,
  currentLap:   0,
  lastDataTs:   0,
  sessionUID:   null,
  speedUnit:    'kmh',
  isRecording:  false,
  recLapCount:  0,
  // G-force
  gLat:  0,
  gLong: 0,
  // Session extended
  sessionTimeLeft:  0,
  sessionDuration:  0,
  weatherForecast:  [],
  safetyCarStatus:  0,
  pitWindowIdeal:   0,
  pitWindowLatest:  0,
  marshalZones:     [],
  // Timing tower data
  allLapData:       null,
  allParticipants:  null,
  allCarStatus:     null,
  playerCarIndex:   -1,
  fastestLapMs:     null,
  // Track map
  trackPoints:      [],  // accumulated worldPositionX/Z for track outline
  allCarPositions:  [],  // current positions of all cars
  trackBounds:      null,
  // Fuel strategy
  fuelPerLapSamples: [],
  lastFuelInTank:   null,
  lastFuelLap:      0,
  // Delta
  bestLapTimeMs:    0,
  currentLapTimeMs: 0,
  currentLapDistance: 0,
  totalTrackLength: 0,
  // Setup
  currentSetup:     null,
  currentTrackId:   -1,
  trackOutlineSaved: false,
  trackOutlineLoaded: false,
  // DRS
  drsAllowed:       false,
  drsActive:        false,
  drsActivationDist: 0,
  // History
  currentSessionId: null,
  currentSession:   null,
  selectedSessions: new Set(),
  // Race Engineer
  raceState:        null,
  // Context-aware
  pitStatus:        0,
  // Weather tracking
  weatherHistory:   [],
  lastWeatherLap:   0,
  // Charts
  chartInstances:   [],
  selectedLapIdx:   null,
  compareLapIdx:    null,
  // Notifications
  notificationsEnabled: false,
  lastFlag:         0,
  audioCtx:         null,
};

// Canvas contexts
let gCtx = null;
let trackCtx = null;

// ══════════════════════════════════════════════════════════════════════════════
// 2. WEBSOCKET + RECONNECT
// ══════════════════════════════════════════════════════════════════════════════

let ws;
let reconnectTimer;

function connect() {
  ws = new WebSocket(`ws://${location.host}`);

  ws.onopen = () => {
    setSignal('live');
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };

  ws.onclose = () => {
    setSignal('off');
    playNotification('disconnect');
    reconnectTimer = setTimeout(connect, 2000);
  };

  ws.onmessage = evt => {
    state.lastDataTs = Date.now();
    setSignal('live');
    let msg;
    try { msg = JSON.parse(evt.data); } catch { return; }
    const { type, data } = msg;
    switch (type) {
      case 'telemetry':      updateTelemetry(data);      break;
      case 'lapData':        updateLapData(data);         break;
      case 'carStatus':      updateCarStatus(data);       break;
      case 'session':        updateSession(data);         break;
      case 'participants':   updateParticipants(data);    break;
      case 'carSetups':      updateCarSetups(data);       break;
      case 'carDamage':      updateCarDamage(data);       break;
      case 'motion':         updateMotion(data);          break;
      case 'sessionHistory': updateSessionHistory(data);  break;
      case 'raceEngineer':   updateRaceEngineer(data); updatePitPredictor(data); updateWeatherImpactLive(); break;
      case 'recStatus':      onRecStatus(data);           break;
      case 'tunnel':         onTunnelStatus(data);        break;
    }
  };

  ws.onerror = () => ws.close();
}

// Watchdog
setInterval(() => {
  if (state.lastDataTs > 0 && Date.now() - state.lastDataTs > 4000) {
    setSignal('waiting');
  }
}, 1000);

// ══════════════════════════════════════════════════════════════════════════════
// 3. SIGNAL INDICATOR
// ══════════════════════════════════════════════════════════════════════════════

function setSignal(mode) {
  const e = el('signal');
  if (!e) return;
  if (mode === 'live')    { e.className = 'live';       e.textContent = 'LIVE'; }
  if (mode === 'waiting') { e.className = 'waiting';    e.textContent = 'WAITING'; }
  if (mode === 'off')     { e.className = 'signal-off'; e.textContent = 'NO SIGNAL'; }
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. DASHBOARD — TELEMETRY UPDATE
// ══════════════════════════════════════════════════════════════════════════════

function updateTelemetry(data) {
  const car = data.playerData;
  if (!car) return;

  const spd = state.speedUnit === 'mph' ? Math.round(car.speed * 0.621371) : car.speed;
  setText('speed-val', spd);

  const gearStr = car.gear === 0 ? 'N' : car.gear === -1 ? 'R' : String(car.gear);
  setText('gear-val', gearStr);

  const rpm = car.engineRPM;
  const rpmPct = Math.min(100, (rpm / state.maxRPM) * 100);
  setText('rpm-val', rpm.toLocaleString() + ' RPM');
  setWidth('rpm-bar', rpmPct);
  const rpmBarEl = el('rpm-bar');
  if (rpmBarEl) rpmBarEl.style.background = rpmColor(rpmPct);

  updateRevLights(car.revLightsPercent);

  const thr = Math.round(car.throttle * 100);
  const brk = Math.round(car.brake * 100);
  setHeight('throttle-bar', thr); setText('throttle-val', thr + '%');
  setHeight('brake-bar',    brk); setText('brake-val',    brk + '%');

  // DRS badge — enhanced with available/active states
  state.drsActive = car.drs === 1;
  updateDRSBadge();

  // Tyre temps [RL=0, RR=1, FL=2, FR=3]
  setTyreTempUI('rl', car.tyresSurfaceTemperature[0], car.tyresInnerTemperature[0], car.tyresPressure[0]);
  setTyreTempUI('rr', car.tyresSurfaceTemperature[1], car.tyresInnerTemperature[1], car.tyresPressure[1]);
  setTyreTempUI('fl', car.tyresSurfaceTemperature[2], car.tyresInnerTemperature[2], car.tyresPressure[2]);
  setTyreTempUI('fr', car.tyresSurfaceTemperature[3], car.tyresInnerTemperature[3], car.tyresPressure[3]);

  setBrakeTempUI('rl-brake', car.brakesTemperature[0]);
  setBrakeTempUI('rr-brake', car.brakesTemperature[1]);
  setBrakeTempUI('fl-brake', car.brakesTemperature[2]);
  setBrakeTempUI('fr-brake', car.brakesTemperature[3]);

  setText('engine-temp', car.engineTemperature + '°C');
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. DASHBOARD — LAP DATA
// ══════════════════════════════════════════════════════════════════════════════

function updateLapData(data) {
  const car = data.playerData;
  if (!car) return;

  // Store all-car data for timing tower
  state.allLapData = data;

  state.sector     = car.sector;
  state.currentLap = car.currentLapNum;
  state.currentLapTimeMs = car.currentLapTimeInMS || 0;
  state.currentLapDistance = car.lapDistance || 0;

  // Current lap time
  const curEl = el('current-lap');
  if (curEl) {
    curEl.textContent = fmtTime(car.currentLapTimeInMS);
    curEl.className = 'lap-time current-time' + (car.currentLapInvalid ? ' invalid-time' : '');
  }

  // Last lap
  if (car.lastLapTimeInMS > 0 && car.lastLapTimeInMS !== state.lastLapMs) {
    state.lastLapMs = car.lastLapTimeInMS;
    setText('last-lap', fmtTime(car.lastLapTimeInMS));
    if (!state.bestLap || car.lastLapTimeInMS < state.bestLap) {
      state.bestLap = car.lastLapTimeInMS;
      state.bestLapTimeMs = car.lastLapTimeInMS;
      setText('best-lap', fmtTime(state.bestLap));
    }
    // Save track outline after first completed lap
    checkTrackSave();
  }

  // Sector times
  if (car.sector1TimeInMS > 0) {
    state.lastSector1 = car.sector1TimeInMS;
    setText('s1-time', fmtSector(car.sector1TimeInMS));
  }
  if (car.sector2TimeInMS > 0) {
    state.lastSector2 = car.sector2TimeInMS;
    setText('s2-time', fmtSector(car.sector2TimeInMS));
  }
  if (state.lastLapMs > 0 && state.lastSector1 > 0 && state.lastSector2 > 0) {
    const s3 = state.lastLapMs - state.lastSector1 - state.lastSector2;
    if (s3 > 0) setText('s3-time', fmtSector(s3));
  }

  setText('lap-of', `${car.currentLapNum} / ${state.totalLaps || '—'}`);
  setText('position', car.carPosition || '—');

  if (car.deltaToLeaderInMS > 0) {
    setText('gap-leader', '+' + fmtDelta(car.deltaToLeaderInMS));
  } else {
    setText('gap-leader', 'LEAD');
  }

  setText('pit-stops', car.numPitStops ?? '—');
  setText('penalties',  car.penalties > 0 ? car.penalties + 's' : '0s');

  // Delta bar
  updateDeltaBar(car);

  // Update timing tower
  updateTimingTower();

  // Relative timing bar (#20)
  updateRelativeBar();

  // Track weather data for weather impact analysis (#16)
  trackWeatherForLap();
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. DASHBOARD — CAR STATUS
// ══════════════════════════════════════════════════════════════════════════════

function updateCarStatus(data) {
  const car = data.playerData;
  if (!car) return;

  // Store for timing tower
  state.allCarStatus = data;

  if (car.maxRPM > 0) {
    state.maxRPM = car.maxRPM;
    setText('rpm-max-val', car.maxRPM.toLocaleString() + ' MAX');
  }

  const compEl = el('compound-badge');
  const name = car.tyreCompoundName || '—';
  if (compEl) {
    compEl.textContent = name;
    compEl.className = 'comp-badge ' + name.toLowerCase();
  }

  setText('tyre-age', car.tyresAgeLaps + ' laps');

  const ersPct = Math.min(100, (car.ersStoreEnergy / 4_000_000) * 100);
  setHeight('ers-bar', ersPct);
  setText('ers-mode-val', car.ersDeployModeName || '—');

  const fuelPct = car.fuelCapacity > 0
    ? Math.min(100, (car.fuelInTank / car.fuelCapacity) * 100)
    : 0;
  setHeight('fuel-bar', fuelPct);
  setText('fuel-laps-val', (car.fuelRemainingLaps || 0).toFixed(1) + ' laps');

  const fb = el('fuel-bar');
  if (fb) fb.style.background = car.fuelRemainingLaps < 3 ? 'var(--red)' : 'var(--yellow)';

  setBadge('pit-badge', car.pitLimiterStatus === 1, 'b-pit');
  setText('brake-bias', car.frontBrakeBias + '%');

  // Context-aware: pit mode (#18)
  const oldPit = state.pitStatus;
  state.pitStatus = car.pitStatus || 0;
  if (state.pitStatus !== oldPit) updatePitMode();

  // DRS state
  state.drsAllowed = car.drsAllowed === 1;
  state.drsActivationDist = car.drsActivationDistance || 0;
  updateDRSBadge();

  // Flag with notification
  const oldFlag = state.lastFlag;
  state.lastFlag = car.vehicleFiaFlags;
  updateFlagBadge(car.vehicleFiaFlags);
  if (oldFlag !== car.vehicleFiaFlags && car.vehicleFiaFlags > 0) {
    playNotification('flag');
  }

  // Fuel strategy
  updateFuelStrategy(car);
}

// ══════════════════════════════════════════════════════════════════════════════
// 7. DASHBOARD — SESSION
// ══════════════════════════════════════════════════════════════════════════════

function updateSession(data) {
  setText('track-name',   data.trackName || '—');
  setText('session-type', data.sessionTypeName || '—');
  setText('weather',      data.weatherName || '—');
  setText('track-temp',   data.trackTemperature + '°C');
  setText('air-temp',     data.airTemperature + '°C');
  state.totalLaps = data.totalLaps || 0;
  state.totalTrackLength = data.trackLength || 0;

  // Countdown
  state.sessionTimeLeft = data.sessionTimeLeft || 0;
  state.sessionDuration = data.sessionDuration || 0;
  updateCountdown();

  // Safety car
  state.safetyCarStatus = data.safetyCarStatus || 0;
  updateSafetyCarBadge();

  // Weather forecast
  state.weatherForecast = data.weatherForecast || [];
  updateWeatherStrip();

  // Marshal zones
  state.marshalZones = data.marshalZones || [];

  // Load saved track outline if track changed
  const newTrackId = data.trackId;
  if (newTrackId !== undefined && newTrackId !== state.currentTrackId) {
    state.currentTrackId = newTrackId;
    state.trackOutlineSaved = false;
    state.trackOutlineLoaded = false;
    loadTrackOutline(newTrackId);
  }

  // Pit window
  state.pitWindowIdeal = data.pitStopWindowIdealLap || 0;
  state.pitWindowLatest = data.pitStopWindowLatestLap || 0;
  updatePitWindow();
}

// ══════════════════════════════════════════════════════════════════════════════
// 8. DASHBOARD — PARTICIPANTS
// ══════════════════════════════════════════════════════════════════════════════

function updateParticipants(data) {
  if (data.playerName) setText('driver-name', data.playerName);
  state.allParticipants = data;
  // Get player car index from participants data
  if (data.participants) {
    for (let i = 0; i < data.participants.length; i++) {
      if (data.participants[i].name === data.playerName) {
        state.playerCarIndex = i;
        break;
      }
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 9. DASHBOARD — CAR DAMAGE
// ══════════════════════════════════════════════════════════════════════════════

function updateCarDamage(data) {
  const car = data.playerData;
  if (!car) return;

  setTyreWear('rl', car.tyresWear[0]);
  setTyreWear('rr', car.tyresWear[1]);
  setTyreWear('fl', car.tyresWear[2]);
  setTyreWear('fr', car.tyresWear[3]);

  setWingDamage('wing-fl',   car.frontLeftWingDamage);
  setWingDamage('wing-fr',   car.frontRightWingDamage);
  setWingDamage('wing-rear', car.rearWingDamage);
}

function setTyreWear(pos, wearPct) {
  const bar = el(pos + '-wear');
  if (!bar) return;
  const pct = Math.min(100, Math.max(0, wearPct));
  bar.style.width = pct + '%';
  bar.style.background = wearColor(pct);
}

function setWingDamage(id, dmg) {
  const box = el(id);
  if (!box) return;
  const r = Math.round((dmg / 100) * 232);
  const g = Math.round(((100 - dmg) / 100) * 211);
  box.style.background = `rgb(${r},${g},0)`;
}

// ══════════════════════════════════════════════════════════════════════════════
// 9B. DASHBOARD — CAR SETUPS
// ══════════════════════════════════════════════════════════════════════════════

function updateCarSetups(data) {
  const car = data.playerData;
  if (!car) return;

  state.currentSetup = car;

  setText('su-front-wing', car.frontWing);
  setText('su-rear-wing', car.rearWing);
  setText('su-diff-on', car.onThrottle + '%');
  setText('su-diff-off', car.offThrottle + '%');
  setText('su-front-camber', car.frontCamber.toFixed(2) + '°');
  setText('su-rear-camber', car.rearCamber.toFixed(2) + '°');
  setText('su-front-toe', car.frontToe.toFixed(4) + '°');
  setText('su-rear-toe', car.rearToe.toFixed(4) + '°');
  setText('su-front-susp', car.frontSuspension);
  setText('su-rear-susp', car.rearSuspension);
  setText('su-front-arb', car.frontAntiRollBar);
  setText('su-rear-arb', car.rearAntiRollBar);
  setText('su-front-height', car.frontSuspensionHeight);
  setText('su-rear-height', car.rearSuspensionHeight);
  setText('su-brake-pres', car.brakePressure + '%');
  setText('su-brake-bias', car.brakeBias + '%');
  setText('su-tyre-fl', car.frontLeftTyrePressure.toFixed(1) + ' psi');
  setText('su-tyre-fr', car.frontRightTyrePressure.toFixed(1) + ' psi');
  setText('su-tyre-rl', car.rearLeftTyrePressure.toFixed(1) + ' psi');
  setText('su-tyre-rr', car.rearRightTyrePressure.toFixed(1) + ' psi');
  setText('su-fuel-load', car.fuelLoad.toFixed(1) + ' kg');
}

// ══════════════════════════════════════════════════════════════════════════════
// 10. DASHBOARD — MOTION / G-FORCE + TRACK MAP
// ══════════════════════════════════════════════════════════════════════════════

function updateMotion(data) {
  const car = data.playerData;
  if (!car) return;

  state.gLat  = car.gForceLateral      || 0;
  state.gLong = car.gForceLongitudinal || 0;

  const MAX_G = 5;

  const latPct = Math.min(1, Math.abs(state.gLat) / MAX_G) * 50;
  const latLeft  = el('glat-left');
  const latRight = el('glat-right');
  if (latLeft && latRight) {
    if (state.gLat >= 0) {
      latRight.style.width = latPct + '%'; latLeft.style.width = '0%';
    } else {
      latLeft.style.width = latPct + '%'; latRight.style.width = '0%';
    }
  }
  setText('glat-val', state.gLat.toFixed(1) + 'g');

  const longPct = Math.min(1, Math.abs(state.gLong) / MAX_G) * 50;
  const lLeft  = el('glong-left');
  const lRight = el('glong-right');
  if (lLeft && lRight) {
    if (state.gLong >= 0) {
      lLeft.style.width = longPct + '%'; lRight.style.width = '0%';
    } else {
      lRight.style.width = longPct + '%'; lLeft.style.width = '0%';
    }
  }
  setText('glong-val', state.gLong.toFixed(1) + 'g');

  drawGMeter(state.gLat, state.gLong, MAX_G);

  // Track map: store all car positions
  if (data.allCars) {
    state.allCarPositions = data.allCars.map(c => ({
      x: c.worldPositionX,
      z: c.worldPositionZ,
    }));

    // Accumulate track outline from player car
    const px = car.worldPositionX;
    const pz = car.worldPositionZ;
    if (px !== 0 || pz !== 0) {
      const pts = state.trackPoints;
      if (pts.length === 0 || Math.hypot(px - pts[pts.length-1].x, pz - pts[pts.length-1].z) > 5) {
        pts.push({ x: px, z: pz });
        if (pts.length > 2000) pts.shift();
        updateTrackBounds();
      }
    }

    drawTrackMap();
  }
}

function drawGMeter(lat, lon, maxG) {
  const canvas = document.getElementById('gmeter');
  if (!canvas) return;
  if (!gCtx) gCtx = canvas.getContext('2d');
  const ctx = gCtx;
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const R  = cx - 4;

  ctx.clearRect(0, 0, W, H);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = '#10101e'; ctx.fill();
  ctx.strokeStyle = '#2a2a40'; ctx.lineWidth = 1; ctx.stroke();

  ctx.strokeStyle = '#2a2a40'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
  ctx.stroke();

  ctx.beginPath(); ctx.arc(cx, cy, R * 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = '#1e1e38'; ctx.lineWidth = 1; ctx.stroke();

  const dotX = cx + clamp01(lat / maxG) * R;
  const dotY = cy - clamp01(lon / maxG) * R;

  ctx.beginPath(); ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#e8002d'; ctx.fill();
  ctx.shadowColor = '#e8002d'; ctx.shadowBlur = 8; ctx.fill();
  ctx.shadowBlur = 0;
}

function clamp01(v) { return Math.max(-1, Math.min(1, v)); }

// ── Track Map ────────────────────────────────────────────────────────────────

function updateTrackBounds() {
  const pts = state.trackPoints;
  if (pts.length < 2) return;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  }
  const pad = Math.max(maxX - minX, maxZ - minZ) * 0.08;
  state.trackBounds = { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
}

let lastTrackDraw = 0;
function drawTrackMap() {
  const now = performance.now();
  if (now - lastTrackDraw < 100) return; // throttle to ~10fps
  lastTrackDraw = now;

  const canvas = el('trackmap');
  if (!canvas || !state.trackBounds) return;
  if (!trackCtx) trackCtx = canvas.getContext('2d');
  const ctx = trackCtx;
  const W = canvas.width;
  const H = canvas.height;
  const b = state.trackBounds;

  ctx.clearRect(0, 0, W, H);

  const scaleX = W / (b.maxX - b.minX);
  const scaleZ = H / (b.maxZ - b.minZ);
  const scale  = Math.min(scaleX, scaleZ);
  const offX   = (W - (b.maxX - b.minX) * scale) / 2;
  const offZ   = (H - (b.maxZ - b.minZ) * scale) / 2;

  function toScreen(x, z) {
    return [(x - b.minX) * scale + offX, (z - b.minZ) * scale + offZ];
  }

  // Draw track outline
  const pts = state.trackPoints;
  if (pts.length > 1) {
    ctx.beginPath();
    const [sx, sz] = toScreen(pts[0].x, pts[0].z);
    ctx.moveTo(sx, sz);
    for (let i = 1; i < pts.length; i++) {
      const [px, pz] = toScreen(pts[i].x, pts[i].z);
      ctx.lineTo(px, pz);
    }
    ctx.strokeStyle = '#2a2a40';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Draw all cars
  const cars = state.allCarPositions;
  const participants = state.allParticipants?.participants || [];
  for (let i = 0; i < cars.length; i++) {
    if (!cars[i] || (cars[i].x === 0 && cars[i].z === 0)) continue;
    const [cx, cz] = toScreen(cars[i].x, cars[i].z);
    const isPlayer = i === state.playerCarIndex;
    const r = isPlayer ? 5 : 3;
    ctx.beginPath();
    ctx.arc(cx, cz, r, 0, Math.PI * 2);
    ctx.fillStyle = isPlayer ? '#e8002d' : '#555575';
    ctx.fill();
    if (isPlayer) {
      ctx.strokeStyle = '#e8002d'; ctx.lineWidth = 2;
      ctx.shadowColor = '#e8002d'; ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }
}

// ── Track outline persistence ────────────────────────────────────────────────

async function loadTrackOutline(trackId) {
  try {
    const res = await fetch(`/api/tracks/${trackId}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.points && data.points.length > 10) {
      state.trackPoints = data.points;
      state.trackOutlineLoaded = true;
      updateTrackBounds();
      drawTrackMap();
    }
  } catch (err) {
    // No saved track data — will build from live motion
  }
}

async function saveTrackOutline(trackId) {
  if (state.trackOutlineSaved || state.trackPoints.length < 100) return;
  state.trackOutlineSaved = true;
  try {
    await fetch(`/api/tracks/${trackId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: state.trackPoints }),
    });
  } catch (err) {
    state.trackOutlineSaved = false;
  }
}

// Auto-save track outline once we have enough points and a lap is completed
function checkTrackSave() {
  if (state.currentTrackId >= 0 && state.trackPoints.length >= 200 && !state.trackOutlineSaved) {
    saveTrackOutline(state.currentTrackId);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 11. SESSION HISTORY
// ══════════════════════════════════════════════════════════════════════════════

function updateSessionHistory(data) {
  if (!data || !data.laps) return;

  const validLaps = data.laps.filter(l => l.lapValid && l.lapTimeInMS > 0);
  if (validLaps.length === 0) return;

  const bestMs = Math.min(...validLaps.map(l => l.lapTimeInMS));
  if (!state.bestLap || bestMs < state.bestLap) {
    state.bestLap = bestMs;
    state.bestLapTimeMs = bestMs;
    setText('best-lap', fmtTime(bestMs));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 12. REV LIGHTS
// ══════════════════════════════════════════════════════════════════════════════

function updateRevLights(pct) {
  const lit   = Math.round((pct / 100) * 15);
  const flash = pct >= 100;

  for (let i = 0; i < 15; i++) {
    const e = document.getElementById('rl' + i);
    if (!e) continue;
    if (!flash && i >= lit) { e.className = 'rl'; continue; }
    const cls = i < 5 ? 'g-on' : i < 10 ? 'o-on' : 'r-on';
    e.className = `rl ${cls}${flash ? ' flash' : ''}`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 13. FLAG BADGE
// ══════════════════════════════════════════════════════════════════════════════

function updateFlagBadge(flag) {
  const e = el('flag-badge');
  if (!e) return;
  const labels  = { '-1': '—', 0: '—', 1: 'YELLOW', 2: 'DOUBLE Y', 3: 'GREEN', 4: 'SAFETY CAR', 5: 'RED' };
  const classes = { 1: 'b-flag-y', 2: 'b-flag-y', 3: '', 4: 'b-flag-sc', 5: 'b-flag-r' };
  e.textContent = labels[flag] ?? '—';
  e.className   = `badge ${classes[flag] || ''}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// 14. DRS BADGE (enhanced)
// ══════════════════════════════════════════════════════════════════════════════

function updateDRSBadge() {
  const e = el('drs-badge');
  if (!e) return;
  if (state.drsActive) {
    e.className = 'badge b-drs-active';
    e.textContent = 'DRS';
  } else if (state.drsAllowed) {
    e.className = 'badge b-drs-available';
    e.textContent = state.drsActivationDist > 0 ? `DRS ${state.drsActivationDist}m` : 'DRS';
  } else {
    e.className = 'badge';
    e.textContent = 'DRS';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 15. COUNTDOWN TIMER
// ══════════════════════════════════════════════════════════════════════════════

function updateCountdown() {
  const e = el('countdown');
  if (!e) return;
  const left = state.sessionTimeLeft;
  if (left <= 0) {
    e.textContent = '—';
    return;
  }
  const mins = Math.floor(left / 60);
  const secs = left % 60;
  e.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// 16. SAFETY CAR BADGE
// ══════════════════════════════════════════════════════════════════════════════

function updateSafetyCarBadge() {
  const e = el('safety-car-badge');
  if (!e) return;
  if (state.safetyCarStatus === 1) {
    e.className = 'sc-full';
    e.textContent = 'SAFETY CAR';
    playNotification('safetyCar');
  } else if (state.safetyCarStatus === 2) {
    e.className = 'sc-vsc';
    e.textContent = 'VSC';
    playNotification('safetyCar');
  } else {
    e.className = 'sc-hidden';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 17. WEATHER FORECAST STRIP
// ══════════════════════════════════════════════════════════════════════════════

const WEATHER_ICONS = ['☀️', '⛅', '☁️', '🌧️', '🌧️', '⛈️'];

function updateWeatherStrip() {
  const container = el('weather-forecast-items');
  const strip = el('weather-strip');
  if (!container || !strip) return;

  const forecast = state.weatherForecast;
  if (!forecast || forecast.length === 0) {
    strip.classList.add('ws-hidden');
    return;
  }

  strip.classList.remove('ws-hidden');

  // Show unique time offsets (deduplicate by timeOffset)
  const seen = new Set();
  const unique = [];
  for (const f of forecast) {
    if (!seen.has(f.timeOffset)) {
      seen.add(f.timeOffset);
      unique.push(f);
    }
    if (unique.length >= 8) break;
  }

  container.innerHTML = unique.map(f => {
    const icon = WEATHER_ICONS[f.weather] || '?';
    const rain = f.rainPercentage > 0 ? `<span class="wf-rain">${f.rainPercentage}%</span>` : '';
    return `<div class="wf-item">
      <span class="wf-time">+${f.timeOffset}m</span>
      <span class="wf-icon">${icon}</span>
      <span>${f.weatherName || ''}</span>
      <span class="wf-temp">${f.trackTemperature}°</span>
      ${rain}
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// 18. PIT WINDOW
// ══════════════════════════════════════════════════════════════════════════════

function updatePitWindow() {
  const e = el('pit-window-badge');
  if (!e) return;

  const ideal = state.pitWindowIdeal;
  const latest = state.pitWindowLatest;

  if (ideal === 0 && latest === 0) {
    e.textContent = '—';
    e.className = 'pit-window-badge pw-inactive';
    return;
  }

  const curLap = state.currentLap;
  e.textContent = `LAP ${ideal} — ${latest}`;

  if (curLap < ideal - 2) {
    e.className = 'pit-window-badge pw-inactive';
  } else if (curLap < ideal) {
    e.className = 'pit-window-badge pw-approaching';
    playNotification('pitWindow');
  } else if (curLap <= latest) {
    e.className = 'pit-window-badge pw-active';
  } else {
    e.className = 'pit-window-badge pw-passed';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 19. LAP DELTA BAR
// ══════════════════════════════════════════════════════════════════════════════

function updateDeltaBar(car) {
  const negBar = el('delta-bar-neg');
  const posBar = el('delta-bar-pos');
  const valEl  = el('delta-val');
  if (!negBar || !posBar || !valEl) return;

  // Use deltaToPersonalBest if we have a best lap, otherwise show 0
  let deltaMs = 0;
  if (state.bestLapTimeMs > 0 && car.currentLapTimeInMS > 0 && state.totalTrackLength > 0) {
    const lapFraction = Math.max(0, Math.min(1, car.lapDistance / state.totalTrackLength));
    const expectedMs = state.bestLapTimeMs * lapFraction;
    deltaMs = car.currentLapTimeInMS - expectedMs;
  }

  const maxDelta = 5000; // 5 seconds max
  const pct = Math.min(50, (Math.abs(deltaMs) / maxDelta) * 50);

  if (deltaMs <= 0) {
    negBar.style.width = pct + '%';
    posBar.style.width = '0%';
    valEl.textContent = fmtDeltaSigned(deltaMs);
    valEl.className = 'delta-value delta-faster';
  } else {
    posBar.style.width = pct + '%';
    negBar.style.width = '0%';
    valEl.textContent = fmtDeltaSigned(deltaMs);
    valEl.className = 'delta-value delta-slower';
  }
}

function fmtDeltaSigned(ms) {
  const sign = ms <= 0 ? '-' : '+';
  const abs  = Math.abs(ms);
  return `${sign}${(abs / 1000).toFixed(3)}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// 20. FUEL STRATEGY
// ══════════════════════════════════════════════════════════════════════════════

function updateFuelStrategy(car) {
  const fuelInTank = car.fuelInTank || 0;
  const fuelRemLaps = car.fuelRemainingLaps || 0;
  const currentLap = state.currentLap;
  const totalLaps = state.totalLaps;

  // Calculate fuel per lap from game data
  if (state.lastFuelInTank !== null && currentLap > state.lastFuelLap && currentLap > 1) {
    const used = state.lastFuelInTank - fuelInTank;
    if (used > 0 && used < 10) {
      state.fuelPerLapSamples.push(used);
      if (state.fuelPerLapSamples.length > 20) state.fuelPerLapSamples.shift();
    }
  }
  state.lastFuelInTank = fuelInTank;
  state.lastFuelLap = currentLap;

  const avgPerLap = state.fuelPerLapSamples.length > 0
    ? state.fuelPerLapSamples.reduce((a, b) => a + b, 0) / state.fuelPerLapSamples.length
    : (fuelRemLaps > 0 ? fuelInTank / fuelRemLaps : 0);

  setText('fuel-per-lap', `Per Lap: ${avgPerLap > 0 ? avgPerLap.toFixed(2) + ' kg' : '—'}`);

  if (totalLaps > 0 && avgPerLap > 0) {
    const lapsRemaining = totalLaps - currentLap;
    const fuelNeeded = lapsRemaining * avgPerLap;
    const fuelDelta = fuelInTank - fuelNeeded;

    setText('fuel-target', `Need: ${fuelNeeded.toFixed(1)} kg for ${lapsRemaining} laps`);

    const deltaEl = el('fuel-delta');
    if (deltaEl) {
      if (fuelDelta >= 0) {
        deltaEl.textContent = `+${fuelDelta.toFixed(1)} kg surplus`;
        deltaEl.className = 'fuel-stat fuel-delta fuel-surplus';
      } else {
        deltaEl.textContent = `${fuelDelta.toFixed(1)} kg SHORT`;
        deltaEl.className = 'fuel-stat fuel-delta fuel-deficit';
      }
    }
  } else {
    setText('fuel-target', `Remaining: ~${fuelRemLaps.toFixed(1)} laps`);
    const deltaEl = el('fuel-delta');
    if (deltaEl) {
      deltaEl.textContent = '';
      deltaEl.className = 'fuel-stat fuel-delta';
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 21. TIMING TOWER (Feature 1)
// ══════════════════════════════════════════════════════════════════════════════

function updateTimingTower() {
  const body = el('timing-tower-body');
  if (!body) return;

  const lapData = state.allLapData;
  const participants = state.allParticipants;
  const carStatus = state.allCarStatus;

  if (!lapData?.allCars || !participants?.participants) return;

  const cars = lapData.allCars;
  const names = participants.participants;
  const statuses = carStatus?.allCars || [];

  // Build rows sorted by position
  const rows = [];
  for (let i = 0; i < cars.length; i++) {
    if (!cars[i] || cars[i].carPosition === 0) continue;
    rows.push({
      idx: i,
      lap: cars[i],
      name: names[i]?.name || `Car ${i}`,
      teamId: names[i]?.teamId || 0,
      status: statuses[i] || null,
    });
  }

  rows.sort((a, b) => a.lap.carPosition - b.lap.carPosition);

  // Find session fastest lap
  let sessionFastest = Infinity;
  for (const r of rows) {
    if (r.lap.lastLapTimeInMS > 0 && r.lap.lastLapTimeInMS < sessionFastest) {
      sessionFastest = r.lap.lastLapTimeInMS;
    }
  }

  const DRIVER_STATUS = ['Garage', 'Flying', 'In Lap', 'Out Lap', 'On Track'];
  const RESULT_STATUS = { 0: '', 1: '', 2: 'DNF', 3: 'DSQ', 4: 'NC', 5: 'RET' };

  body.innerHTML = rows.map(r => {
    const isPlayer = r.idx === state.playerCarIndex;
    const isFastest = r.lap.lastLapTimeInMS === sessionFastest && sessionFastest < Infinity;
    const isPit = r.lap.pitStatus > 0;
    const isRetired = r.lap.resultStatus >= 2;
    const driverStatus = DRIVER_STATUS[r.lap.driverStatus] || '';
    const resultStr = RESULT_STATUS[r.lap.resultStatus] || '';
    const statusStr = resultStr || driverStatus;

    let rowCls = '';
    if (isPlayer)  rowCls = 'tt-player';
    if (isFastest) rowCls += ' tt-fastest';
    if (isPit)     rowCls += ' tt-pit';
    if (isRetired) rowCls += ' tt-retired';

    const compound = r.status?.tyreCompoundName || '—';
    const compCls = compound.toLowerCase();

    const gapLeader = r.lap.carPosition === 1 ? 'LEAD' : '+' + fmtDelta(r.lap.deltaToLeaderInMS);
    const gapAhead = r.lap.carPosition === 1 ? '—' : '+' + fmtDelta(r.lap.deltaToCarInFrontInMS);
    const lastLap = r.lap.lastLapTimeInMS > 0 ? fmtTime(r.lap.lastLapTimeInMS) : '—';

    return `<tr class="${rowCls}">
      <td class="tt-pos">${r.lap.carPosition}</td>
      <td>${r.name}</td>
      <td>${gapLeader}</td>
      <td>${gapAhead}</td>
      <td>${lastLap}</td>
      <td>—</td>
      <td><span class="tt-compound ${compCls}">${compound}</span></td>
      <td>${r.lap.numPitStops || 0}</td>
      <td>${statusStr}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// 22. RECORDING STATUS
// ══════════════════════════════════════════════════════════════════════════════

function onRecStatus(data) {
  state.isRecording = data.isRecording;
  state.recLapCount = data.lapCount || 0;

  const btn = el('btn-rec-toggle');
  if (!btn) return;
  if (data.isRecording) {
    btn.className   = 'rec-btn rec-active';
    btn.textContent = `● REC ${data.lapCount || 0} laps`;
    playNotification('recStart');
  } else {
    btn.className   = 'rec-btn rec-off';
    btn.textContent = '○ REC';
  }

  // Refresh live session tab if visible
  const sessionPanel = el('tab-session');
  if (sessionPanel?.classList.contains('active')) {
    loadLiveSession();
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 23. TUNNEL STATUS
// ══════════════════════════════════════════════════════════════════════════════

function onTunnelStatus(data) { renderTunnelStatus(data); }

function renderTunnelStatus(data) {
  const urlEl  = el('tunnel-url-display');
  const btnEl  = el('btn-tunnel-toggle');

  if (urlEl) {
    if (data.active && data.url) {
      urlEl.innerHTML = `<a href="${data.url}" target="_blank" rel="noreferrer">${data.url}</a>`;
    } else {
      urlEl.textContent = '';
    }
  }

  if (btnEl) {
    btnEl.textContent = data.active ? 'Stop Tunnel' : 'Start Tunnel';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 24. TAB SWITCHING
// ══════════════════════════════════════════════════════════════════════════════

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = el('tab-' + tabId);
  if (panel) panel.classList.add('active');

  if (tabId === 'session')  startLiveSessionPolling();
  else                      stopLiveSessionPolling();
  if (tabId === 'history')  loadSessions();
  if (tabId === 'settings') loadSettings();
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 25. KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════════════════════════

function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case '1': switchTab('dashboard'); break;
      case '2': switchTab('timing');    break;
      case '3': switchTab('race');      break;
      case '4': switchTab('session');   break;
      case '5': switchTab('history');   break;
      case '6': switchTab('settings');  break;
      case 'Escape':
        closeLapContextMenu();
        closeCompareModal();
        break;
      case 'r': case 'R':
        toggleRecording();
        break;
      case 'f': case 'F':
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen();
        }
        break;
      case '?':
        const overlay = el('shortcuts-overlay');
        if (overlay) overlay.classList.toggle('overlay-hidden');
        break;
    }
  });
}

async function toggleRecording() {
  if (state.isRecording) {
    await fetch('/api/recordings/stop', { method: 'POST' });
  } else {
    await fetch('/api/recordings/start', { method: 'POST' });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 26. NOTIFICATION SOUNDS
// ══════════════════════════════════════════════════════════════════════════════

function initAudio() {
  // Create AudioContext on first user interaction
  const activate = () => {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    document.removeEventListener('click', activate);
    document.removeEventListener('keydown', activate);
  };
  document.addEventListener('click', activate);
  document.addEventListener('keydown', activate);
}

function playNotification(type) {
  if (!state.notificationsEnabled || !state.audioCtx) return;
  const ctx = state.audioCtx;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.15, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

  switch (type) {
    case 'flag':
      osc.frequency.setValueAtTime(880, now);
      osc.type = 'square';
      break;
    case 'safetyCar':
      osc.frequency.setValueAtTime(660, now);
      osc.type = 'sawtooth';
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      break;
    case 'pitWindow':
      osc.frequency.setValueAtTime(520, now);
      osc.type = 'sine';
      break;
    case 'recStart':
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(660, now + 0.1);
      osc.type = 'sine';
      break;
    case 'disconnect':
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.setValueAtTime(220, now + 0.1);
      osc.type = 'sine';
      break;
    default:
      osc.frequency.setValueAtTime(440, now);
      osc.type = 'sine';
  }

  osc.start(now);
  osc.stop(now + 0.3);
}

// ══════════════════════════════════════════════════════════════════════════════
// 27. HISTORY TAB
// ══════════════════════════════════════════════════════════════════════════════

async function loadSessions() {
  try {
    const res  = await fetch('/api/recordings');
    const list = await res.json();
    renderSessionList(list);
  } catch (err) {
    console.error('loadSessions error:', err);
  }
}

function renderSessionList(sessions) {
  const container = el('session-list');
  if (!container) return;

  if (!sessions || sessions.length === 0) {
    container.innerHTML = '<div class="empty-msg">No sessions recorded yet.</div>';
    return;
  }

  container.innerHTML = sessions.map(s => {
    const bestStr = s.bestLapMs ? fmtTime(s.bestLapMs) : '—';
    const raceIcon = s.hasRaceData ? ' 🏁' : '';
    return `
      <div class="session-item${s.id === state.currentSessionId ? ' active' : ''}" data-id="${s.id}">
        <input type="checkbox" class="session-cb" data-sid="${s.id}" onclick="event.stopPropagation(); toggleSessionSelect('${s.id}')">
        <div class="si-content" onclick="loadSessionDetail('${s.id}')">
          <div class="si-track">${s.track}${raceIcon}</div>
          <div class="si-type">${s.sessionType}</div>
          <div class="si-date">${fmtDate(s.startTime)}</div>
          <div class="si-stats">${s.lapCount} laps &nbsp;|&nbsp; Best: ${bestStr}</div>
        </div>
      </div>`;
  }).join('');
}

async function loadSessionDetail(id) {
  state.currentSessionId = id;

  document.querySelectorAll('.session-item').forEach(item => {
    item.classList.toggle('active', item.dataset.id === id);
  });

  try {
    const res     = await fetch(`/api/recordings/${id}`);
    const session = await res.json();
    state.currentSession = session;

    el('history-placeholder').style.display = 'none';
    el('history-detail').style.display = 'flex';

    const validLaps = (session.laps || []).filter(l => l.valid && l.lapTimeMs > 0);
    const bestMs    = validLaps.length ? Math.min(...validLaps.map(l => l.lapTimeMs)) : null;

    setText('sh-track', session.track);
    setText('sh-type',  session.sessionType);
    setText('sh-date',  fmtDate(session.startTime));
    setText('sh-best',  bestMs ? 'Best: ' + fmtTime(bestMs) : 'No valid laps');
    setText('sh-laps',  (session.laps || []).length + ' laps');

    renderLapTable(session);
    renderHistorySetup(session);

    // Populate chart lap selectors
    populateChartSelectors(session);

    // Hide charts when switching sessions
    const chartSection = el('chart-section');
    if (chartSection) chartSection.style.display = 'none';

    // Show race analysis if raceData exists
    renderRaceAnalysis(session);

    // Consistency stats (#11)
    renderConsistencyStats(session);

    // Stint analysis charts (#3, #5, #7)
    renderStintCharts(session);

    // Track map (#1)
    renderHistoryTrackMap(session, 0);

    // Driver comparison (#12) — only for race sessions
    renderDriverComparison(session);
  } catch (err) {
    console.error('loadSessionDetail error:', err);
  }
}

function renderLapTable(session) {
  const body = el('lap-table-body');
  if (!body) return;

  const laps = (session.laps || []).filter(l => !l.deleted);
  const validTimes = laps.filter(l => l.valid && l.lapTimeMs > 0).map(l => l.lapTimeMs);
  const bestMs     = validTimes.length ? Math.min(...validTimes) : null;

  body.innerHTML = laps.map((lap, idx) => {
    const isBest    = bestMs && lap.lapTimeMs === bestMs && lap.valid;
    const isInvalid = !lap.valid;
    const rowCls    = isBest ? 'best-lap' : isInvalid ? 'invalid-lap' : '';
    const noteIcon  = lap.notes ? ' 📝' : '';

    const spd = state.speedUnit === 'mph'
      ? Math.round((lap.maxSpeed || 0) * 0.621371) + ' mph'
      : (lap.maxSpeed || 0) + ' km/h';

    // Find real index in original array (including deleted)
    const realIdx = session.laps.indexOf(lap);

    return `<tr class="${rowCls}" data-lap-idx="${realIdx}" data-lap-num="${lap.lapNum}" onclick="showLapCharts(${realIdx})" title="${lap.notes || ''}">
      <td>${lap.lapNum}${noteIcon}</td>
      <td>${lap.lapTimeMs ? fmtTime(lap.lapTimeMs) : '—'}</td>
      <td>${lap.s1Ms ? fmtSector(lap.s1Ms) : '—'}</td>
      <td>${lap.s2Ms ? fmtSector(lap.s2Ms) : '—'}</td>
      <td>${lap.s3Ms ? fmtSector(lap.s3Ms) : '—'}</td>
      <td>${lap.compound || '—'}</td>
      <td>${lap.tyreAge ?? '—'}</td>
      <td>${spd}</td>
      <td>${lap.valid ? '✓' : '✗'}</td>
    </tr>`;
  }).join('');
}

function renderHistorySetup(session) {
  const container = el('history-setup');
  const grid = el('history-setup-grid');
  if (!container || !grid) return;

  const s = session.setup;
  if (!s) {
    container.style.display = 'none';
    return;
  }

  container.style.display = '';
  const rows = [
    ['Front Wing', s.frontWing], ['Rear Wing', s.rearWing],
    ['Diff On', s.onThrottle + '%'], ['Diff Off', s.offThrottle + '%'],
    ['Front Camber', s.frontCamber?.toFixed(2) + '°'], ['Rear Camber', s.rearCamber?.toFixed(2) + '°'],
    ['Front Toe', s.frontToe?.toFixed(4) + '°'], ['Rear Toe', s.rearToe?.toFixed(4) + '°'],
    ['Front Susp', s.frontSuspension], ['Rear Susp', s.rearSuspension],
    ['Front ARB', s.frontAntiRollBar], ['Rear ARB', s.rearAntiRollBar],
    ['Front Height', s.frontSuspensionHeight], ['Rear Height', s.rearSuspensionHeight],
    ['Brake Pres', s.brakePressure + '%'], ['Brake Bias', s.brakeBias + '%'],
    ['Tyre FL', s.frontLeftTyrePressure?.toFixed(1) + ' psi'], ['Tyre FR', s.frontRightTyrePressure?.toFixed(1) + ' psi'],
    ['Tyre RL', s.rearLeftTyrePressure?.toFixed(1) + ' psi'], ['Tyre RR', s.rearRightTyrePressure?.toFixed(1) + ' psi'],
    ['Fuel Load', s.fuelLoad?.toFixed(1) + ' kg'],
  ];

  grid.innerHTML = rows.map(([lbl, val]) =>
    `<div class="setup-row"><span class="setup-lbl">${lbl}</span><span class="setup-val">${val ?? '—'}</span></div>`
  ).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// 28. TELEMETRY CHARTS (Feature 3) — uPlot
// ══════════════════════════════════════════════════════════════════════════════

function populateChartSelectors(session) {
  const sel1 = el('chart-lap-select');
  const sel2 = el('chart-compare-select');
  if (!sel1 || !sel2) return;

  const laps = session.laps || [];
  sel1.innerHTML = laps.map((l, i) => `<option value="${i}">Lap ${l.lapNum}</option>`).join('');
  sel2.innerHTML = '<option value="">Compare with...</option>' +
    laps.map((l, i) => `<option value="${i}">Lap ${l.lapNum}</option>`).join('');
}

function showLapCharts(lapIdx) {
  const session = state.currentSession;
  if (!session || !session.frames || session.frames.length === 0) return;
  if (!session.laps || !session.laps[lapIdx]) return;

  state.selectedLapIdx = lapIdx;
  state.compareLapIdx = null;

  const chartSection = el('chart-section');
  if (chartSection) chartSection.style.display = 'block';

  const sel1 = el('chart-lap-select');
  if (sel1) sel1.value = lapIdx;
  const sel2 = el('chart-compare-select');
  if (sel2) sel2.value = '';

  // Highlight selected row
  document.querySelectorAll('#lap-table-body tr').forEach(tr => {
    tr.classList.toggle('selected-lap', tr.dataset.lapIdx == lapIdx);
  });

  renderCharts(session, lapIdx, null);
}

function renderCharts(session, lapIdx, compareIdx) {
  // Destroy old charts
  state.chartInstances.forEach(c => c.destroy());
  state.chartInstances = [];

  const lap = session.laps[lapIdx];
  const frames = session.frames.slice(lap.startFrameIdx, (lap.endFrameIdx || session.frames.length) + 1);

  if (frames.length < 2) return;

  // Build X axis (frame index as time proxy)
  const xData = frames.map((_, i) => i);

  // Compare lap frames
  let cmpFrames = null;
  let cmpX = null;
  if (compareIdx !== null && session.laps[compareIdx]) {
    const cmpLap = session.laps[compareIdx];
    cmpFrames = session.frames.slice(cmpLap.startFrameIdx, (cmpLap.endFrameIdx || session.frames.length) + 1);
    cmpX = cmpFrames.map((_, i) => i);
  }

  const W = Math.min(800, (el('chart-section')?.clientWidth || 800) - 20);

  // Sector boundary overlays
  const sectorIndices = findSectorBoundaries(frames, lap);
  const sectorPlugin = sectorOverlayPlugin(sectorIndices);

  // Speed chart
  renderSingleChart('chart-speed', 'Speed', W,
    xData, frames.map(f => f.s), 'km/h', '#f0f0f0',
    cmpX, cmpFrames?.map(f => f.s), '#3b82f6', [sectorPlugin]);

  // Throttle/Brake overlay
  renderDualChart('chart-inputs', 'Throttle / Brake', W,
    xData, frames.map(f => f.th), frames.map(f => f.br),
    'Throttle %', 'Brake %', '#39d353', '#e8002d',
    cmpX, cmpFrames?.map(f => f.th), cmpFrames?.map(f => f.br), [sectorPlugin]);

  // Gear chart
  renderSingleChart('chart-gear', 'Gear', W,
    xData, frames.map(f => f.g), '', '#f5c518',
    cmpX, cmpFrames?.map(f => f.g), '#3b82f6', [sectorPlugin]);

  // Delta chart (only shown when comparing)
  renderDeltaChart('chart-delta', W, frames, cmpFrames);

  // Mini-sectors (#10)
  renderMiniSectors(session, lapIdx, compareIdx);

  // AI coaching hints (#17)
  generateCoachingHints(session, lapIdx);

  // Show variance controls
  const vc = el('variance-controls');
  if (vc) vc.style.display = 'block';

  // Update track map to selected lap
  renderHistoryTrackMap(session, lapIdx);
}

// Sector overlay plugin — draws vertical lines at sector boundaries
function sectorOverlayPlugin(sectorFrameIndices) {
  if (!sectorFrameIndices || sectorFrameIndices.length === 0) return {};
  const colors = ['rgba(160, 32, 240, 0.4)', 'rgba(255, 215, 0, 0.4)'];
  return {
    hooks: {
      draw: [
        (u) => {
          const ctx = u.ctx;
          const { left, top, height: plotH } = u.bbox;
          ctx.save();
          sectorFrameIndices.forEach((fi, i) => {
            const xPos = u.valToPos(fi, 'x', true);
            if (xPos < left) { ctx.restore(); return; }
            ctx.beginPath();
            ctx.strokeStyle = colors[i] || '#888';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.moveTo(xPos, top);
            ctx.lineTo(xPos, top + plotH);
            ctx.stroke();
          });
          ctx.restore();
        },
      ],
    },
  };
}

// Find frame indices where each sector ends
function findSectorBoundaries(frames, lap) {
  if (!lap || !lap.s1Ms || !lap.s2Ms) return [];
  const s1End = lap.s1Ms;
  const s2End = lap.s1Ms + lap.s2Ms;
  const indices = [];
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].t >= s1End) { indices.push(i); break; }
  }
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].t >= s2End) { indices.push(i); break; }
  }
  return indices;
}

function renderSingleChart(containerId, title, width, x, y, unit, color, cmpX, cmpY, cmpColor, extraPlugins) {
  const container = el(containerId);
  if (!container || typeof uPlot === 'undefined') return;
  container.innerHTML = '';

  const series = [
    {},
    { label: title, stroke: color, width: 1.5 },
  ];
  const data = [x, y];

  if (cmpX && cmpY) {
    const resampled = resampleToLength(cmpY, x.length);
    series.push({ label: title + ' (cmp)', stroke: cmpColor, width: 1, dash: [4, 4] });
    data.push(resampled);
  }

  const plugins = (extraPlugins || []).filter(p => p && p.hooks);

  const opts = {
    width,
    height: 150,
    title,
    plugins,
    scales: { x: { time: false } },
    axes: [
      { show: false },
      { stroke: '#555575', grid: { stroke: '#1c1c2e' } },
    ],
    series,
    cursor: { show: true },
    legend: { show: false },
  };

  const chart = new uPlot(opts, data, container);
  state.chartInstances.push(chart);
}

function renderDualChart(containerId, title, width, x, y1, y2, label1, label2, color1, color2, cmpX, cmpY1, cmpY2, extraPlugins) {
  const container = el(containerId);
  if (!container || typeof uPlot === 'undefined') return;
  container.innerHTML = '';

  const series = [
    {},
    { label: label1, stroke: color1, width: 1.5 },
    { label: label2, stroke: color2, width: 1.5 },
  ];
  const data = [x, y1, y2];

  if (cmpX && cmpY1 && cmpY2) {
    const r1 = resampleToLength(cmpY1, x.length);
    const r2 = resampleToLength(cmpY2, x.length);
    series.push({ label: label1 + ' (cmp)', stroke: color1, width: 1, dash: [4, 4] });
    series.push({ label: label2 + ' (cmp)', stroke: color2, width: 1, dash: [4, 4] });
    data.push(r1, r2);
  }

  const plugins = (extraPlugins || []).filter(p => p && p.hooks);

  const opts = {
    width,
    height: 150,
    title,
    plugins,
    scales: { x: { time: false } },
    axes: [
      { show: false },
      { stroke: '#555575', grid: { stroke: '#1c1c2e' } },
    ],
    series,
    cursor: { show: true },
    legend: { show: false },
  };

  const chart = new uPlot(opts, data, container);
  state.chartInstances.push(chart);
}

function resampleToLength(arr, targetLen) {
  if (!arr || arr.length === 0) return new Array(targetLen).fill(0);
  if (arr.length === targetLen) return arr;
  const result = [];
  for (let i = 0; i < targetLen; i++) {
    const srcIdx = (i / targetLen) * arr.length;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, arr.length - 1);
    const frac = srcIdx - lo;
    result.push(arr[lo] * (1 - frac) + arr[hi] * frac);
  }
  return result;
}

function renderDeltaChart(containerId, width, baseFrames, cmpFrames) {
  const container = el(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (!cmpFrames || cmpFrames.length < 2 || baseFrames.length < 2) {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';

  // Resample compare lap times to match base lap length
  const baseTimes = baseFrames.map(f => f.t || 0);
  const cmpTimes  = cmpFrames.map(f => f.t || 0);
  const resampledCmp = resampleToLength(cmpTimes, baseTimes.length);

  // Delta = compare time - base time (positive = base is faster/ahead)
  const xData = baseTimes.map((_, i) => i);
  const deltaData = baseTimes.map((bt, i) => {
    const dt = (resampledCmp[i] - bt) / 1000; // seconds
    return +dt.toFixed(3);
  });

  // Fill plugin for green (ahead) / red (behind)
  const fillPlugin = {
    hooks: {
      drawSeries: [
        (u, si) => {
          if (si !== 1) return;
          const ctx = u.ctx;
          const { left, top, width: plotW, height: plotH } = u.bbox;
          const zeroY = u.valToPos(0, 'y', true);

          ctx.save();
          ctx.beginPath();
          ctx.rect(left, top, plotW, plotH);
          ctx.clip();

          const path = u.series[1]._paths;
          if (!path) { ctx.restore(); return; }
          const stroke = path.stroke;
          if (!stroke) { ctx.restore(); return; }

          // Fill above zero (green = ahead)
          ctx.beginPath();
          const p2d = new Path2D(stroke);
          ctx.save();
          ctx.clip(p2d);
          ctx.fillStyle = 'rgba(57, 211, 83, 0.15)';
          ctx.fillRect(left, top, plotW, zeroY - top);
          ctx.restore();

          // Fill below zero (red = behind)
          ctx.save();
          ctx.clip(new Path2D(stroke));
          ctx.fillStyle = 'rgba(232, 0, 45, 0.15)';
          ctx.fillRect(left, zeroY, plotW, top + plotH - zeroY);
          ctx.restore();

          ctx.restore();
        },
      ],
    },
  };

  const opts = {
    width,
    height: 120,
    title: 'Delta (s)',
    plugins: [fillPlugin],
    scales: { x: { time: false } },
    axes: [
      { show: false },
      {
        stroke: '#555575',
        grid: { stroke: '#1c1c2e' },
        values: (_, vals) => vals.map(v => (v > 0 ? '+' : '') + v.toFixed(2)),
      },
    ],
    series: [
      {},
      {
        label: 'Delta',
        stroke: (u, si) => {
          // Gradient: use last value to decide color
          return '#f0f0f0';
        },
        width: 2,
        fill: (u, si) => {
          // Don't use series fill — plugin does it
          return 'transparent';
        },
      },
    ],
    cursor: { show: true },
    legend: { show: false },
  };

  const chart = new uPlot(opts, [xData, deltaData], container);
  state.chartInstances.push(chart);
}

function initChartControls() {
  const sel1 = el('chart-lap-select');
  const sel2 = el('chart-compare-select');
  const btnClose = el('btn-close-charts');

  if (sel1) sel1.addEventListener('change', () => {
    state.selectedLapIdx = parseInt(sel1.value, 10);
    const cmp = sel2?.value ? parseInt(sel2.value, 10) : null;
    if (state.currentSession) renderCharts(state.currentSession, state.selectedLapIdx, cmp);
  });

  if (sel2) sel2.addEventListener('change', () => {
    const cmp = sel2.value ? parseInt(sel2.value, 10) : null;
    state.compareLapIdx = cmp;
    if (state.currentSession && state.selectedLapIdx !== null) {
      renderCharts(state.currentSession, state.selectedLapIdx, cmp);
    }
  });

  if (btnClose) btnClose.addEventListener('click', () => {
    const cs = el('chart-section');
    if (cs) cs.style.display = 'none';
    state.chartInstances.forEach(c => c.destroy());
    state.chartInstances = [];
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 29. EXPORT
// ══════════════════════════════════════════════════════════════════════════════

function exportCSV(session) {
  const laps = session.laps || [];
  const header = ['Lap','Time','S1','S2','S3','Compound','TyreAge','MaxSpeed','Valid'];
  const rows = laps.map(l => [
    l.lapNum, fmtTime(l.lapTimeMs), fmtSector(l.s1Ms), fmtSector(l.s2Ms), fmtSector(l.s3Ms),
    l.compound, l.tyreAge, l.maxSpeed, l.valid ? 'Yes' : 'No',
  ]);

  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  downloadBlob(csv, 'text/csv', `${session.track}_${session.sessionType}_laps_${fmtDateFile(session.startTime)}.csv`);
}

function exportTelemetryCSV(session) {
  const frames = session.frames || [];
  if (frames.length === 0) return;

  const header = ['Frame','LapTime','Speed','Throttle','Brake','Gear','RPM','DRS','Steer','Lap','Position',
    'TyreSurfRL','TyreSurfRR','TyreSurfFL','TyreSurfFR','Fuel','ERS','GLateral','GLongitudinal'];
  const rows = frames.map((f, i) => [
    i, f.t, f.s, f.th, f.br, f.g, f.r, f.d, f.st, f.ln, f.p,
    ...(f.ts || [0,0,0,0]), f.fl, f.er, f.gL, f.gN,
  ]);

  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  downloadBlob(csv, 'text/csv', `${session.track}_${session.sessionType}_telemetry_${fmtDateFile(session.startTime)}.csv`);
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function deleteSession(id) {
  if (!confirm('Delete this session? This cannot be undone.')) return;
  try {
    await fetch(`/api/recordings/${id}`, { method: 'DELETE' });
    state.currentSessionId = null;
    state.currentSession   = null;
    el('history-placeholder').style.display = '';
    el('history-detail').style.display = 'none';
    loadSessions();
  } catch (err) {
    console.error('deleteSession error:', err);
  }
}

function initHistoryButtons() {
  const btnExport = el('btn-export-csv');
  const btnTelemetry = el('btn-export-telemetry');
  const btnDelete = el('btn-delete-session');

  if (btnExport) btnExport.addEventListener('click', () => {
    if (state.currentSession) exportCSV(state.currentSession);
  });
  if (btnTelemetry) btnTelemetry.addEventListener('click', () => {
    if (state.currentSession) exportTelemetryCSV(state.currentSession);
  });
  if (btnDelete) btnDelete.addEventListener('click', () => {
    if (state.currentSessionId) deleteSession(state.currentSessionId);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 30. SETTINGS TAB
// ══════════════════════════════════════════════════════════════════════════════

async function loadSettings() {
  await Promise.all([loadSettingsData(), loadNetworkInfo()]);
}

async function loadSettingsData() {
  try {
    const res  = await fetch('/api/settings');
    const cfg  = await res.json();
    applySettingsToForm(cfg);

    const tRes  = await fetch('/api/tunnel');
    const tData = await tRes.json();
    renderTunnelStatus(tData);
  } catch (err) {
    console.error('loadSettingsData error:', err);
  }
}

function applySettingsToForm(cfg) {
  setInputVal('s-udp-port',        cfg.udpPort);
  setInputVal('s-http-port',       cfg.httpPort);
  setChecked( 's-auto-record',     cfg.recording?.autoRecord ?? true);
  setChecked( 's-capture-frames',  cfg.recording?.captureFrames ?? true);
  setInputVal('s-frame-interval',  cfg.recording?.frameInterval ?? 3);
  setInputVal('s-max-sessions',    cfg.recording?.maxSessions ?? 50);
  setInputVal('s-tunnel-subdomain',cfg.tunnel?.subdomain || '');

  const unitSel = el('s-speed-unit');
  if (unitSel) unitSel.value = cfg.display?.speedUnit || 'kmh';

  setChecked('s-show-trackmap', cfg.display?.showTrackMap !== false);
  setChecked('s-notifications', cfg.notifications?.enabled ?? false);

  // Apply to state
  state.speedUnit = cfg.display?.speedUnit || 'kmh';
  state.notificationsEnabled = cfg.notifications?.enabled ?? false;

  const unitLabel = el('speed-unit');
  if (unitLabel) unitLabel.textContent = state.speedUnit === 'mph' ? 'MPH' : 'KM/H';
}

async function saveSettings() {
  const cfg = {
    udpPort:  parseInt(elVal('s-udp-port'),  10),
    httpPort: parseInt(elVal('s-http-port'), 10),
    tunnel: {
      subdomain: elVal('s-tunnel-subdomain'),
    },
    recording: {
      autoRecord:    isChecked('s-auto-record'),
      captureFrames: isChecked('s-capture-frames'),
      frameInterval: parseInt(elVal('s-frame-interval'), 10),
      maxSessions:   parseInt(elVal('s-max-sessions'),   10),
    },
    display: {
      speedUnit: elVal('s-speed-unit'),
      showTrackMap: isChecked('s-show-trackmap'),
    },
    notifications: {
      enabled: isChecked('s-notifications'),
    },
  };

  try {
    await fetch('/api/settings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(cfg),
    });

    state.speedUnit = cfg.display.speedUnit;
    state.notificationsEnabled = cfg.notifications.enabled;

    const unitLabel = el('speed-unit');
    if (unitLabel) unitLabel.textContent = state.speedUnit === 'mph' ? 'MPH' : 'KM/H';

    const status = el('settings-save-status');
    if (status) {
      status.textContent = 'Saved!';
      setTimeout(() => { status.textContent = ''; }, 2000);
    }
  } catch (err) {
    console.error('saveSettings error:', err);
  }
}

async function loadNetworkInfo() {
  try {
    const res  = await fetch('/api/network');
    const data = await res.json();

    const ipsEl = el('local-ips');
    if (ipsEl && data.ips) {
      ipsEl.innerHTML = data.ips
        .map(i => `http://${i.address}:${data.httpPort}`)
        .join('<br>');
    }
  } catch (err) {
    console.error('loadNetworkInfo error:', err);
  }
}

async function startTunnel() {
  const subdomain = elVal('s-tunnel-subdomain').trim();
  const btn = el('btn-tunnel-toggle');
  if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }

  try {
    const res  = await fetch('/api/tunnel/start', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ subdomain }),
    });
    const data = await res.json();
    renderTunnelStatus(data);
  } catch (err) {
    console.error('startTunnel error:', err);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function stopTunnel() {
  try {
    await fetch('/api/tunnel/stop', { method: 'POST' });
    renderTunnelStatus({ active: false, url: null });
  } catch (err) {
    console.error('stopTunnel error:', err);
  }
}

function initSettingsButtons() {
  const btnSave = el('btn-save-settings');
  if (btnSave) btnSave.addEventListener('click', saveSettings);

  const btnTunnel = el('btn-tunnel-toggle');
  if (btnTunnel) {
    btnTunnel.addEventListener('click', () => {
      const isActive = btnTunnel.textContent === 'Stop Tunnel';
      isActive ? stopTunnel() : startTunnel();
    });
  }
}

function initRecButton() {
  const btnRec = el('btn-rec-toggle');
  if (btnRec) {
    btnRec.addEventListener('click', toggleRecording);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 31. COLOUR HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function tyreTempColor(t) {
  if (!t || t === 0) return 'var(--grey)';
  if (t < 60)  return '#4a90e2';
  if (t < 80)  return '#27ae60';
  if (t < 100) return '#2ecc71';
  if (t < 120) return '#f5c518';
  if (t < 140) return 'var(--orange)';
  return 'var(--red)';
}

function brakeTempColor(t) {
  if (t < 100) return 'var(--grey)';
  if (t < 300) return '#4a90e2';
  if (t < 500) return 'var(--green)';
  if (t < 700) return 'var(--yellow)';
  if (t < 900) return 'var(--orange)';
  return 'var(--red)';
}

function rpmColor(pct) {
  if (pct < 70) return 'var(--green)';
  if (pct < 90) return 'var(--orange)';
  return 'var(--red)';
}

function wearColor(pct) {
  if (pct < 30) return 'var(--green)';
  if (pct < 60) return 'var(--yellow)';
  if (pct < 80) return 'var(--orange)';
  return 'var(--red)';
}

// ══════════════════════════════════════════════════════════════════════════════
// 32. DOM HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function el(id)         { return document.getElementById(id); }
function elVal(id)      { const e = el(id); return e ? e.value : ''; }
function setInputVal(id, v) { const e = el(id); if (e) e.value = v; }
function isChecked(id)  { const e = el(id); return e ? e.checked : false; }
function setChecked(id, v) { const e = el(id); if (e) e.checked = !!v; }

function setText(id, val) {
  const e = el(id);
  if (e) e.textContent = val;
}

function setWidth(id, pct) {
  const e = el(id);
  if (e) e.style.width = clamp(pct) + '%';
}

function setHeight(id, pct) {
  const e = el(id);
  if (e) e.style.height = clamp(pct) + '%';
}

function setBadge(id, active, activeClass) {
  const e = el(id);
  if (!e) return;
  e.className = 'badge' + (active ? ' ' + activeClass : '');
}

function clamp(v) { return Math.max(0, Math.min(100, v)); }

function setTyreTempUI(pos, surfT, innerT, pressure) {
  const surfEl  = el(pos + '-surf');
  const innerEl = el(pos + '-inner');
  const presEl  = el(pos + '-pres');
  const corner  = el('tc-' + pos);

  if (surfEl)  { surfEl.textContent  = surfT + '°';  surfEl.style.color  = tyreTempColor(surfT); }
  if (innerEl) { innerEl.textContent = innerT + '°'; innerEl.style.color = tyreTempColor(innerT); }
  if (presEl)  { presEl.textContent  = pressure.toFixed(1) + ' psi'; }
  if (corner)  { corner.style.borderColor = tyreTempColor(surfT); }
}

function setBrakeTempUI(id, temp) {
  const e = el(id);
  if (!e) return;
  e.textContent = temp + '°';
  e.style.color = brakeTempColor(temp);
}

// ══════════════════════════════════════════════════════════════════════════════
// 33. TIME FORMATTERS
// ══════════════════════════════════════════════════════════════════════════════

function fmtTime(ms) {
  if (!ms || ms === 0) return '—';
  const mins  = Math.floor(ms / 60000);
  const secs  = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${mins}:${pad2(secs)}.${pad3(milli)}`;
}

function fmtSector(ms) {
  if (!ms || ms === 0) return '—';
  const secs  = Math.floor(ms / 1000);
  const milli = ms % 1000;
  return `${secs}.${pad3(milli)}`;
}

function fmtDelta(ms) {
  return (ms / 1000).toFixed(3) + 's';
}

function fmtDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateFile(ts) {
  if (!ts) return 'unknown';
  const d = new Date(ts);
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function pad2(n) { return String(n).padStart(2, '0'); }
function pad3(n) { return String(n).padStart(3, '0'); }

// ══════════════════════════════════════════════════════════════════════════════
// 35. RACE ENGINEER MODE
// ══════════════════════════════════════════════════════════════════════════════

const TEAM_COLORS = {
  0: '#00e5ff', 1: '#dc0000', 2: '#00d2be', 3: '#ff8000', 4: '#0600ef',
  5: '#006f62', 6: '#2293d1', 7: '#b6babd', 8: '#52e252', 9: '#1868db',
  255: '#888888',
};

const COMPOUND_COLORS = {
  SOFT: '#ff3333', MEDIUM: '#ffcc00', HARD: '#ffffff',
  INTER: '#33cc33', WET: '#3399ff', UNKNOWN: '#888888',
};

const DRIVER_STATUS = ['Garage', 'Flying', 'In Lap', 'Out Lap', 'On Track'];
const RESULT_STATUS = ['Invalid', 'Inactive', 'Active', 'Finished', 'DNF', 'DSQ', 'NC', 'RET'];

function updateRaceEngineer(data) {
  state.raceState = data;
  if (!data || !data.active) return;

  const body = el('race-table-body');
  if (!body) return;

  // Sort cars by position
  const cars = data.cars
    .map((c, i) => ({ ...c, idx: i }))
    .filter(c => c.name && c.position > 0)
    .sort((a, b) => a.position - b.position);

  body.innerHTML = cars.map(car => {
    const teamColor = TEAM_COLORS[car.teamId] || '#888';
    const isPlayer = car.idx === state.playerCarIndex;
    const isRetired = car.resultStatus >= 4;
    const isPit = car.driverStatus === 0;
    let cls = '';
    if (isPlayer) cls += ' tt-player';
    if (isPit) cls += ' tt-pit';
    if (isRetired) cls += ' tt-retired';

    const gapLeader = car.position === 1 ? 'LEAD' : car.gapToLeaderMs > 0 ? '+' + fmtGap(car.gapToLeaderMs) : '—';
    const gapAhead  = car.position === 1 ? '—'   : car.gapToAheadMs > 0  ? '+' + fmtGap(car.gapToAheadMs)  : '—';
    const compColor = COMPOUND_COLORS[car.currentCompound] || '#888';

    // Build stint history bar
    let stintHtml = '';
    if (car.stints && car.stints.length > 0) {
      const totalLaps = car.currentLap || 1;
      stintHtml = '<div class="stint-bar">';
      for (const stint of car.stints) {
        const width = Math.max(5, ((stint.endLap - stint.startLap + 1) / totalLaps) * 100);
        const color = COMPOUND_COLORS[stint.compound] || '#888';
        stintHtml += `<div class="stint-seg" style="width:${width}%;background:${color}" title="${stint.compound} L${stint.startLap}-${stint.endLap}"></div>`;
      }
      // Current stint
      const lastEnd = car.stints.length > 0 ? car.stints[car.stints.length - 1].endLap + 1 : 1;
      const currWidth = Math.max(5, ((car.currentLap - lastEnd + 1) / totalLaps) * 100);
      stintHtml += `<div class="stint-seg" style="width:${currWidth}%;background:${compColor}" title="${car.currentCompound} L${lastEnd}-now"></div>`;
      stintHtml += '</div>';
    } else if (car.currentCompound) {
      stintHtml = `<div class="stint-bar"><div class="stint-seg" style="width:100%;background:${compColor}"></div></div>`;
    }

    const status = isRetired ? (RESULT_STATUS[car.resultStatus] || 'RET') : (DRIVER_STATUS[car.driverStatus] || '');

    return `<tr class="${cls}" style="border-left:3px solid ${teamColor}">
      <td>${car.position}</td>
      <td class="driver-cell">${car.name}</td>
      <td>${car.lastLapMs ? fmtTime(car.lastLapMs) : '—'}</td>
      <td>${car.bestLapMs ? fmtTime(car.bestLapMs) : '—'}</td>
      <td>${gapLeader}</td>
      <td>${gapAhead}</td>
      <td><span class="tyre-dot" style="background:${compColor}"></span>${car.currentCompound || '—'}</td>
      <td>${car.tyreAge}</td>
      <td class="stint-cell">${stintHtml}</td>
      <td>${car.numPitStops}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');
}

function initRaceColumns() {
  const btn = el('btn-race-cols');
  const picker = el('race-col-picker');
  if (!btn || !picker) return;

  btn.addEventListener('click', () => {
    picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
  });

  picker.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const colIdx = parseInt(cb.dataset.col, 10);
      const table = el('race-table');
      if (!table) return;
      const show = cb.checked;
      // Toggle visibility for all cells in this column
      table.querySelectorAll(`tr`).forEach(row => {
        const cell = row.children[colIdx];
        if (cell) cell.style.display = show ? '' : 'none';
      });
    });
  });
}

function fmtGap(ms) {
  if (ms < 60000) return (ms / 1000).toFixed(3);
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// ══════════════════════════════════════════════════════════════════════════════
// 36. CONTEXT MENU
// ══════════════════════════════════════════════════════════════════════════════

let contextMenuTarget = null;

function initContextMenu() {
  const table = el('lap-table-body');
  if (!table) return;

  table.addEventListener('contextmenu', e => {
    e.preventDefault();
    const tr = e.target.closest('tr');
    if (!tr) return;
    contextMenuTarget = parseInt(tr.dataset.lapIdx);
    showLapContextMenu(e.clientX, e.clientY);
  });

  document.addEventListener('click', closeLapContextMenu);

  // Menu item handlers
  const menu = el('lap-context-menu');
  if (!menu) return;
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', async () => {
      const action = item.dataset.action;
      const session = state.currentSession;
      const lapIdx = contextMenuTarget;
      if (!session || lapIdx === null) return;

      closeLapContextMenu();

      switch (action) {
        case 'delete':
          if (confirm('Delete this lap from the recording?')) {
            await fetch(`/api/recordings/${session.id}/lap/${lapIdx}`, { method: 'DELETE' });
            loadSessionDetail(session.id);
          }
          break;
        case 'toggle-valid': {
          const lap = session.laps[lapIdx];
          await fetch(`/api/recordings/${session.id}/lap/${lapIdx}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valid: !lap.valid }),
          });
          loadSessionDetail(session.id);
          break;
        }
        case 'add-note': {
          const lap = session.laps[lapIdx];
          const note = prompt('Add note for this lap:', lap.notes || '');
          if (note !== null) {
            await fetch(`/api/recordings/${session.id}/lap/${lapIdx}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notes: note }),
            });
            loadSessionDetail(session.id);
          }
          break;
        }
        case 'compare':
          showLapCharts(lapIdx);
          break;
        case 'export-lap':
          exportSingleLapCSV(session, lapIdx);
          break;
      }
    });
  });
}

function showLapContextMenu(x, y) {
  const menu = el('lap-context-menu');
  if (!menu) return;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.remove('hidden');
}

function closeLapContextMenu() {
  const menu = el('lap-context-menu');
  if (menu) menu.classList.add('hidden');
}

function exportSingleLapCSV(session, lapIdx) {
  const lap = session.laps[lapIdx];
  if (!lap) return;
  const frames = session.frames.slice(lap.startFrameIdx, (lap.endFrameIdx || session.frames.length) + 1);
  const headers = ['Frame', 'LapTime', 'Speed', 'Throttle', 'Brake', 'Gear', 'RPM', 'DRS', 'Steer'];
  const rows = frames.map((f, i) =>
    [i, f.t, f.s, f.th, f.br, f.g, f.r, f.d, f.st].join(',')
  );
  const csv = [headers.join(','), ...rows].join('\n');
  downloadCSV(csv, `${session.track}_lap${lap.lapNum}_${fmtDateFile(session.startTime)}.csv`);
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════════════════════
// 37. BATCH SELECT
// ══════════════════════════════════════════════════════════════════════════════

function initBatchSelect() {
  const selectAllBtn = el('btn-select-all');
  const deleteBtn    = el('btn-delete-selected');
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      const cbs = document.querySelectorAll('.session-cb');
      const allChecked = Array.from(cbs).every(cb => cb.checked);
      cbs.forEach(cb => { cb.checked = !allChecked; toggleSessionSelect(cb.dataset.sid, !allChecked); });
    });
  }
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const ids = Array.from(state.selectedSessions);
      if (ids.length === 0) return;
      if (!confirm(`Delete ${ids.length} session(s)?`)) return;
      await fetch('/api/recordings/batch-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      state.selectedSessions.clear();
      loadSessions();
    });
  }
}

function toggleSessionSelect(id, force) {
  if (force !== undefined) {
    if (force) state.selectedSessions.add(id); else state.selectedSessions.delete(id);
  } else {
    if (state.selectedSessions.has(id)) state.selectedSessions.delete(id);
    else state.selectedSessions.add(id);
  }
  const toolbar = el('batch-toolbar');
  if (toolbar) toolbar.style.display = state.selectedSessions.size > 0 ? 'flex' : 'none';
}

// ══════════════════════════════════════════════════════════════════════════════
// 38. CROSS-SESSION COMPARISON MODAL
// ══════════════════════════════════════════════════════════════════════════════

function initCompareModal() {
  const cancelBtn = el('compare-modal-cancel');
  const loadBtn   = el('compare-modal-load');
  const sessSel   = el('compare-modal-session');

  if (cancelBtn) cancelBtn.addEventListener('click', closeCompareModal);
  if (loadBtn) loadBtn.addEventListener('click', loadExternalLap);
  if (sessSel) sessSel.addEventListener('change', async () => {
    const sid = sessSel.value;
    const lapSel = el('compare-modal-lap');
    if (!lapSel || !sid) return;
    try {
      const res = await fetch(`/api/recordings/${sid}`);
      const sess = await res.json();
      const laps = (sess.laps || []).filter(l => !l.deleted);
      lapSel.innerHTML = laps.map((l, i) =>
        `<option value="${i}">Lap ${l.lapNum} — ${l.lapTimeMs ? fmtTime(l.lapTimeMs) : '—'}</option>`
      ).join('');
    } catch (err) {
      console.error('Load session for compare:', err);
    }
  });

  // Add "Other Session..." option to compare selector
  const sel2 = el('chart-compare-select');
  if (sel2) {
    sel2.addEventListener('change', () => {
      if (sel2.value === 'external') {
        openCompareModal();
        sel2.value = '';
      }
    });
  }
}

async function openCompareModal() {
  const modal = el('compare-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  // Populate session list
  const sessSel = el('compare-modal-session');
  if (!sessSel) return;
  try {
    const res = await fetch('/api/recordings');
    const sessions = await res.json();
    sessSel.innerHTML = sessions.map(s =>
      `<option value="${s.id}">${s.track} — ${s.sessionType} — ${fmtDate(s.startTime)}</option>`
    ).join('');
    sessSel.dispatchEvent(new Event('change'));
  } catch (err) {
    console.error('Load sessions for compare:', err);
  }
}

function closeCompareModal() {
  const modal = el('compare-modal');
  if (modal) modal.classList.add('hidden');
}

async function loadExternalLap() {
  const sid = el('compare-modal-session')?.value;
  const lapIdx = el('compare-modal-lap')?.value;
  if (!sid || lapIdx === undefined) return;

  try {
    const res = await fetch(`/api/recordings/${sid}/lap/${lapIdx}`);
    const data = await res.json();
    closeCompareModal();

    // Render charts with external lap
    const session = state.currentSession;
    if (!session || state.selectedLapIdx === null) return;
    renderChartsWithExternal(session, state.selectedLapIdx, data);
  } catch (err) {
    console.error('Load external lap:', err);
  }
}

function renderChartsWithExternal(session, lapIdx, extData) {
  state.chartInstances.forEach(c => c.destroy());
  state.chartInstances = [];

  const lap = session.laps[lapIdx];
  const frames = session.frames.slice(lap.startFrameIdx, (lap.endFrameIdx || session.frames.length) + 1);
  if (frames.length < 2) return;

  const xData = frames.map((_, i) => i);
  const cmpFrames = extData.frames || [];
  const cmpX = cmpFrames.map((_, i) => i);
  const W = Math.min(800, (el('chart-section')?.clientWidth || 800) - 20);

  renderSingleChart('chart-speed', 'Speed', W,
    xData, frames.map(f => f.s), 'km/h', '#f0f0f0',
    cmpX, cmpFrames.map(f => f.s), '#3b82f6');

  renderDualChart('chart-inputs', 'Throttle / Brake', W,
    xData, frames.map(f => f.th), frames.map(f => f.br),
    'Throttle %', 'Brake %', '#39d353', '#e8002d',
    cmpX, cmpFrames.map(f => f.th), cmpFrames.map(f => f.br));

  renderSingleChart('chart-gear', 'Gear', W,
    xData, frames.map(f => f.g), '', '#f5c518',
    cmpX, cmpFrames.map(f => f.g), '#3b82f6');

  // Delta chart
  renderDeltaChart('chart-delta', W, frames, cmpFrames.length > 0 ? cmpFrames : null);
}

// ══════════════════════════════════════════════════════════════════════════════
// 39. RACE RESULTS VIEWER
// ══════════════════════════════════════════════════════════════════════════════

let raceAnalysisChart = null;

function renderRaceAnalysis(session) {
  const container = el('race-analysis');
  if (!container) return;

  // Only show race analysis for actual race sessions (not Time Trial / Practice)
  const rd = session.raceData;
  const isRace = /race|sprint/i.test(session.sessionType || '');
  if (!isRace || !rd || !rd.carLaps || Object.keys(rd.carLaps).length < 2) {
    container.style.display = 'none';
    return;
  }

  container.style.display = '';

  // Populate driver checkboxes
  const driverSel = el('race-driver-checkboxes');
  if (driverSel) {
    const participants = rd.participants || [];
    driverSel.innerHTML = Object.keys(rd.carLaps).map(idx => {
      const p = participants[idx] || {};
      const name = p.name || `Car ${idx}`;
      const color = TEAM_COLORS[p.teamId] || '#888';
      const checked = parseInt(idx) < 10 ? 'checked' : '';
      return `<label class="driver-cb-label" style="border-left:3px solid ${color}">
        <input type="checkbox" class="race-driver-cb" data-car-idx="${idx}" ${checked}> ${name}
      </label>`;
    }).join('');
  }

  // Metric selector
  const metricSel = el('race-metric-select');
  if (metricSel && !metricSel.dataset.bound) {
    metricSel.dataset.bound = '1';
    metricSel.addEventListener('change', () => drawRaceChart(session));
  }
  if (driverSel && !driverSel.dataset.bound) {
    driverSel.dataset.bound = '1';
    driverSel.addEventListener('change', () => drawRaceChart(session));
  }

  drawRaceChart(session);
}

function drawRaceChart(session) {
  const rd = session.raceData;
  if (!rd) return;

  const metric = el('race-metric-select')?.value || 'lapTime';
  const checkedDrivers = Array.from(document.querySelectorAll('.race-driver-cb:checked'))
    .map(cb => cb.dataset.carIdx);

  if (checkedDrivers.length === 0) return;

  // Destroy old chart
  if (raceAnalysisChart) { raceAnalysisChart.destroy(); raceAnalysisChart = null; }

  const participants = rd.participants || [];
  const maxLap = Math.max(...checkedDrivers.map(idx =>
    (rd.carLaps[idx] || []).length
  ));

  if (maxLap < 1) return;

  // Build data arrays
  const xData = Array.from({ length: maxLap }, (_, i) => i + 1);
  const series = [{ label: 'Lap' }];
  const data = [xData];

  for (const idx of checkedDrivers) {
    const laps = rd.carLaps[idx] || [];
    const p = participants[idx] || {};
    const color = TEAM_COLORS[p.teamId] || '#888';
    const name = p.name || `Car ${idx}`;

    series.push({
      label: name,
      stroke: color,
      width: 1.5,
    });

    const values = new Array(maxLap).fill(null);
    for (const lap of laps) {
      const i = lap.lapNum - 1;
      if (i < 0 || i >= maxLap) continue;
      switch (metric) {
        case 'lapTime':  values[i] = lap.lapTimeMs > 0 ? lap.lapTimeMs / 1000 : null; break;
        case 'position': values[i] = lap.position || null; break;
        case 'gap':      values[i] = lap.lapTimeMs > 0 ? lap.lapTimeMs / 1000 : null; break; // raw time, cumulative computed below
        case 'tyreAge':  values[i] = lap.tyreAge ?? null; break;
      }
    }
    data.push(values);
  }

  // For gap metric: convert raw lap times to cumulative gap vs leader
  if (metric === 'gap' && data.length > 2) {
    // Find leader: driver with lowest cumulative time
    const cumSums = data.slice(1).map(vals => {
      let sum = 0;
      return vals.map(v => { if (v != null) sum += v; return v != null ? sum : null; });
    });
    // Leader is the one with lowest final cumulative time
    const finalTimes = cumSums.map(c => c.filter(v => v != null).pop() || Infinity);
    const leaderIdx = finalTimes.indexOf(Math.min(...finalTimes));
    const leaderCum = cumSums[leaderIdx];
    // Replace data with gap to leader
    for (let d = 0; d < cumSums.length; d++) {
      data[d + 1] = cumSums[d].map((v, i) => {
        if (v == null || leaderCum[i] == null) return null;
        return +(v - leaderCum[i]).toFixed(2);
      });
    }
  }

  const chartEl = el('chart-race-analysis');
  if (!chartEl) return;
  chartEl.innerHTML = '';

  const W = Math.min(1000, chartEl.clientWidth || 800);

  const opts = {
    width: W,
    height: 350,
    scales: {
      x: { time: false },
      y: metric === 'position' ? { dir: -1 } : {},
    },
    axes: [
      { label: 'Lap', stroke: '#888', grid: { stroke: '#333' } },
      {
        label: metric === 'lapTime' ? 'Time (s)' : metric === 'position' ? 'Position' : metric === 'gap' ? 'Gap to Leader (s)' : metric === 'tyreAge' ? 'Tyre Age (laps)' : metric,
        stroke: '#888', grid: { stroke: '#222' },
        ...(metric === 'lapTime' ? {
          values: (_, vals) => vals.map(v => v !== null ? v.toFixed(1) : ''),
        } : {}),
      },
    ],
    series,
  };

  raceAnalysisChart = new uPlot(opts, data, chartEl);
}

// ══════════════════════════════════════════════════════════════════════════════
// 40. SETUP PER-LAP DISPLAY WITH DIFF
// ══════════════════════════════════════════════════════════════════════════════

// Override renderHistorySetup to show per-lap setups with diff highlighting
const _origRenderHistorySetup = renderHistorySetup;

renderHistorySetup = function(session) {
  const container = el('history-setup');
  const grid = el('history-setup-grid');
  if (!container || !grid) return;

  const s = session.setup;
  const lapSetups = session.lapSetups;

  if (!s && (!lapSetups || Object.keys(lapSetups).length === 0)) {
    container.style.display = 'none';
    return;
  }

  container.style.display = '';

  // If we have per-lap setups, show setup changes across laps
  if (lapSetups && Object.keys(lapSetups).length > 1) {
    const setupKeys = Object.keys(lapSetups).sort((a, b) => +a - +b);
    const setups = setupKeys.map(k => ({ lap: +k, setup: lapSetups[k] }));

    const fields = [
      ['Front Wing', 'frontWing', '', 0], ['Rear Wing', 'rearWing', '', 0],
      ['Diff On', 'onThrottle', '%', 0], ['Diff Off', 'offThrottle', '%', 0],
      ['Front Camber', 'frontCamber', '°', 2], ['Rear Camber', 'rearCamber', '°', 2],
      ['Front Toe', 'frontToe', '°', 4], ['Rear Toe', 'rearToe', '°', 4],
      ['Front Susp', 'frontSuspension', '', 0], ['Rear Susp', 'rearSuspension', '', 0],
      ['Front ARB', 'frontAntiRollBar', '', 0], ['Rear ARB', 'rearAntiRollBar', '', 0],
      ['Front Height', 'frontSuspensionHeight', '', 0], ['Rear Height', 'rearSuspensionHeight', '', 0],
      ['Brake Pres', 'brakePressure', '%', 0], ['Brake Bias', 'brakeBias', '%', 0],
      ['FL Pressure', 'frontLeftTyrePressure', ' psi', 1], ['FR Pressure', 'frontRightTyrePressure', ' psi', 1],
      ['RL Pressure', 'rearLeftTyrePressure', ' psi', 1], ['RR Pressure', 'rearRightTyrePressure', ' psi', 1],
    ];

    const fmtVal = (v, suffix, dec) => v == null ? '—' : (dec > 0 ? (+v).toFixed(dec) : v) + suffix;

    let html = `<div class="setup-diff-table"><table><thead><tr><th>Setting</th>`;
    for (const { lap } of setups) html += `<th>Lap ${lap}+</th>`;
    html += '</tr></thead><tbody>';

    for (const [label, key, suffix, dec] of fields) {
      const vals = setups.map(s => s.setup[key]);
      const hasChange = vals.some((v, i) => i > 0 && v !== vals[0]);
      html += `<tr class="${hasChange ? 'setup-diff-changed' : ''}"><td>${label}</td>`;
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i];
        let cls = '';
        if (i > 0 && v !== vals[i - 1]) {
          cls = v > vals[i - 1] ? 'setup-val-up' : 'setup-val-down';
        }
        html += `<td class="${cls}">${fmtVal(v, suffix, dec)}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    grid.innerHTML = html;
  } else {
    // Single setup — use original rendering
    _origRenderHistorySetup(session);
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 41. POPULATE COMPARE SELECT WITH EXTERNAL OPTION
// ══════════════════════════════════════════════════════════════════════════════

const _origPopulateChartSelectors = populateChartSelectors;

// Override to add "Other Session..." option
function populateChartSelectorsV2(session) {
  const sel1 = el('chart-lap-select');
  const sel2 = el('chart-compare-select');
  if (!sel1 || !sel2) return;

  const laps = (session.laps || []).filter(l => !l.deleted);
  sel1.innerHTML = laps.map((l, i) => {
    const realIdx = session.laps.indexOf(l);
    return `<option value="${realIdx}">Lap ${l.lapNum}</option>`;
  }).join('');
  sel2.innerHTML = '<option value="">Compare with...</option>' +
    laps.map((l, i) => {
      const realIdx = session.laps.indexOf(l);
      return `<option value="${realIdx}">Lap ${l.lapNum}</option>`;
    }).join('') +
    '<option value="external">Other Session...</option>';
}

// Monkey-patch
populateChartSelectors = populateChartSelectorsV2;

// ══════════════════════════════════════════════════════════════════════════════
// 42. RELATIVE TIMING BAR (#20)
// ══════════════════════════════════════════════════════════════════════════════

function updateRelativeBar() {
  const container = el('relative-bar-content');
  if (!container) return;
  const allLaps = state.allLapData?.allCars;
  const parts = state.allParticipants?.participants || state.allParticipants?.allDrivers || [];
  const allStatus = state.allCarStatus?.allCars || [];
  const pi = state.playerCarIndex;
  if (!allLaps || pi < 0 || !allLaps[pi]) { container.innerHTML = ''; return; }

  const playerLap = allLaps[pi];
  const playerPos = playerLap.carPosition || 0;

  // Build list of cars with relative gap
  const cars = [];
  for (let i = 0; i < allLaps.length; i++) {
    const lap = allLaps[i];
    if (!lap || !lap.carPosition || lap.carPosition === 0) continue;
    const name = parts[i]?.name || '';
    if (!name) continue;
    const teamId = parts[i]?.teamId ?? 0;
    const st = allStatus[i];
    const compound = st ? (COMPOUND_COLORS[tyreName(st)] || '#888') : '#888';

    // Compute gap relative to player
    let gap = 0;
    if (i === pi) {
      gap = 0;
    } else if (lap.carPosition < playerPos) {
      gap = -(lap.deltaToCarInFrontInMS || 0); // approximate
    } else {
      gap = lap.deltaToCarInFrontInMS || 0;
    }
    cars.push({ idx: i, name, teamId, pos: lap.carPosition, gap, compound, isPlayer: i === pi });
  }

  // Sort by position
  cars.sort((a, b) => a.pos - b.pos);

  // Show cars within 5 positions of player
  const playerIdx = cars.findIndex(c => c.isPlayer);
  const start = Math.max(0, playerIdx - 4);
  const end = Math.min(cars.length, playerIdx + 5);
  const visible = cars.slice(start, end);

  container.innerHTML = visible.map(c => {
    const teamColor = TEAM_COLORS[c.teamId] || '#888';
    const gapStr = c.isPlayer ? '' : (c.pos < (playerLap.carPosition || 0)
      ? '-' + fmtRelGap(Math.abs(c.gap))
      : '+' + fmtRelGap(Math.abs(c.gap)));
    const gapCls = c.isPlayer ? '' : c.pos < (playerLap.carPosition || 0) ? 'rel-ahead' : 'rel-behind';
    return `<div class="rel-car${c.isPlayer ? ' rel-player' : ''}" style="border-left:3px solid ${teamColor}">
      <span class="rel-pos">${c.pos}</span>
      <span class="rel-name">${c.name}</span>
      <span class="rel-gap ${gapCls}">${gapStr}</span>
    </div>`;
  }).join('');
}

function fmtRelGap(ms) {
  if (!ms || ms === 0) return '0.0';
  return (ms / 1000).toFixed(1);
}

function tyreName(st) {
  if (!st) return '';
  const v = st.visualTyreCompound;
  return { 16: 'SOFT', 17: 'MEDIUM', 18: 'HARD', 7: 'INTER', 8: 'WET' }[v] || '';
}

// ══════════════════════════════════════════════════════════════════════════════
// 43. CONTEXT-AWARE AUTO-SWITCHING (#18)
// ══════════════════════════════════════════════════════════════════════════════

let pitBanner = null;
let scBanner = null;

function updatePitMode() {
  const dash = el('tab-dashboard');
  if (!dash) return;
  if (state.pitStatus === 1 || state.pitStatus === 2) {
    dash.classList.add('pit-mode');
    if (!pitBanner) {
      pitBanner = document.createElement('div');
      pitBanner.className = 'pit-mode-banner';
      pitBanner.textContent = 'PIT LANE';
      document.body.appendChild(pitBanner);
    }
  } else {
    dash.classList.remove('pit-mode');
    if (pitBanner) { pitBanner.remove(); pitBanner = null; }
  }
}

// Override updateSafetyCarBadge to also show banner
const _origSCBadge = updateSafetyCarBadge;
updateSafetyCarBadge = function() {
  _origSCBadge();
  if (state.safetyCarStatus > 0) {
    if (!scBanner) {
      scBanner = document.createElement('div');
      scBanner.className = 'sc-banner ' + (state.safetyCarStatus === 1 ? 'sc-full' : 'sc-vsc');
      scBanner.textContent = state.safetyCarStatus === 1 ? 'SAFETY CAR' : 'VSC';
      document.body.appendChild(scBanner);
    }
  } else {
    if (scBanner) { scBanner.remove(); scBanner = null; }
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// 44. HISTORY TRACK MAP COLORED BY CHANNEL (#1, #6, #15)
// ══════════════════════════════════════════════════════════════════════════════

let historyTrackCtx = null;

async function renderHistoryTrackMap(session, lapIdx) {
  const section = el('history-track-section');
  if (!section || !session.trackId) { if (section) section.style.display = 'none'; return; }

  // Fetch saved track outline
  let trackPts;
  try {
    const res = await fetch('/api/tracks/' + session.trackId);
    if (!res.ok) { section.style.display = 'none'; return; }
    const data = await res.json();
    trackPts = data.points;
    if (!trackPts || trackPts.length < 20) { section.style.display = 'none'; return; }
  } catch { section.style.display = 'none'; return; }

  section.style.display = '';

  const canvas = el('history-track-map');
  if (!canvas) return;
  if (!historyTrackCtx) historyTrackCtx = canvas.getContext('2d');

  const channelSel = el('track-color-channel');
  if (channelSel && !channelSel.dataset.bound) {
    channelSel.dataset.bound = '1';
    channelSel.addEventListener('change', () => drawColoredTrack(session, lapIdx, trackPts));
  }

  drawColoredTrack(session, lapIdx, trackPts);
}

function drawColoredTrack(session, lapIdx, trackPts) {
  const canvas = el('history-track-map');
  if (!canvas || !historyTrackCtx) return;
  const ctx = historyTrackCtx;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const channel = el('track-color-channel')?.value || 'speed';

  // Get frames for selected lap
  const lap = session.laps[lapIdx];
  if (!lap) return;
  const frames = session.frames.slice(lap.startFrameIdx, (lap.endFrameIdx || session.frames.length) + 1);
  if (frames.length < 2) return;

  // Extract channel values
  const values = frames.map(f => {
    switch (channel) {
      case 'speed': return f.s || 0;
      case 'throttle': return f.th || 0;
      case 'brake': return f.br || 0;
      case 'gear': return f.g || 0;
      case 'ers': return f.er || 0;
      default: return f.s || 0;
    }
  });
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  // Compute track bounds
  let bMinX = Infinity, bMaxX = -Infinity, bMinZ = Infinity, bMaxZ = -Infinity;
  for (const p of trackPts) {
    if (p.x < bMinX) bMinX = p.x; if (p.x > bMaxX) bMaxX = p.x;
    if (p.z < bMinZ) bMinZ = p.z; if (p.z > bMaxZ) bMaxZ = p.z;
  }
  const pad = Math.max(bMaxX - bMinX, bMaxZ - bMinZ) * 0.08;
  bMinX -= pad; bMaxX += pad; bMinZ -= pad; bMaxZ += pad;

  const scaleX = W / (bMaxX - bMinX);
  const scaleZ = H / (bMaxZ - bMinZ);
  const scale = Math.min(scaleX, scaleZ);
  const offX = (W - (bMaxX - bMinX) * scale) / 2;
  const offZ = (H - (bMaxZ - bMinZ) * scale) / 2;
  const toScreen = (x, z) => [(x - bMinX) * scale + offX, (z - bMinZ) * scale + offZ];

  // Map frames to track points proportionally
  const numSegs = trackPts.length - 1;

  for (let i = 0; i < numSegs; i++) {
    const fi = Math.floor((i / numSegs) * (values.length - 1));
    const norm = (values[fi] - minV) / range;
    const color = channel === 'brake'
      ? `rgba(232,0,45,${0.2 + norm * 0.8})`
      : channel === 'ers'
        ? `hsl(${120 * norm}, 80%, 50%)`
        : `hsl(${(1 - norm) * 240}, 80%, 50%)`;

    const [x1, z1] = toScreen(trackPts[i].x, trackPts[i].z);
    const [x2, z2] = toScreen(trackPts[i + 1].x, trackPts[i + 1].z);

    ctx.beginPath();
    ctx.moveTo(x1, z1);
    ctx.lineTo(x2, z2);
    ctx.strokeStyle = color;
    ctx.lineWidth = channel === 'brake' && norm > 0.1 ? 4 + norm * 3 : 3;
    ctx.stroke();
  }

  // Legend
  ctx.fillStyle = '#888';
  ctx.font = '10px sans-serif';
  const lbl = { speed: 'km/h', throttle: '%', brake: '%', gear: '', ers: '%' }[channel] || '';
  ctx.fillText(`${Math.round(minV)}${lbl}`, 5, H - 5);
  ctx.fillText(`${Math.round(maxV)}${lbl}`, W - 50, H - 5);
}

// ══════════════════════════════════════════════════════════════════════════════
// 45. TYRE DEGRADATION (#3), FUEL BURN (#5), HISTOGRAM (#7)
// ══════════════════════════════════════════════════════════════════════════════

let tyreDegChart = null, fuelBurnChart = null, histogramChart = null;

function renderStintCharts(session) {
  renderTyreDegChart(session);
  renderFuelBurnChart(session);
  renderLapHistogram(session);
}

function renderTyreDegChart(session) {
  const container = el('chart-tyre-deg');
  if (!container || typeof uPlot === 'undefined') return;
  container.innerHTML = '';
  if (tyreDegChart) { tyreDegChart.destroy(); tyreDegChart = null; }

  const laps = (session.laps || []).filter(l => !l.deleted && l.lapTimeMs > 0);
  if (laps.length < 3) { container.style.display = 'none'; return; }
  container.style.display = '';

  // Group into stints by compound
  const stints = [];
  let cur = { compound: laps[0].compound, laps: [] };
  for (const l of laps) {
    if (l.compound !== cur.compound) {
      if (cur.laps.length > 0) stints.push(cur);
      cur = { compound: l.compound, laps: [] };
    }
    cur.laps.push(l);
  }
  if (cur.laps.length > 0) stints.push(cur);

  const maxLen = Math.max(...stints.map(s => s.laps.length));
  const xData = Array.from({ length: maxLen }, (_, i) => i + 1);
  const series = [{ label: 'Lap in Stint' }];
  const data = [xData];

  for (const stint of stints) {
    const color = COMPOUND_COLORS[stint.compound] || '#888';
    series.push({ label: stint.compound, stroke: color, width: 2 });
    const vals = new Array(maxLen).fill(null);
    stint.laps.forEach((l, i) => { vals[i] = l.lapTimeMs / 1000; });
    data.push(vals);
  }

  const W = Math.min(800, (container.clientWidth || 800) - 20);
  tyreDegChart = new uPlot({
    width: W, height: 180, title: 'Tyre Degradation',
    scales: { x: { time: false } },
    axes: [
      { label: 'Lap in Stint', stroke: '#888', grid: { stroke: '#222' } },
      { label: 'Lap Time (s)', stroke: '#888', grid: { stroke: '#222' },
        values: (_, vs) => vs.map(v => v != null ? v.toFixed(1) : '') },
    ],
    series,
  }, data, container);
}

function renderFuelBurnChart(session) {
  const container = el('chart-fuel-burn');
  if (!container || typeof uPlot === 'undefined') return;
  container.innerHTML = '';
  if (fuelBurnChart) { fuelBurnChart.destroy(); fuelBurnChart = null; }

  const laps = (session.laps || []).filter(l => !l.deleted);
  if (laps.length < 2 || !session.frames || session.frames.length < 10) {
    container.style.display = 'none'; return;
  }

  // Compute fuel per lap
  const fuelPerLap = [];
  for (const lap of laps) {
    const frames = session.frames.slice(lap.startFrameIdx, (lap.endFrameIdx || session.frames.length) + 1);
    if (frames.length < 2) { fuelPerLap.push(null); continue; }
    const start = frames[0].fl || 0;
    const end = frames[frames.length - 1].fl || 0;
    const consumed = start - end;
    fuelPerLap.push(consumed > 0 ? +consumed.toFixed(2) : null);
  }

  if (fuelPerLap.every(v => v === null)) { container.style.display = 'none'; return; }
  container.style.display = '';

  const xData = laps.map(l => l.lapNum);
  const W = Math.min(800, (container.clientWidth || 800) - 20);
  fuelBurnChart = new uPlot({
    width: W, height: 160, title: 'Fuel Consumption',
    scales: { x: { time: false } },
    axes: [
      { label: 'Lap', stroke: '#888', grid: { stroke: '#222' } },
      { label: 'kg/lap', stroke: '#888', grid: { stroke: '#222' } },
    ],
    series: [
      {},
      { label: 'Fuel/Lap', stroke: '#f5c518', width: 2, fill: 'rgba(245,197,24,0.1)' },
    ],
  }, [xData, fuelPerLap], container);
}

function renderLapHistogram(session) {
  const container = el('chart-histogram');
  if (!container || typeof uPlot === 'undefined') return;
  container.innerHTML = '';
  if (histogramChart) { histogramChart.destroy(); histogramChart = null; }

  const times = (session.laps || []).filter(l => !l.deleted && l.valid && l.lapTimeMs > 0).map(l => l.lapTimeMs / 1000);
  if (times.length < 3) { container.style.display = 'none'; return; }
  container.style.display = '';

  // Create bins
  const min = Math.min(...times);
  const max = Math.max(...times);
  const binSize = Math.max(0.3, (max - min) / 15);
  const bins = [];
  const counts = [];
  for (let b = min; b <= max + binSize; b += binSize) {
    bins.push(+b.toFixed(2));
    counts.push(0);
  }
  for (const t of times) {
    const idx = Math.min(bins.length - 1, Math.floor((t - min) / binSize));
    counts[idx]++;
  }

  // Stats
  const sorted = [...times].sort((a, b) => a - b);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const stdDev = Math.sqrt(times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length);

  const W = Math.min(800, (container.clientWidth || 800) - 20);

  // Draw stats text + bar chart
  const statsDiv = document.createElement('div');
  statsDiv.style.cssText = 'padding:0.4rem 0.8rem;font-size:0.68rem;color:#888;display:flex;gap:1rem;';
  statsDiv.innerHTML = `<span>Mean: <b style="color:#fff">${mean.toFixed(2)}s</b></span>
    <span>Median: <b style="color:#fff">${median.toFixed(2)}s</b></span>
    <span>Std Dev: <b style="color:#fff">${stdDev.toFixed(3)}s</b></span>`;
  container.appendChild(statsDiv);

  histogramChart = new uPlot({
    width: W, height: 140, title: 'Lap Time Distribution',
    scales: { x: { time: false } },
    axes: [
      { label: 'Time (s)', stroke: '#888', grid: { stroke: '#222' } },
      { label: 'Count', stroke: '#888', grid: { stroke: '#222' } },
    ],
    series: [
      {},
      { label: 'Laps', stroke: '#3b82f6', fill: 'rgba(59,130,246,0.3)', width: 0,
        paths: (u, si, i0, i1) => {
          const s = u.series[si];
          const xOff = 0, yOff = 0;
          const stroke = new Path2D();
          const fill = new Path2D();
          const bW = Math.max(2, (u.bbox.width / bins.length) * 0.7);
          const y0 = u.valToPos(0, 'y', true);
          for (let i = i0; i <= i1; i++) {
            const x = u.valToPos(bins[i], 'x', true);
            const y = u.valToPos(counts[i], 'y', true);
            fill.rect(x - bW/2, y, bW, y0 - y);
            stroke.rect(x - bW/2, y, bW, y0 - y);
          }
          return { stroke, fill };
        },
      },
    ],
  }, [bins, counts], container);
}

// ══════════════════════════════════════════════════════════════════════════════
// 46. VARIANCE OVERLAY (#13)
// ══════════════════════════════════════════════════════════════════════════════

function renderVarianceOverlay(session) {
  state.chartInstances.forEach(c => c.destroy());
  state.chartInstances = [];

  const validLaps = (session.laps || []).filter(l => !l.deleted && l.lapTimeMs > 0);
  if (validLaps.length < 2) return;

  // Find best lap for highlighting
  const bestMs = Math.min(...validLaps.map(l => l.lapTimeMs));
  const bestLap = validLaps.find(l => l.lapTimeMs === bestMs);

  // Resample all laps to same length (use best lap's frame count)
  const bestFrames = session.frames.slice(bestLap.startFrameIdx, (bestLap.endFrameIdx || session.frames.length) + 1);
  const targetLen = bestFrames.length;
  if (targetLen < 2) return;

  const xData = bestFrames.map((_, i) => i);
  const W = Math.min(800, (el('chart-section')?.clientWidth || 800) - 20);

  // Build series + data for speed
  const series = [{}];
  const data = [xData];

  for (const lap of validLaps) {
    const frames = session.frames.slice(lap.startFrameIdx, (lap.endFrameIdx || session.frames.length) + 1);
    if (frames.length < 2) continue;
    const speeds = frames.map(f => f.s || 0);
    const resampled = resampleToLength(speeds, targetLen);
    const isBest = lap === bestLap;
    series.push({
      label: `Lap ${lap.lapNum}`,
      stroke: isBest ? '#e8002d' : 'rgba(100,100,200,0.15)',
      width: isBest ? 2 : 1,
    });
    data.push(resampled);
  }

  const container = el('chart-speed');
  if (!container) return;
  container.innerHTML = '';

  const chart = new uPlot({
    width: W, height: 200, title: 'Speed Variance (All Laps)',
    scales: { x: { time: false } },
    axes: [
      { show: false },
      { stroke: '#555575', grid: { stroke: '#1c1c2e' } },
    ],
    series,
    cursor: { show: true }, legend: { show: false },
  }, data, container);
  state.chartInstances.push(chart);

  // Clear other charts
  ['chart-delta', 'chart-inputs', 'chart-gear'].forEach(id => {
    const c = el(id);
    if (c) c.innerHTML = '';
  });
}

function initVarianceButton() {
  const btn = el('btn-show-all-laps');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (state.currentSession) renderVarianceOverlay(state.currentSession);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 47. MINI-SECTORS (#10)
// ══════════════════════════════════════════════════════════════════════════════

function renderMiniSectors(session, lapIdx, compareLapIdx) {
  const container = el('mini-sectors');
  const grid = el('mini-sector-grid');
  if (!container || !grid) return;

  const lap = session.laps[lapIdx];
  if (!lap) { container.style.display = 'none'; return; }

  const frames = session.frames.slice(lap.startFrameIdx, (lap.endFrameIdx || session.frames.length) + 1);
  if (frames.length < 12) { container.style.display = 'none'; return; }

  container.style.display = '';
  const NUM_MS = 12;
  const segLen = Math.floor(frames.length / NUM_MS);

  // Get base mini-sector times
  const baseTimes = [];
  for (let i = 0; i < NUM_MS; i++) {
    const start = frames[i * segLen];
    const end = frames[Math.min((i + 1) * segLen, frames.length - 1)];
    baseTimes.push((end.t || 0) - (start.t || 0));
  }

  // Get compare mini-sector times
  let cmpTimes = null;
  if (compareLapIdx !== null && compareLapIdx !== undefined && session.laps[compareLapIdx]) {
    const cmpLap = session.laps[compareLapIdx];
    const cmpFrames = session.frames.slice(cmpLap.startFrameIdx, (cmpLap.endFrameIdx || session.frames.length) + 1);
    if (cmpFrames.length >= 12) {
      const cSegLen = Math.floor(cmpFrames.length / NUM_MS);
      cmpTimes = [];
      for (let i = 0; i < NUM_MS; i++) {
        const start = cmpFrames[i * cSegLen];
        const end = cmpFrames[Math.min((i + 1) * cSegLen, cmpFrames.length - 1)];
        cmpTimes.push((end.t || 0) - (start.t || 0));
      }
    }
  }

  const sectorLabels = ['S1', 'S1', 'S1', 'S1', 'S2', 'S2', 'S2', 'S2', 'S3', 'S3', 'S3', 'S3'];

  grid.innerHTML = baseTimes.map((t, i) => {
    const label = `${sectorLabels[i]}.${(i % 4) + 1}`;
    const timeStr = (t / 1000).toFixed(2) + 's';
    let cls = 'ms-neutral';
    let deltaStr = '';
    if (cmpTimes) {
      const delta = t - cmpTimes[i];
      deltaStr = (delta >= 0 ? '+' : '') + (delta / 1000).toFixed(3);
      cls = delta < -10 ? 'ms-faster' : delta > 10 ? 'ms-slower' : 'ms-neutral';
    }
    return `<div class="ms-cell ${cls}">
      <div class="ms-label">${label}</div>
      <div class="ms-time">${timeStr}</div>
      ${deltaStr ? `<div class="ms-delta">${deltaStr}</div>` : ''}
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// 48. CONSISTENCY SCORING (#11)
// ══════════════════════════════════════════════════════════════════════════════

function renderConsistencyStats(session) {
  const container = el('consistency-stats');
  if (!container) return;

  const times = (session.laps || []).filter(l => !l.deleted && l.valid && l.lapTimeMs > 0).map(l => l.lapTimeMs);
  if (times.length < 2) { container.innerHTML = ''; return; }

  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const stdDev = Math.sqrt(times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length);
  const cv = (stdDev / mean) * 100;
  const score = Math.max(0, Math.min(100, 100 - cv * 10));
  const best3 = sorted.slice(0, Math.min(3, sorted.length)).reduce((a, b) => a + b, 0) / Math.min(3, sorted.length);
  const worst3 = sorted.slice(-Math.min(3, sorted.length)).reduce((a, b) => a + b, 0) / Math.min(3, sorted.length);

  const scoreColor = score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-card-label">Consistency</div>
      <div class="stat-card-value ${scoreColor}">${score.toFixed(0)}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Mean</div>
      <div class="stat-card-value">${fmtTime(Math.round(mean))}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Median</div>
      <div class="stat-card-value">${fmtTime(Math.round(median))}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Std Dev</div>
      <div class="stat-card-value">${(stdDev / 1000).toFixed(3)}s</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Best 3 Avg</div>
      <div class="stat-card-value green">${fmtTime(Math.round(best3))}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">Worst 3 Avg</div>
      <div class="stat-card-value red">${fmtTime(Math.round(worst3))}</div>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// 49. DRIVER-VS-DRIVER COMPARISON (#12)
// ══════════════════════════════════════════════════════════════════════════════

let driverCompareChart = null;

function renderDriverComparison(session) {
  const section = el('driver-compare-section');
  if (!section) return;

  // Only show for race sessions with multiple drivers
  const rd = session.raceData;
  const isRace = /race|sprint/i.test(session.sessionType || '');
  if (!isRace || !rd || !rd.carLaps || Object.keys(rd.carLaps).length < 2) {
    section.style.display = 'none'; return;
  }
  section.style.display = '';

  const selA = el('driver-compare-a');
  const selB = el('driver-compare-b');
  if (!selA || !selB) return;

  const participants = rd.participants || [];
  const drivers = Object.keys(rd.carLaps).map(idx => {
    const p = participants[idx] || {};
    return { idx: +idx, name: p.name || `Car ${idx}`, teamId: p.teamId ?? 0 };
  });

  const opts = drivers.map(d => `<option value="${d.idx}">${d.name}</option>`).join('');
  selA.innerHTML = opts;
  selB.innerHTML = opts;
  if (drivers.length >= 2) selB.selectedIndex = 1;

  const draw = () => drawDriverCompare(session);
  if (!selA.dataset.bound) { selA.dataset.bound = '1'; selA.addEventListener('change', draw); }
  if (!selB.dataset.bound) { selB.dataset.bound = '1'; selB.addEventListener('change', draw); }
  draw();
}

function drawDriverCompare(session) {
  const rd = session.raceData;
  if (!rd) return;
  if (driverCompareChart) { driverCompareChart.destroy(); driverCompareChart = null; }

  const idxA = el('driver-compare-a')?.value;
  const idxB = el('driver-compare-b')?.value;
  if (idxA == null || idxB == null) return;

  const lapsA = rd.carLaps[idxA] || [];
  const lapsB = rd.carLaps[idxB] || [];
  const participants = rd.participants || [];
  const pA = participants[idxA] || {};
  const pB = participants[idxB] || {};
  const colorA = TEAM_COLORS[pA.teamId] || '#e8002d';
  const colorB = TEAM_COLORS[pB.teamId] || '#3b82f6';

  const maxLap = Math.max(lapsA.length, lapsB.length);
  if (maxLap < 1) return;

  const xData = Array.from({ length: maxLap }, (_, i) => i + 1);

  // Cumulative time delta
  let cumA = 0, cumB = 0;
  const deltaData = new Array(maxLap).fill(null);
  for (let i = 0; i < maxLap; i++) {
    const tA = lapsA[i]?.lapTimeMs || 0;
    const tB = lapsB[i]?.lapTimeMs || 0;
    if (tA > 0) cumA += tA;
    if (tB > 0) cumB += tB;
    if (cumA > 0 && cumB > 0) deltaData[i] = +((cumA - cumB) / 1000).toFixed(2);
  }

  const chartEl = el('driver-compare-chart');
  if (!chartEl) return;
  chartEl.innerHTML = '';

  const W = Math.min(800, chartEl.clientWidth || 800);
  driverCompareChart = new uPlot({
    width: W, height: 200,
    title: `${pA.name || 'A'} vs ${pB.name || 'B'} (cumulative delta)`,
    scales: { x: { time: false } },
    axes: [
      { label: 'Lap', stroke: '#888', grid: { stroke: '#333' } },
      { label: 'Delta (s)', stroke: '#888', grid: { stroke: '#222' },
        values: (_, vs) => vs.map(v => v != null ? (v > 0 ? '+' : '') + v.toFixed(1) : '') },
    ],
    series: [
      {},
      { label: 'Delta', stroke: '#f0f0f0', width: 2 },
    ],
  }, [xData, deltaData], chartEl);
}

// ══════════════════════════════════════════════════════════════════════════════
// 50. PIT STRATEGY PREDICTOR (#14)
// ══════════════════════════════════════════════════════════════════════════════

function updatePitPredictor(data) {
  const container = el('pit-predictor');
  const content = el('pit-predictor-content');
  if (!container || !content || !data || !data.active) return;

  const pi = state.playerCarIndex;
  if (pi < 0) return;
  const car = data.cars[pi];
  if (!car || !car.currentCompound || car.lapTimes.length < 3) {
    container.style.display = 'none'; return;
  }
  container.style.display = '';

  const age = car.tyreAge || 0;
  const lapTimes = car.lapTimes;
  const recent = lapTimes.slice(-5);
  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;

  // Estimate degradation: compare first 3 laps on stint vs last 3
  const first3 = lapTimes.slice(0, Math.min(3, lapTimes.length));
  const last3 = recent.slice(-3);
  const avgFirst = first3.reduce((a, b) => a + b, 0) / first3.length;
  const avgLast = last3.reduce((a, b) => a + b, 0) / last3.length;
  const degPerLap = lapTimes.length > 3 ? (avgLast - avgFirst) / (lapTimes.length - 3) : 0;

  // Pit loss estimate (~22s)
  const pitLoss = 22000;
  // Crossover: when cumulative deg loss > pit loss
  let crossoverLap = '—';
  if (degPerLap > 0) {
    const lapsToBreakeven = Math.ceil(Math.sqrt(2 * pitLoss / degPerLap));
    crossoverLap = `Lap ${car.currentLap + lapsToBreakeven}`;
  }

  // Undercut/overcut windows
  let strategyHint = '';
  const carAhead = data.cars.find(c => c.position === car.position - 1);
  const carBehind = data.cars.find(c => c.position === car.position + 1);
  if (carAhead && carAhead.gapToLeaderMs > 0) {
    const gapAhead = car.gapToAheadMs;
    if (gapAhead > 0 && gapAhead < pitLoss) {
      strategyHint += `<div class="pit-card-detail">Undercut ${carAhead.name}: gap ${(gapAhead/1000).toFixed(1)}s</div>`;
    }
  }
  if (carBehind) {
    const gapBehind = carBehind.gapToAheadMs || 0;
    if (gapBehind > 0 && gapBehind < pitLoss) {
      strategyHint += `<div class="pit-card-detail">Watch ${carBehind.name}: ${(gapBehind/1000).toFixed(1)}s behind</div>`;
    }
  }

  const degRate = degPerLap > 0 ? '+' + (degPerLap / 1000).toFixed(3) + 's/lap' : 'stable';
  const tyreOk = degPerLap < 50;

  content.innerHTML = `
    <div class="pit-card">
      <div class="pit-card-title">Tyre Status</div>
      <div class="pit-card-value ${tyreOk ? 'pit-ok' : 'pit-now'}">${car.currentCompound} · ${age} laps</div>
      <div class="pit-card-detail">Degradation: ${degRate}</div>
    </div>
    <div class="pit-card">
      <div class="pit-card-title">Optimal Pit Window</div>
      <div class="pit-card-value">${crossoverLap}</div>
      <div class="pit-card-detail">Pit loss: ~${(pitLoss/1000).toFixed(0)}s</div>
    </div>
    <div class="pit-card">
      <div class="pit-card-title">Strategy</div>
      <div class="pit-card-value">${car.numPitStops} stop${car.numPitStops !== 1 ? 's' : ''}</div>
      ${strategyHint}
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// 51. WEATHER IMPACT (#16)
// ══════════════════════════════════════════════════════════════════════════════

function trackWeatherForLap() {
  if (state.currentLap <= state.lastWeatherLap || state.currentLap < 2) return;
  if (!state.lastLapMs || state.lastLapMs <= 0) return;
  state.lastWeatherLap = state.currentLap;

  const session = state.session;
  state.weatherHistory.push({
    lap: state.currentLap - 1,
    lapTimeMs: state.lastLapMs,
    trackTemp: parseFloat(el('track-temp')?.textContent) || 0,
    airTemp: parseFloat(el('air-temp')?.textContent) || 0,
    weather: el('weather')?.textContent || '—',
  });

  updateWeatherImpactLive();
}

function updateWeatherImpactLive() {
  const container = el('weather-impact');
  const content = el('weather-impact-content');
  if (!container || !content) return;

  const hist = state.weatherHistory;
  if (hist.length < 2) { container.style.display = 'none'; return; }
  container.style.display = '';

  // Show last 8 entries
  const recent = hist.slice(-8);
  content.innerHTML = recent.map((e, i) => {
    let delta = '';
    let cls = '';
    if (i > 0) {
      const diff = e.lapTimeMs - recent[i - 1].lapTimeMs;
      delta = (diff >= 0 ? '+' : '') + (diff / 1000).toFixed(2) + 's';
      cls = diff < 0 ? 'we-faster' : 'we-slower';
    }
    return `<div class="weather-entry">
      <span class="we-lap">L${e.lap}</span>
      <span class="we-cond">${e.weather} · Track ${e.trackTemp}° · Air ${e.airTemp}°</span>
      <span class="we-delta ${cls}">${delta}</span>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// 52. AI COACHING HINTS (#17)
// ══════════════════════════════════════════════════════════════════════════════

function generateCoachingHints(session, lapIdx) {
  const container = el('coaching-hints');
  const content = el('coaching-content');
  if (!container || !content) return;

  const lap = session.laps[lapIdx];
  if (!lap) { container.style.display = 'none'; return; }

  // Find best valid lap
  const validLaps = (session.laps || []).filter(l => !l.deleted && l.valid && l.lapTimeMs > 0);
  const bestMs = validLaps.length ? Math.min(...validLaps.map(l => l.lapTimeMs)) : 0;
  const bestLap = validLaps.find(l => l.lapTimeMs === bestMs);
  if (!bestLap || bestLap === lap) { container.style.display = 'none'; return; }

  const frames = session.frames.slice(lap.startFrameIdx, (lap.endFrameIdx || session.frames.length) + 1);
  const bestFrames = session.frames.slice(bestLap.startFrameIdx, (bestLap.endFrameIdx || session.frames.length) + 1);
  if (frames.length < 20 || bestFrames.length < 20) { container.style.display = 'none'; return; }

  container.style.display = '';
  const NUM_SEG = 12;
  const hints = [];

  const segLen = Math.floor(frames.length / NUM_SEG);
  const bSegLen = Math.floor(bestFrames.length / NUM_SEG);

  for (let i = 0; i < NUM_SEG; i++) {
    const seg = frames.slice(i * segLen, (i + 1) * segLen);
    const bSeg = bestFrames.slice(i * bSegLen, (i + 1) * bSegLen);
    if (seg.length < 2 || bSeg.length < 2) continue;

    const segTime = (seg[seg.length - 1].t || 0) - (seg[0].t || 0);
    const bSegTime = (bSeg[bSeg.length - 1].t || 0) - (bSeg[0].t || 0);
    const timeLost = segTime - bSegTime;

    if (Math.abs(timeLost) < 30) continue; // Less than 30ms difference, skip

    const segMinSpeed = Math.min(...seg.map(f => f.s || 999));
    const bSegMinSpeed = Math.min(...bSeg.map(f => f.s || 999));
    const segMaxBrake = Math.max(...seg.map(f => f.br || 0));
    const bSegMaxBrake = Math.max(...bSeg.map(f => f.br || 0));
    const segMaxThrottle = Math.max(...seg.map(f => f.th || 0));

    // Find where braking starts in segment
    const brakeStart = seg.findIndex(f => (f.br || 0) > 10);
    const bBrakeStart = bSeg.findIndex(f => (f.br || 0) > 10);

    const sectorLabel = i < 4 ? `S1.${i+1}` : i < 8 ? `S2.${i-3}` : `S3.${i-7}`;

    if (timeLost > 100) {
      // Significant time loss
      if (brakeStart >= 0 && bBrakeStart >= 0 && brakeStart < bBrakeStart - 2) {
        hints.push({
          type: 'brake',
          delta: timeLost,
          text: `${sectorLabel}: Braked too early — carry speed ${Math.round(bSegMinSpeed - segMinSpeed)} km/h more`,
        });
      } else if (segMinSpeed < bSegMinSpeed - 5) {
        hints.push({
          type: 'speed',
          delta: timeLost,
          text: `${sectorLabel}: Min speed ${Math.round(segMinSpeed)} vs ${Math.round(bSegMinSpeed)} km/h — more corner speed`,
        });
      } else {
        hints.push({
          type: 'throttle',
          delta: timeLost,
          text: `${sectorLabel}: Lost ${(timeLost / 1000).toFixed(2)}s — check throttle application`,
        });
      }
    } else if (timeLost < -100) {
      hints.push({
        type: 'good',
        delta: timeLost,
        text: `${sectorLabel}: Gained ${(-timeLost / 1000).toFixed(2)}s vs best`,
      });
    }
  }

  // Sort by biggest time loss
  hints.sort((a, b) => b.delta - a.delta);

  // Show top 6
  const top = hints.slice(0, 6);
  const icons = { brake: '🔴', throttle: '🟢', speed: '🔵', good: '✅' };

  content.innerHTML = top.length > 0
    ? top.map(h => `<div class="coaching-item tip-${h.type}">
        <span class="coaching-icon">${icons[h.type] || ''}</span>
        <span class="coaching-text">${h.text}</span>
        <span class="coaching-delta">${(h.delta > 0 ? '+' : '') + (h.delta / 1000).toFixed(2)}s</span>
      </div>`).join('')
    : '<div class="coaching-item tip-good"><span class="coaching-text">Lap is very close to your best — well driven!</span></div>';
}

// ══════════════════════════════════════════════════════════════════════════════
// 53. SESSION SUMMARY CARD (#21)
// ══════════════════════════════════════════════════════════════════════════════

function generateSessionCard(session) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 450;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#07070e';
  ctx.fillRect(0, 0, 800, 450);

  // Red accent line
  ctx.fillStyle = '#e8002d';
  ctx.fillRect(0, 0, 800, 4);

  // Track name
  ctx.font = '900 36px Orbitron, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(session.track || '—', 40, 60);

  // Session type + date
  ctx.font = '600 16px Rajdhani, sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText(`${session.sessionType || '—'} · ${session.date || '—'}`, 40, 90);

  // Best lap
  const validLaps = (session.laps || []).filter(l => l.valid && l.lapTimeMs > 0);
  const bestMs = validLaps.length ? Math.min(...validLaps.map(l => l.lapTimeMs)) : 0;
  const bestLap = validLaps.find(l => l.lapTimeMs === bestMs);

  ctx.font = '900 56px Orbitron, sans-serif';
  ctx.fillStyle = '#39d353';
  ctx.fillText(bestMs ? fmtTime(bestMs) : '—', 40, 170);

  ctx.font = '600 14px Rajdhani, sans-serif';
  ctx.fillStyle = '#555';
  ctx.fillText('BEST LAP', 40, 190);

  // Sectors
  if (bestLap) {
    const sx = 40;
    const sectors = [
      ['S1', bestLap.s1Ms],
      ['S2', bestLap.s2Ms],
      ['S3', bestLap.s1Ms && bestLap.s2Ms && bestLap.lapTimeMs ? bestLap.lapTimeMs - bestLap.s1Ms - bestLap.s2Ms : 0],
    ];
    sectors.forEach(([label, ms], i) => {
      const x = sx + i * 160;
      ctx.font = '600 12px Rajdhani, sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText(label, x, 230);
      ctx.font = '700 20px Rajdhani, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(ms ? fmtSector(ms) : '—', x, 252);
    });
  }

  // Stats column
  const stats = [
    ['Laps', session.laps ? session.laps.filter(l => !l.deleted).length : 0],
    ['Valid', validLaps.length],
    ['Top Speed', validLaps.length ? Math.max(...validLaps.map(l => l.maxSpeed || 0)) + ' km/h' : '—'],
    ['Compound', bestLap?.compound || '—'],
  ];

  stats.forEach(([label, val], i) => {
    const x = 540, y = 60 + i * 45;
    ctx.font = '600 12px Rajdhani, sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText(label.toUpperCase(), x, y);
    ctx.font = '700 22px Rajdhani, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(String(val), x, y + 24);
  });

  // Consistency score
  const times = validLaps.map(l => l.lapTimeMs);
  if (times.length > 1) {
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const stdDev = Math.sqrt(times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length);
    const cv = (stdDev / mean) * 100;
    const score = Math.max(0, Math.min(100, 100 - cv * 10));
    ctx.font = '600 12px Rajdhani, sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('CONSISTENCY', 540, 240);
    ctx.font = '900 28px Orbitron, sans-serif';
    ctx.fillStyle = score >= 80 ? '#39d353' : score >= 50 ? '#f5c518' : '#e8002d';
    ctx.fillText(score.toFixed(0) + '%', 540, 272);
  }

  // Mini lap time bar chart at bottom
  if (validLaps.length > 1) {
    const barY = 330;
    const barH = 80;
    const barW = 700 / validLaps.length;
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const tRange = tMax - tMin || 1;

    validLaps.forEach((l, i) => {
      const norm = (l.lapTimeMs - tMin) / tRange;
      const h = 20 + norm * (barH - 20);
      const color = l.lapTimeMs === bestMs ? '#39d353' : `hsl(${(1 - norm) * 120}, 70%, 50%)`;
      ctx.fillStyle = color;
      ctx.fillRect(50 + i * barW, barY + barH - h, Math.max(2, barW - 1), h);
    });

    ctx.font = '600 10px Rajdhani, sans-serif';
    ctx.fillStyle = '#555';
    ctx.fillText('LAP TIMES', 50, barY - 5);
  }

  // Watermark
  ctx.font = '600 11px Rajdhani, sans-serif';
  ctx.fillStyle = '#333';
  ctx.fillText('F1 25 Telemetry Dashboard', 40, 440);
  ctx.fillText(new Date().toLocaleDateString(), 700, 440);

  // Download
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(session.track || 'session').replace(/\s+/g, '_')}_${session.sessionType || 'session'}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

// ══════════════════════════════════════════════════════════════════════════════
// 54. CURRENT SESSION TAB (live recording view)
// ══════════════════════════════════════════════════════════════════════════════

let _liveSessionTimer = null;
let _liveSession = null;
let _liveSessionLapCount = 0;
let _liveChartInstances = [];
let _liveSelectedLap = null;
let _liveCompareLap = null;

function startLiveSessionPolling() {
  loadLiveSession();
  stopLiveSessionPolling();
  _liveSessionTimer = setInterval(loadLiveSession, 2000);
}

function stopLiveSessionPolling() {
  if (_liveSessionTimer) { clearInterval(_liveSessionTimer); _liveSessionTimer = null; }
}

async function loadLiveSession() {
  try {
    const resp = await fetch('/api/recordings/current');
    const session = await resp.json();
    if (!session) {
      el('live-session-placeholder').style.display = '';
      el('live-session-detail').style.display = 'none';
      _liveSession = null;
      _liveSessionLapCount = 0;
      return;
    }
    el('live-session-placeholder').style.display = 'none';
    el('live-session-detail').style.display = '';

    _liveSession = session;

    // Header
    setText('ls-track', session.track || '—');
    setText('ls-type', session.sessionType || '—');
    setText('ls-laps', (session.laps?.length || 0) + ' laps');
    setText('ls-frames', (session.frames?.length || 0) + ' frames');

    // Only re-render lap table if lap count changed
    const newLapCount = session.laps?.length || 0;
    if (newLapCount !== _liveSessionLapCount) {
      _liveSessionLapCount = newLapCount;
      renderLiveSessionLaps(session);
      renderLiveSessionAnalysis(session);
    }
  } catch (err) {
    console.error('loadLiveSession error:', err);
  }
}

function renderLiveSessionLaps(session) {
  const body = el('ls-lap-table-body');
  if (!body || !session.laps) return;

  const laps = session.laps;
  let bestTime = Infinity;
  let bestIdx = -1;
  laps.forEach((l, i) => {
    if (l.lapTimeMs > 0 && l.valid !== false && !l.deleted && l.lapTimeMs < bestTime) {
      bestTime = l.lapTimeMs; bestIdx = i;
    }
  });

  body.innerHTML = laps.map((lap, i) => {
    if (lap.deleted) return '';
    const isBest = i === bestIdx;
    const isNew = i === laps.length - 1;
    let cls = '';
    if (isBest) cls += ' best-lap';
    if (lap.valid === false) cls += ' invalid-lap';
    if (_liveSelectedLap === i) cls += ' selected-lap';
    if (isNew) cls += ' new-lap';

    const compColor = COMPOUND_COLORS[lap.compound] || '#888';
    return `<tr class="${cls}" data-lap-idx="${i}" onclick="showLiveSessionCharts(${i})">
      <td>${lap.lapNum}</td>
      <td>${lap.lapTimeMs > 0 ? fmtTime(lap.lapTimeMs) : '—'}</td>
      <td>${lap.s1Ms > 0 ? fmtTime(lap.s1Ms) : '—'}</td>
      <td>${lap.s2Ms > 0 ? fmtTime(lap.s2Ms) : '—'}</td>
      <td>${lap.s3Ms > 0 ? fmtTime(lap.s3Ms) : '—'}</td>
      <td><span class="tyre-dot" style="background:${compColor}"></span>${lap.compound || '—'}</td>
      <td>${lap.tyreAge ?? '—'}</td>
      <td>${lap.maxSpeed ? lap.maxSpeed + ' km/h' : '—'}</td>
      <td>${lap.valid === false ? '✗' : '✓'}</td>
    </tr>`;
  }).join('');

  // Populate lap selectors for charts
  const sel1 = el('ls-chart-lap-select');
  const sel2 = el('ls-chart-compare-select');
  if (sel1) {
    const curVal = sel1.value;
    sel1.innerHTML = laps.map((l, i) =>
      l.deleted ? '' : `<option value="${i}">Lap ${l.lapNum}${i === bestIdx ? ' (best)' : ''}</option>`
    ).join('');
    if (curVal) sel1.value = curVal;
  }
  if (sel2) {
    const curVal = sel2.value;
    sel2.innerHTML = '<option value="">Compare with...</option>' +
      laps.map((l, i) =>
        l.deleted ? '' : `<option value="${i}">Lap ${l.lapNum}${i === bestIdx ? ' (best)' : ''}</option>`
      ).join('');
    if (curVal) sel2.value = curVal;
  }
}

function renderLiveSessionAnalysis(session) {
  // Consistency stats
  renderConsistencyStats_target(session, 'ls-consistency-stats');
  // Stint charts
  renderStintCharts_target(session, 'ls-chart-tyre-deg', 'ls-chart-fuel-burn', 'ls-chart-histogram');
  // Track map
  renderHistoryTrackMap_target(session, _liveSelectedLap || 0, 'ls-track-section', 'ls-track-map', 'ls-track-color-channel');
}

function showLiveSessionCharts(lapIdx) {
  if (!_liveSession) return;
  _liveSelectedLap = lapIdx;

  const chartSection = el('ls-chart-section');
  if (chartSection) chartSection.style.display = 'block';

  const sel1 = el('ls-chart-lap-select');
  if (sel1) sel1.value = lapIdx;

  // Highlight selected row
  document.querySelectorAll('#ls-lap-table-body tr').forEach(tr => {
    tr.classList.toggle('selected-lap', tr.dataset.lapIdx == lapIdx);
  });

  renderLiveCharts(_liveSession, lapIdx, _liveCompareLap);
}

function renderLiveCharts(session, lapIdx, compareIdx) {
  _liveChartInstances.forEach(c => c.destroy());
  _liveChartInstances = [];

  const lap = session.laps[lapIdx];
  if (!lap) return;
  const frames = session.frames.slice(lap.startFrameIdx, (lap.endFrameIdx || session.frames.length) + 1);
  if (frames.length < 2) return;

  const xData = frames.map((_, i) => i);
  let cmpFrames = null, cmpX = null;
  if (compareIdx !== null && compareIdx !== undefined && session.laps[compareIdx]) {
    const cmpLap = session.laps[compareIdx];
    cmpFrames = session.frames.slice(cmpLap.startFrameIdx, (cmpLap.endFrameIdx || session.frames.length) + 1);
    cmpX = cmpFrames.map((_, i) => i);
  }

  const W = Math.min(800, (el('ls-chart-section')?.clientWidth || 800) - 20);
  const sectorIndices = findSectorBoundaries(frames, lap);
  const sectorPlugin = sectorOverlayPlugin(sectorIndices);

  // Use the existing render functions but target ls- prefixed elements
  const oldCharts = state.chartInstances;
  state.chartInstances = [];

  renderSingleChart('ls-chart-speed', 'Speed', W,
    xData, frames.map(f => f.s), 'km/h', '#f0f0f0',
    cmpX, cmpFrames?.map(f => f.s), '#3b82f6', [sectorPlugin]);

  renderDualChart('ls-chart-inputs', 'Throttle / Brake', W,
    xData, frames.map(f => f.th), frames.map(f => f.br),
    'Throttle %', 'Brake %', '#39d353', '#e8002d',
    cmpX, cmpFrames?.map(f => f.th), cmpFrames?.map(f => f.br), [sectorPlugin]);

  renderSingleChart('ls-chart-gear', 'Gear', W,
    xData, frames.map(f => f.g), '', '#f5c518',
    cmpX, cmpFrames?.map(f => f.g), '#3b82f6', [sectorPlugin]);

  renderDeltaChart('ls-chart-delta', W, frames, cmpFrames);

  _liveChartInstances = state.chartInstances;
  state.chartInstances = oldCharts;

  // Mini-sectors & coaching
  renderMiniSectors_target(session, lapIdx, compareIdx, 'ls-mini-sectors', 'ls-mini-sector-grid');
  generateCoachingHints_target(session, lapIdx, 'ls-coaching-hints', 'ls-coaching-content');

  // Update track map to selected lap
  renderHistoryTrackMap_target(session, lapIdx, 'ls-track-section', 'ls-track-map', 'ls-track-color-channel');
}

function initLiveSessionControls() {
  const sel1 = el('ls-chart-lap-select');
  const sel2 = el('ls-chart-compare-select');
  const closeBtn = el('ls-btn-close-charts');

  if (sel1) sel1.addEventListener('change', () => {
    _liveSelectedLap = parseInt(sel1.value, 10);
    showLiveSessionCharts(_liveSelectedLap);
  });
  if (sel2) sel2.addEventListener('change', () => {
    const v = sel2.value;
    _liveCompareLap = v === '' ? null : parseInt(v, 10);
    if (_liveSelectedLap !== null && _liveSession) {
      renderLiveCharts(_liveSession, _liveSelectedLap, _liveCompareLap);
    }
  });
  if (closeBtn) closeBtn.addEventListener('click', () => {
    const cs = el('ls-chart-section');
    if (cs) cs.style.display = 'none';
    _liveSelectedLap = null;
  });

  // Track color channel selector
  const channelSel = el('ls-track-color-channel');
  if (channelSel) channelSel.addEventListener('change', () => {
    if (_liveSession && _liveSelectedLap !== null) {
      renderHistoryTrackMap_target(_liveSession, _liveSelectedLap, 'ls-track-section', 'ls-track-map', 'ls-track-color-channel');
    }
  });
}

// ── Targeted versions of analysis renderers (for reuse in both History and Session tabs) ──

function renderConsistencyStats_target(session, targetId) {
  const container = el(targetId);
  if (!container) return;
  const laps = (session.laps || []).filter(l => l.lapTimeMs > 0 && l.valid !== false && !l.deleted);
  if (laps.length < 2) { container.innerHTML = ''; return; }

  const times = laps.map(l => l.lapTimeMs);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const variance = times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length;
  const stddev = Math.sqrt(variance);
  const cv = (stddev / mean) * 100;
  const score = Math.max(0, Math.min(100, 100 - cv * 10));
  const best3 = sorted.slice(0, Math.min(3, sorted.length));
  const worst3 = sorted.slice(-Math.min(3, sorted.length));
  const best3avg = best3.reduce((a, b) => a + b, 0) / best3.length;
  const worst3avg = worst3.reduce((a, b) => a + b, 0) / worst3.length;

  container.innerHTML = `
    <div class="stat-card"><div class="stat-label">MEAN</div><div class="stat-value">${fmtTime(mean)}</div></div>
    <div class="stat-card"><div class="stat-label">MEDIAN</div><div class="stat-value">${fmtTime(median)}</div></div>
    <div class="stat-card"><div class="stat-label">STD DEV</div><div class="stat-value">${(stddev / 1000).toFixed(3)}s</div></div>
    <div class="stat-card"><div class="stat-label">CONSISTENCY</div><div class="stat-value" style="color:${score > 80 ? 'var(--green)' : score > 50 ? '#f5c518' : 'var(--red)'}">${score.toFixed(0)}%</div></div>
    <div class="stat-card"><div class="stat-label">BEST 3 AVG</div><div class="stat-value">${fmtTime(best3avg)}</div></div>
    <div class="stat-card"><div class="stat-label">WORST 3 AVG</div><div class="stat-value">${fmtTime(worst3avg)}</div></div>
  `;
}

function renderStintCharts_target(session, tyreDegId, fuelBurnId, histogramId) {
  // Tyre degradation
  const degContainer = el(tyreDegId);
  if (degContainer) {
    const laps = (session.laps || []).filter(l => l.lapTimeMs > 0 && !l.deleted);
    if (laps.length < 2) { degContainer.innerHTML = ''; }
    else {
      // Group by compound
      const byCompound = {};
      let stintPos = 0;
      let lastCompound = null;
      for (const lap of laps) {
        if (lap.compound !== lastCompound) { stintPos = 0; lastCompound = lap.compound; }
        stintPos++;
        const key = lap.compound || 'Unknown';
        if (!byCompound[key]) byCompound[key] = { x: [], y: [] };
        byCompound[key].x.push(stintPos);
        byCompound[key].y.push(lap.lapTimeMs / 1000);
      }
      const compounds = Object.keys(byCompound);
      if (compounds.length > 0) {
        const maxX = Math.max(...compounds.flatMap(c => byCompound[c].x));
        const xData = Array.from({ length: maxX }, (_, i) => i + 1);
        const series = [{}];
        const data = [xData];
        for (const comp of compounds) {
          series.push({ label: comp, stroke: COMPOUND_COLORS[comp] || '#888', width: 2, points: { show: true, size: 4 } });
          const yArr = new Array(maxX).fill(null);
          byCompound[comp].x.forEach((x, i) => { yArr[x - 1] = byCompound[comp].y[i]; });
          data.push(yArr);
        }
        const W = Math.min(700, (degContainer.clientWidth || 700) - 20);
        degContainer.innerHTML = `<div class="section-label">TYRE DEGRADATION</div><div id="${tyreDegId}-chart"></div>`;
        const chart = new uPlot({ width: W, height: 220, series, axes: [{ label: 'Stint Lap' }, { label: 'Lap Time (s)' }],
          scales: { x: { time: false } } }, data, el(`${tyreDegId}-chart`));
      }
    }
  }
}

function renderMiniSectors_target(session, lapIdx, compareLapIdx, containerId, gridId) {
  const container = el(containerId);
  const grid = el(gridId);
  if (!container || !grid) return;

  const lap = session.laps[lapIdx];
  if (!lap) { container.style.display = 'none'; return; }
  const frames = session.frames.slice(lap.startFrameIdx, (lap.endFrameIdx || session.frames.length) + 1);
  if (frames.length < 12) { container.style.display = 'none'; return; }

  container.style.display = '';
  const SECTORS = 12;
  const segLen = Math.floor(frames.length / SECTORS);
  const segTimes = [];
  for (let i = 0; i < SECTORS; i++) {
    const start = i * segLen;
    const end = i === SECTORS - 1 ? frames.length - 1 : (i + 1) * segLen;
    segTimes.push(frames[end].t - frames[start].t);
  }

  let cmpSegTimes = null;
  if (compareLapIdx !== null && compareLapIdx !== undefined && session.laps[compareLapIdx]) {
    const cmpLap = session.laps[compareLapIdx];
    const cmpFrames = session.frames.slice(cmpLap.startFrameIdx, (cmpLap.endFrameIdx || session.frames.length) + 1);
    if (cmpFrames.length >= 12) {
      const cmpSegLen = Math.floor(cmpFrames.length / SECTORS);
      cmpSegTimes = [];
      for (let i = 0; i < SECTORS; i++) {
        const start = i * cmpSegLen;
        const end = i === SECTORS - 1 ? cmpFrames.length - 1 : (i + 1) * cmpSegLen;
        cmpSegTimes.push(cmpFrames[end].t - cmpFrames[start].t);
      }
    }
  }

  grid.innerHTML = segTimes.map((t, i) => {
    let cls = 'ms-cell';
    let delta = '';
    if (cmpSegTimes) {
      const diff = t - cmpSegTimes[i];
      cls += diff < 0 ? ' ms-faster' : diff > 0 ? ' ms-slower' : '';
      delta = `<span class="ms-delta">${diff >= 0 ? '+' : ''}${(diff / 1000).toFixed(3)}</span>`;
    }
    return `<div class="${cls}"><span class="ms-num">S${i + 1}</span><span class="ms-time">${(t / 1000).toFixed(3)}s</span>${delta}</div>`;
  }).join('');
}

function generateCoachingHints_target(session, lapIdx, containerId, contentId) {
  const container = el(containerId);
  const content = el(contentId);
  if (!container || !content) return;

  const lap = session.laps[lapIdx];
  if (!lap) { container.style.display = 'none'; return; }
  const frames = session.frames.slice(lap.startFrameIdx, (lap.endFrameIdx || session.frames.length) + 1);
  if (frames.length < 24) { container.style.display = 'none'; return; }

  // Find best lap
  let bestIdx = -1, bestTime = Infinity;
  session.laps.forEach((l, i) => {
    if (l.lapTimeMs > 0 && l.valid !== false && !l.deleted && l.lapTimeMs < bestTime) {
      bestTime = l.lapTimeMs; bestIdx = i;
    }
  });
  if (bestIdx === -1 || bestIdx === lapIdx) { container.style.display = 'none'; return; }

  const bestLap = session.laps[bestIdx];
  const bestFrames = session.frames.slice(bestLap.startFrameIdx, (bestLap.endFrameIdx || session.frames.length) + 1);
  if (bestFrames.length < 24) { container.style.display = 'none'; return; }

  container.style.display = '';
  const SEGS = 12;
  const tips = [];

  for (let i = 0; i < SEGS; i++) {
    const s1 = Math.floor(i * frames.length / SEGS);
    const e1 = Math.floor((i + 1) * frames.length / SEGS);
    const s2 = Math.floor(i * bestFrames.length / SEGS);
    const e2 = Math.floor((i + 1) * bestFrames.length / SEGS);

    const seg = frames.slice(s1, e1);
    const bestSeg = bestFrames.slice(s2, e2);

    const avgBrake = seg.reduce((s, f) => s + f.br, 0) / seg.length;
    const bestAvgBrake = bestSeg.reduce((s, f) => s + f.br, 0) / bestSeg.length;
    const minSpeed = Math.min(...seg.map(f => f.s));
    const bestMinSpeed = Math.min(...bestSeg.map(f => f.s));
    const avgThrottle = seg.reduce((s, f) => s + f.th, 0) / seg.length;
    const bestAvgThrottle = bestSeg.reduce((s, f) => s + f.th, 0) / bestSeg.length;

    if (avgBrake > bestAvgBrake + 10) {
      tips.push({ seg: i + 1, type: 'brake', msg: `Segment ${i + 1}: braking harder than best lap (${avgBrake.toFixed(0)}% vs ${bestAvgBrake.toFixed(0)}%)`, priority: avgBrake - bestAvgBrake });
    }
    if (minSpeed < bestMinSpeed - 5) {
      tips.push({ seg: i + 1, type: 'speed', msg: `Segment ${i + 1}: lower corner speed (${minSpeed.toFixed(0)} vs ${bestMinSpeed.toFixed(0)} km/h)`, priority: bestMinSpeed - minSpeed });
    }
    if (avgThrottle < bestAvgThrottle - 8) {
      tips.push({ seg: i + 1, type: 'throttle', msg: `Segment ${i + 1}: less throttle application (${avgThrottle.toFixed(0)}% vs ${bestAvgThrottle.toFixed(0)}%)`, priority: bestAvgThrottle - avgThrottle });
    }
  }

  tips.sort((a, b) => b.priority - a.priority);
  if (tips.length === 0) {
    content.innerHTML = '<div class="coaching-item tip-good">This lap is close to your best — great consistency!</div>';
  } else {
    content.innerHTML = tips.slice(0, 6).map(t => {
      const icon = t.type === 'brake' ? '🔴' : t.type === 'speed' ? '🟡' : '🟢';
      return `<div class="coaching-item tip-${t.type}">${icon} ${t.msg}</div>`;
    }).join('');
  }
}

async function renderHistoryTrackMap_target(session, lapIdx, sectionId, canvasId, channelSelId) {
  const section = el(sectionId);
  const canvas = el(canvasId);
  if (!section || !canvas) return;

  const lap = session.laps?.[lapIdx];
  if (!lap) { section.style.display = 'none'; return; }

  const trackName = session.track || '';
  if (!trackName || trackName === 'Unknown') { section.style.display = 'none'; return; }

  try {
    const resp = await fetch(`/api/tracks/${encodeURIComponent(trackName)}`);
    if (!resp.ok) { section.style.display = 'none'; return; }
    const trackData = await resp.json();
    const trackPts = trackData.points;
    if (!trackPts || trackPts.length < 10) { section.style.display = 'none'; return; }

    section.style.display = '';
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const frames = session.frames.slice(lap.startFrameIdx, (lap.endFrameIdx || session.frames.length) + 1);
    if (frames.length < 2) return;

    const channelSel = el(channelSelId);
    const channel = channelSel?.value || 'speed';

    // Map frames to track points
    const ratio = trackPts.length / frames.length;

    // Normalize track coordinates
    const xs = trackPts.map(p => p[0]), ys = trackPts.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
    const scale = Math.min((W - 40) / rangeX, (H - 40) / rangeY);
    const offX = (W - rangeX * scale) / 2, offY = (H - rangeY * scale) / 2;

    const toCanvas = (pt) => [offX + (pt[0] - minX) * scale, offY + (pt[1] - minY) * scale];

    // Get channel values
    const getVal = (f) => {
      switch (channel) {
        case 'speed': return f.s;
        case 'throttle': return f.th;
        case 'brake': return f.br;
        case 'gear': return f.g;
        case 'ers': return f.er || 0;
        default: return f.s;
      }
    };

    const vals = frames.map(getVal);
    const minV = Math.min(...vals), maxV = Math.max(...vals);
    const rangeV = maxV - minV || 1;

    // Draw colored track segments
    ctx.lineWidth = 3;
    for (let i = 0; i < trackPts.length - 1; i++) {
      const frameIdx = Math.min(Math.floor(i / ratio), frames.length - 1);
      const norm = (vals[frameIdx] - minV) / rangeV;

      let hue;
      if (channel === 'brake') hue = (1 - norm) * 120;
      else hue = norm * 120;

      ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
      ctx.beginPath();
      const [x1, y1] = toCanvas(trackPts[i]);
      const [x2, y2] = toCanvas(trackPts[i + 1]);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  } catch (err) {
    section.style.display = 'none';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 34. BOOT
// ══════════════════════════════════════════════════════════════════════════════

function init() {
  initTabs();
  initRecButton();
  initHistoryButtons();
  initSettingsButtons();
  initKeyboardShortcuts();
  initChartControls();
  initAudio();
  initContextMenu();
  initBatchSelect();
  initCompareModal();
  initRaceColumns();
  initVarianceButton();
  initLiveSessionControls();

  // Share card button
  const shareBtn = el('btn-share-card');
  if (shareBtn) shareBtn.addEventListener('click', () => {
    if (state.currentSession) generateSessionCard(state.currentSession);
  });

  connect();

  // Load settings on boot to apply speed unit
  loadSettingsData();
}

init();
