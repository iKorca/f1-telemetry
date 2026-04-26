'use strict';

// ─── Pure analysis helpers ───────────────────────────────────────────────────
// Small, I/O-free utilities factored out of server.js / the UI charts so they
// can be unit-tested without spinning up Express or React. Any addition here
// should have a matching spec in tests/.

/** Median of a numeric array. Safe on empty input → returns 0. */
function median(xs) {
  if (!xs || xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Median absolute deviation — robust dispersion measure. */
function mad(xs, centre) {
  if (!xs || xs.length === 0) return 0;
  const c = centre == null ? median(xs) : centre;
  return median(xs.map((x) => Math.abs(x - c)));
}

/** Ordinary least-squares linear fit. Returns null on degenerate input. */
function linearFit(xs, ys) {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i]; sumY += ys[i];
    sumXY += xs[i] * ys[i]; sumXX += xs[i] * xs[i];
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/**
 * Sum of best-S1 + best-S2 + best-S3 across a run's laps. Zero when any
 * sector is missing — callers interpret 0 as "no theoretical best yet".
 */
function theoreticalBest(run) {
  if (!run || !run.laps || run.laps.length === 0) return 0;
  let s1 = Infinity, s2 = Infinity, s3 = Infinity;
  for (const l of run.laps) {
    if (l.s1Ms > 0 && l.s1Ms < s1) s1 = l.s1Ms;
    if (l.s2Ms > 0 && l.s2Ms < s2) s2 = l.s2Ms;
    if (l.s3Ms > 0 && l.s3Ms < s3) s3 = l.s3Ms;
  }
  if (!Number.isFinite(s1) || !Number.isFinite(s2) || !Number.isFinite(s3)) return 0;
  return s1 + s2 + s3;
}

/**
 * Wear extrapolation. Returns { worstSlope, lapsRemaining, worstWheel } or
 * null if there's not enough data / wear is stable / shrinking.
 */
function extrapolateWear(laps) {
  if (!laps || laps.length < 2) return null;
  let worstSlope = -Infinity, worstWheel = -1, worstLatest = 0;
  for (let w = 0; w < 4; w++) {
    const pts = laps
      .map((l, i) => ({ x: l.tyreAge ?? i + 1, y: l.tyreWear?.[w] ?? 0 }))
      .filter((p) => p.y > 0);
    if (pts.length < 2) continue;
    const fit = linearFit(pts.map((p) => p.x), pts.map((p) => p.y));
    if (!fit) continue;
    const latest = pts[pts.length - 1].y;
    if (fit.slope > worstSlope) {
      worstSlope = fit.slope;
      worstWheel = w;
      worstLatest = latest;
    }
  }
  if (worstSlope <= 0 || worstWheel < 0) return null;
  const lapsRemaining = Math.max(0, Math.round((100 - worstLatest) / worstSlope));
  return { worstSlope, lapsRemaining, worstWheel };
}

/**
 * Mark laps that fall outside 2.5 × MAD of stint medians on lap-time,
 * max-speed, or S3. Mutates each lap with `trafficLap` and — if no manual
 * flag is set — sets `flag = 'traffic'`. Returns the number of laps
 * newly flagged.
 */
function detectTrafficLaps(laps, k = 2.5) {
  if (!laps || laps.length === 0) return 0;
  const clean = laps.filter((l) => l.valid && !l.isOutLap && !l.isPitLap && l.lapTimeMs > 0);
  if (clean.length < 4) return 0;

  const lapTimes  = clean.map((l) => l.lapTimeMs);
  const maxSpeeds = clean.map((l) => l.maxSpeed || 0).filter((v) => v > 0);
  const s3Times   = clean.map((l) => l.s3Ms || 0).filter((v) => v > 0);

  const lapTimeMed = median(lapTimes); const lapTimeMad = mad(lapTimes, lapTimeMed);
  const maxSpeedMed = maxSpeeds.length ? median(maxSpeeds) : 0;
  const maxSpeedMad = maxSpeeds.length ? mad(maxSpeeds, maxSpeedMed) : 0;
  const s3Med = s3Times.length ? median(s3Times) : 0;
  const s3Mad = s3Times.length ? mad(s3Times, s3Med) : 0;

  let flagged = 0;
  for (const rl of laps) {
    if (!rl.valid || rl.isOutLap || rl.isPitLap) continue;
    if (rl.flag === 'clean' || rl.flag === 'mistake' || rl.flag === 'reference') continue;
    const slowLap  = lapTimeMad > 0 && rl.lapTimeMs > lapTimeMed + k * lapTimeMad;
    const slowTrap = maxSpeedMad > 0 && rl.maxSpeed > 0 && rl.maxSpeed < maxSpeedMed - k * maxSpeedMad;
    const slowS3   = s3Mad > 0 && rl.s3Ms > 0 && rl.s3Ms > s3Med + k * s3Mad;
    if (slowLap || slowTrap || slowS3) {
      rl.trafficLap = true;
      if (!rl.flag) rl.flag = 'traffic';
      flagged++;
    }
  }
  return flagged;
}

/**
 * Recompute per-run aggregates from an already-populated `run.laps[]`. Used
 * after manual split/merge operations.
 */
function recomputeRunAggregates(run) {
  const laps = run.laps || [];
  const valid = laps.filter((l) => l.valid && l.lapTimeMs > 0);
  const clean = laps.filter((l) => l.valid && !l.trafficLap && l.lapTimeMs > 0);
  const rollup = clean.length > 0 ? clean : valid;

  run.lapCount = laps.length;
  run.validLapCount = clean.length;

  if (rollup.length > 0) {
    const times = rollup.map((l) => l.lapTimeMs);
    run.bestLapMs = Math.min(...times);
    run.avgLapMs = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    run.bestS1Ms = Math.min(...rollup.filter((l) => l.s1Ms > 0).map((l) => l.s1Ms)) || 0;
    run.bestS2Ms = Math.min(...rollup.filter((l) => l.s2Ms > 0).map((l) => l.s2Ms)) || 0;
    run.bestS3Ms = Math.min(...rollup.filter((l) => l.s3Ms > 0).map((l) => l.s3Ms)) || 0;
  } else {
    run.bestLapMs = 0; run.avgLapMs = 0;
    run.bestS1Ms = 0; run.bestS2Ms = 0; run.bestS3Ms = 0;
  }

  run.maxSpeed = Math.max(0, ...laps.map((l) => l.maxSpeed || 0));
  run.avgThrottle = laps.length > 0
    ? Math.round(laps.reduce((s, l) => s + (l.avgThrottle || 0), 0) / laps.length) : 0;
  run.avgBrake = laps.length > 0
    ? Math.round(laps.reduce((s, l) => s + (l.avgBrake || 0), 0) / laps.length) : 0;

  if (clean.length >= 2) {
    const times = clean.map((l) => l.lapTimeMs);
    const m = times.reduce((a, b) => a + b, 0) / times.length;
    const v = times.reduce((s, t) => s + (t - m) ** 2, 0) / times.length;
    const cv = (Math.sqrt(v) / m) * 100;
    run.consistency = Math.round(Math.max(0, Math.min(100, 100 - cv * 10)));
  } else {
    run.consistency = 0;
  }

  const fuelVals = laps.filter((l) => l.fuel > 0 && l.tyreAge > 0).map((l) => l.fuel);
  run.avgFuelPerLap = fuelVals.length > 0 ? +(fuelVals.reduce((a, b) => a + b, 0) / fuelVals.length).toFixed(2) : 0;
  run.maxFuelPerLap = fuelVals.length > 0 ? +Math.max(...fuelVals).toFixed(2) : 0;

  const degLaps = laps.filter((l) => l.valid && l.lapTimeMs > 0 && l.tyreAge > 0);
  const deltas = [];
  for (let i = 1; i < degLaps.length; i++) {
    deltas.push(degLaps[i].lapTimeMs - degLaps[i - 1].lapTimeMs);
  }
  run.avgDegradationMs = deltas.length > 0 ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : 0;
  run.maxDegradationMs = deltas.length > 0 ? Math.max(...deltas) : 0;
}

module.exports = {
  median,
  mad,
  linearFit,
  theoreticalBest,
  extrapolateWear,
  detectTrafficLaps,
  recomputeRunAggregates,
};
