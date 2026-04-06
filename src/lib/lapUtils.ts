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
 * Minimum speed (km/h) to consider the car "on track" vs in pit/garage.
 */
const ON_TRACK_MIN_SPEED = 30;

/**
 * Get telemetry frames for a specific lap from a session.
 * Trims garage/pit frames from start and end where car is stationary.
 * Also filters out frames where lap time goes backwards (pause menu / rewind).
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

  // Trim leading frames where car is stationary (garage/pit)
  let start = 0;
  while (start < raw.length && raw[start].s < ON_TRACK_MIN_SPEED) {
    start++;
  }

  // Trim trailing frames where car is stationary (pit entry / garage)
  let end = raw.length - 1;
  while (end > start && raw[end].s < ON_TRACK_MIN_SPEED) {
    end--;
  }

  const trimmed = raw.slice(start, end + 1);
  if (trimmed.length < 2) return trimmed;

  // Filter out frames where lap time goes backwards (pause menu / rewind)
  // Lap time should be monotonically increasing during a clean lap
  const cleaned: TelemetryFrame[] = [trimmed[0]];
  let lastT = trimmed[0].t;
  for (let i = 1; i < trimmed.length; i++) {
    if (trimmed[i].t >= lastT) {
      cleaned.push(trimmed[i]);
      lastT = trimmed[i].t;
    }
    // Skip frames where time went backwards (pause/rewind)
  }

  return cleaned;
}
