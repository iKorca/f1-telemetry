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
 */
export function getFramesForLap(
  session: SessionDetail,
  lapIdx: number,
): TelemetryFrame[] {
  const lap = session.laps?.[lapIdx];
  if (!lap || !session.frames) return [];
  return session.frames.slice(
    lap.startFrameIdx,
    (lap.endFrameIdx || session.frames.length) + 1,
  );
}
