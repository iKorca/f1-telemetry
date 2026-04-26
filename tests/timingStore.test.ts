import { describe, it, expect, beforeEach } from 'vitest';
import { useTimingStore } from '../src/store/timingStore';
import type { LapData, LapDataPacket } from '../src/../shared/types';

/**
 * Build a `handleLapData` payload from a partial LapData. Only fields the
 * reducer actually reads need real values — the rest are zero-filled so
 * TypeScript stays happy without bloating the test bodies.
 */
function packet(over: Partial<LapData>): LapDataPacket {
  const base: LapData = {
    lastLapTimeInMS: 0,
    currentLapTimeInMS: 0,
    sector1TimeInMS: 0,
    sector2TimeInMS: 0,
    deltaToCarInFrontInMS: 0,
    deltaToLeaderInMS: 0,
    lapDistance: 0,
    totalDistance: 0,
    carPosition: 1,
    currentLapNum: 1,
    pitStatus: 0,
    numPitStops: 0,
    sector: 0,
    currentLapInvalid: 0,
    penalties: 0,
    totalWarnings: 0,
    cornerCuttingWarnings: 0,
    gridPosition: 1,
    driverStatus: 1,
    resultStatus: 2,
    pitLaneTimerActive: 0,
    pitLaneTimeInLaneInMS: 0,
    pitStopTimerInMS: 0,
    pitStopShouldServePen: 0,
    numUnservedDriveThroughPens: 0,
    numUnservedStopGoPens: 0,
    speedTrapFastestSpeed: 0,
    speedTrapFastestLap: 0,
    driverStatusName: '',
    resultStatusName: '',
    pitStatusName: '',
  };
  return { playerData: { ...base, ...over }, allCars: [] };
}

/** Push N evenly-spaced samples through `handleLapData` for the same lap. */
function fillTrace(lapNum: number, samples: number, totalMs: number) {
  for (let i = 0; i < samples; i++) {
    useTimingStore.getState().handleLapData(packet({
      currentLapNum: lapNum,
      currentLapTimeInMS: Math.round((i + 1) / samples * totalMs),
      lapDistance: (i + 1) * 50, // 50 m steps so the > 10 m gate always passes
    }));
  }
}

beforeEach(() => {
  useTimingStore.getState().resetForNewSession();
  // resetForNewSession leaves currentLap at 0; bump it so newLapStarted
  // can fire on the next packet (state.currentLap > 0 guard in the reducer).
  // The priming packet is at d=0 / t=0 so the trace does not collect a
  // sample (the appender requires d > 0 && t > 20); fillTrace then starts
  // from a clean slate at d=50.
  useTimingStore.getState().handleLapData(packet({ currentLapNum: 1, lapDistance: 0, currentLapTimeInMS: 0 }));
  // Hard-clear any incidental samples in case the priming above ever does
  // append (e.g. if reducer thresholds change later).
  useTimingStore.setState({ currentLapTrace: [], regressionStreak: 0 });
});

describe('timingStore — atomic PB snapshot', () => {
  it('promotes lastLapMs AND pbLapTrace together when a faster clean lap finishes with a usable trace', () => {
    fillTrace(1, 30, 80_000); // 30 samples is well above MIN_PB_TRACE_SAMPLES (20)
    // Cross the line: lap 2 starts, finishedLapMs reports lap 1's clean time.
    useTimingStore.getState().handleLapData(packet({
      currentLapNum: 2,
      lastLapTimeInMS: 80_000,
      currentLapTimeInMS: 200,
      lapDistance: 30,
    }));
    const s = useTimingStore.getState();
    expect(s.bestLapMs).toBe(80_000);
    expect(s.lastLapMs).toBe(80_000);
    expect(s.pbLapTrace.length).toBeGreaterThanOrEqual(20);
    expect(s.pbTotalMs).toBe(80_000);
  });

  it('does NOT promote bestLapMs when the trace is too short, even on a faster clean lap', () => {
    fillTrace(1, 5, 80_000); // way under 20 samples
    useTimingStore.getState().handleLapData(packet({
      currentLapNum: 2,
      lastLapTimeInMS: 80_000,
      currentLapTimeInMS: 200,
      lapDistance: 30,
    }));
    const s = useTimingStore.getState();
    // Last lap is reported (so the user sees their time)…
    expect(s.lastLapMs).toBe(80_000);
    // …but bestLapMs and the trace stay empty so the live-delta UI doesn't
    // compare against an unanchored PB.
    expect(s.bestLapMs).toBe(0);
    expect(s.pbLapTrace.length).toBe(0);
    expect(s.pbTotalMs).toBe(0);
  });

  it('rejects PB snapshot on a lap-jump greater than 1 (lapped car / replay scrub)', () => {
    fillTrace(1, 30, 80_000);
    // Skip from lap 1 directly to lap 3.
    useTimingStore.getState().handleLapData(packet({
      currentLapNum: 3,
      lastLapTimeInMS: 79_000,
      currentLapTimeInMS: 100,
      lapDistance: 5,
    }));
    const s = useTimingStore.getState();
    expect(s.bestLapMs).toBe(0);          // no atomic promotion
    expect(s.pbLapTrace.length).toBe(0);  // trace cleared without snapshotting
    // The trace was wiped because the lap belongs to a different scenario.
  });

  it('does not promote when the lap was invalid (off-track / DSQ)', () => {
    fillTrace(1, 30, 80_000);
    useTimingStore.getState().handleLapData(packet({
      currentLapNum: 2,
      lastLapTimeInMS: 80_000,
      currentLapInvalid: 1,
      currentLapTimeInMS: 200,
      lapDistance: 30,
    }));
    expect(useTimingStore.getState().bestLapMs).toBe(0);
    expect(useTimingStore.getState().pbLapTrace.length).toBe(0);
  });
});

describe('timingStore — regression-streak detector', () => {
  it('skips a single out-of-order UDP frame without wiping the trace', () => {
    fillTrace(1, 25, 60_000); // last sample lands at d=1250, t=60_000
    const before = useTimingStore.getState().currentLapTrace.length;
    // One regressed frame (both distance and time go backwards beyond the
    // 20 m / 200 ms thresholds). It must NOT wipe the trace on its own.
    useTimingStore.getState().handleLapData(packet({
      currentLapNum: 1,
      lapDistance: 1_220,
      currentLapTimeInMS: 59_700,
    }));
    // Resume forward progress (must be ahead of the last accepted sample on
    // BOTH axes — d > 1250+10 and t > 60_000).
    useTimingStore.getState().handleLapData(packet({
      currentLapNum: 1,
      lapDistance: 1_300,
      currentLapTimeInMS: 60_500,
    }));
    const s = useTimingStore.getState();
    expect(s.currentLapTrace.length).toBeGreaterThanOrEqual(before);
    expect(s.regressionStreak).toBe(0); // forward frame reset the streak
  });

  it('wipes the trace after THREE consecutive regressed frames (true flashback)', () => {
    fillTrace(1, 25, 60_000);
    expect(useTimingStore.getState().currentLapTrace.length).toBeGreaterThanOrEqual(20);
    for (let i = 0; i < 3; i++) {
      useTimingStore.getState().handleLapData(packet({
        currentLapNum: 1,
        lapDistance: 200 - i * 25,        // sustained backwards
        currentLapTimeInMS: 5_000 - i * 500,
      }));
    }
    const s = useTimingStore.getState();
    expect(s.currentLapTrace.length).toBe(0);
    expect(s.regressionStreak).toBe(0); // counter resets after firing
  });
});
