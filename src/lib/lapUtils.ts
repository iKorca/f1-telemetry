import type { RecordedLap, SessionDetail, TelemetryFrame } from '@shared/types';

/**
 * Get valid racing laps: excludes invalid, deleted, out-laps, and pit-laps.
 */
export function getValidLaps(laps: RecordedLap[]): RecordedLap[] {
  return laps.filter(
    (l) => l.lapTimeMs > 0 && l.valid !== false && !l.deleted && !l.isOutLap && !l.isPitLap,
  );
}

/**
 * Find the index of the best (fastest valid) lap, or -1 if none.
 */
export function findBestLapIndex(laps: RecordedLap[]): number {
  let best = -1;
  let bestTime = Infinity;
  laps.forEach((l, i) => {
    if (
      l.lapTimeMs > 0 &&
      l.valid !== false &&
      !l.deleted &&
      l.lapTimeMs < bestTime
    ) {
      bestTime = l.lapTimeMs;
      best = i;
    }
  });
  return best;
}

/**
 * Get telemetry frames for a specific lap from a session.
 *
 * Strategy:
 * 1. Slice raw frames from startFrameIdx..endFrameIdx
 * 2. Find the lap-time reset point (where `t` drops significantly) — this is
 *    where the car crossed the S/F line and the actual lap begins
 * 3. Cap frames at lapTimeMs after the reset point
 * 4. Filter out backwards time jumps (pause menu / rewind)
 */
export function getFramesForLap(
  session: SessionDetail,
  lapIdx: number,
): TelemetryFrame[] {
  const lap = session.laps?.[lapIdx];
  if (!lap || !session.frames) return [];

  const raw = session.frames.slice(
    lap.startFrameIdx,
    (lap.endFrameIdx || session.frames.length) + 1,
  );

  if (raw.length < 2) return raw;

  // Step 1: Find the LAST significant time reset (lap time wraps back near 0)
  // This marks where the actual lap timing starts (S/F line crossing)
  // Detection: current t is < 30% of previous t AND previous t > 10s
  // This works for all circuit lengths (Monaco ~72s to Spa ~105s)
  let resetIdx = 0;
  for (let i = 1; i < raw.length; i++) {
    const prev = raw[i - 1].t;
    const curr = raw[i].t;
    if (prev > 10000 && curr < prev * 0.3) {
      resetIdx = i;
    }
  }

  // Step 2: Take frames from reset point onward, skip leading zero-speed frames
  let trimmed = raw.slice(resetIdx);
  while (trimmed.length > 2 && trimmed[0].s < 1) {
    trimmed = trimmed.slice(1);
  }

  // Step 3: If we have a valid lap time, cap frames within lapTimeMs + margin
  if (lap.lapTimeMs > 0 && trimmed.length > 2) {
    const startT = trimmed[0].t;
    const maxT = startT + lap.lapTimeMs + 2000; // 2s margin
    const capIdx = trimmed.findIndex((f) => f.t > maxT);
    if (capIdx > 0) {
      trimmed = trimmed.slice(0, capIdx);
    }
  }

  // Step 4: Filter frames where time goes backwards (pause/rewind)
  if (trimmed.length < 2) return trimmed;
  const cleaned: TelemetryFrame[] = [trimmed[0]];
  let lastT = trimmed[0].t;
  for (let i = 1; i < trimmed.length; i++) {
    if (trimmed[i].t >= lastT) {
      cleaned.push(trimmed[i]);
      lastT = trimmed[i].t;
    }
  }

  // Step 5: Remove physically impossible speed spikes
  // An F1 car can't change speed more than ~150 km/h per second (acceleration)
  // or ~250 km/h per second (braking). Detect isolated spikes where a single
  // frame's speed is far from both neighbours and replace with interpolation.
  if (cleaned.length >= 3) {
    for (let i = 1; i < cleaned.length - 1; i++) {
      const prev = cleaned[i - 1];
      const curr = cleaned[i];
      const next = cleaned[i + 1];
      const dtPrev = (curr.t - prev.t) / 1000; // seconds
      const dtNext = (next.t - curr.t) / 1000;
      if (dtPrev <= 0 || dtNext <= 0) continue;

      const ratePrev = Math.abs(curr.s - prev.s) / dtPrev; // km/h per second
      const rateNext = Math.abs(next.s - curr.s) / dtNext;
      const neighbourRate = Math.abs(next.s - prev.s) / ((dtPrev + dtNext));

      // If both edges show impossible acceleration (>250 km/h/s) but neighbours
      // are close to each other, this frame is a spike — interpolate it
      if (ratePrev > 250 && rateNext > 250 && neighbourRate < 200) {
        const frac = dtPrev / (dtPrev + dtNext);
        cleaned[i] = { ...curr, s: prev.s + (next.s - prev.s) * frac };
      }
    }
  }

  return cleaned;
}
