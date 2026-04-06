import type { RecordedLap, SessionDetail, TelemetryFrame } from '@shared/types';

/**
 * Get valid laps: lapTimeMs > 0, valid !== false, not deleted.
 */
export function getValidLaps(laps: RecordedLap[]): RecordedLap[] {
  return laps.filter((l) => l.lapTimeMs > 0 && l.valid !== false && !l.deleted);
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

  // Step 1: Find the LAST significant time reset (t drops by > 50%)
  // This marks where the actual lap timing starts (S/F line crossing)
  let resetIdx = 0;
  for (let i = 1; i < raw.length; i++) {
    if (raw[i].t < raw[i - 1].t - 5000) {
      // Time dropped by more than 5 seconds — this is a lap reset
      resetIdx = i;
    }
  }

  // Step 2: Take frames from reset point onward
  let trimmed = raw.slice(resetIdx);

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

  return cleaned;
}
