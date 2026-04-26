import { describe, it, expect } from 'vitest';
import { deltaMsAtDistance, MIN_PB_TRACE_SAMPLES, type TracePoint } from '../src/lib/lapUtils';

/**
 * Build a synthetic linear PB trace at 50 m intervals so PB time at
 * distance d is exactly `(d / trackLength) * pbTotalMs` — easy to assert
 * against without floating-point fuzz.
 */
function linearTrace(trackLength: number, pbTotalMs: number): TracePoint[] {
  const pts: TracePoint[] = [];
  for (let d = 50; d < trackLength; d += 50) {
    pts.push({ d, t: Math.round((d / trackLength) * pbTotalMs) });
  }
  return pts;
}

describe('deltaMsAtDistance', () => {
  const trackLength = 5793; // Monza-ish
  const pbTotalMs = 80_245;
  const trace = linearTrace(trackLength, pbTotalMs);

  it('returns null when the trace is empty / too short', () => {
    expect(deltaMsAtDistance(null, 0, 0, 0, 0)).toBeNull();
    expect(deltaMsAtDistance([], 0, 0, 0, 0)).toBeNull();
    const tiny: TracePoint[] = Array.from({ length: MIN_PB_TRACE_SAMPLES - 1 }, (_, i) => ({ d: i * 10, t: i * 100 }));
    expect(deltaMsAtDistance(tiny, 0, 5_000, 200, 5_000)).toBeNull();
  });

  it('returns null inside the early-lap noise zone', () => {
    expect(deltaMsAtDistance(trace, pbTotalMs, 50, 200, trackLength)).toBeNull();   // t too small
    expect(deltaMsAtDistance(trace, pbTotalMs, 5_000, 30, trackLength)).toBeNull();  // d too small
  });

  it('returns null when distance is before the trace begins', () => {
    // First sample is at d = 50; pre-50 m readings would extrapolate backwards.
    expect(deltaMsAtDistance(trace, pbTotalMs, 5_000, 49, trackLength)).toBeNull();
  });

  it('returns 0 for a current lap exactly retracing the PB', () => {
    const d = 1_000;
    const pbTime = Math.round((d / trackLength) * pbTotalMs);
    const delta = deltaMsAtDistance(trace, pbTotalMs, pbTime, d, trackLength);
    expect(delta).toBeCloseTo(0, 0);
  });

  it('reports positive when slower than PB at the same distance', () => {
    const d = 2_500;
    const pbTime = Math.round((d / trackLength) * pbTotalMs);
    const delta = deltaMsAtDistance(trace, pbTotalMs, pbTime + 800, d, trackLength);
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeCloseTo(800, 0);
  });

  it('reports negative when faster than PB at the same distance', () => {
    const d = 4_000;
    const pbTime = Math.round((d / trackLength) * pbTotalMs);
    const delta = deltaMsAtDistance(trace, pbTotalMs, pbTime - 350, d, trackLength);
    expect(delta).toBeLessThan(0);
    expect(delta).toBeCloseTo(-350, 0);
  });

  it('extrapolates past the last sample to (trackLength, pbTotalMs)', () => {
    const last = trace[trace.length - 1];
    // Halfway between the last sample and the finish line.
    const d = (last.d + trackLength) / 2;
    const expectedPbTime = (last.t + pbTotalMs) / 2;
    const delta = deltaMsAtDistance(trace, pbTotalMs, expectedPbTime + 200, d, trackLength);
    // Strict equality: the math is closed-form linear, no rounding involved
    // unless the trace itself rounded — assert the exact 200 ms offset so
    // a regression in the interpolation can't hide inside slack tolerance.
    expect(delta).toBe(200);
  });

  it('returns null when trackLength is missing or shorter than the last sample', () => {
    const last = trace[trace.length - 1];
    expect(deltaMsAtDistance(trace, pbTotalMs, 90_000, last.d + 10, 0)).toBeNull();
    expect(deltaMsAtDistance(trace, pbTotalMs, 90_000, last.d + 10, last.d - 1)).toBeNull();
  });

  it('returns null when pbTotalMs is less than the last sample (corrupt finish)', () => {
    const last = trace[trace.length - 1];
    expect(deltaMsAtDistance(trace, last.t - 5, 90_000, last.d + 10, trackLength)).toBeNull();
  });

  it('handles equality at finish (pbTotalMs === last.t) without rejecting', () => {
    const last = trace[trace.length - 1];
    // last sample IS the finish line — return delta vs. that fixed time.
    const delta = deltaMsAtDistance(trace, last.t, last.t + 500, last.d + 5, trackLength);
    expect(delta).toBeCloseTo(500, 0);
  });

  // ── Acceptance / rejection boundaries ───────────────────────────────────
  // Each guard has the form `< THRESHOLD → reject`, so:
  //   • value === threshold should be ACCEPTED (nominal)
  //   • value === threshold − 1 should be REJECTED
  // Lock both sides so a future `<=` typo can't silently drop valid traces.

  it('accepts at the MIN_PB_TRACE_SAMPLES boundary, rejects one below', () => {
    const exactlyMin: TracePoint[] = Array.from(
      { length: MIN_PB_TRACE_SAMPLES },
      (_, i) => ({ d: 50 + i * 50, t: 1_000 + i * 1_000 }),
    );
    const oneShort: TracePoint[] = exactlyMin.slice(0, -1);
    // At the exact threshold we should get a real number back.
    expect(deltaMsAtDistance(exactlyMin, 30_000, 5_000, 200, 30_000)).not.toBeNull();
    expect(deltaMsAtDistance(oneShort,   30_000, 5_000, 200, 30_000)).toBeNull();
  });

  it('accepts at the EARLY_LAP_MS boundary, rejects one below', () => {
    const d = 1_000;
    const pbTime = Math.round((d / trackLength) * pbTotalMs);
    // currentLapTimeMs <= 100 → null. So at 101 ms we expect a number, at 100 ms null.
    expect(deltaMsAtDistance(trace, pbTotalMs, 101, d, trackLength)).not.toBeNull();
    expect(deltaMsAtDistance(trace, pbTotalMs, 100, d, trackLength)).toBeNull();
    // sanity: the delta at 101 ms is just (101 − pbTime) — far enough from zero to test the path
    expect(deltaMsAtDistance(trace, pbTotalMs, pbTime, d, trackLength)).toBe(0);
  });

  it('accepts at the NEAR_START_M boundary, rejects one below', () => {
    // Use a trace whose first sample is at 50 m so distance-vs-trace[0] doesn't reject first.
    expect(deltaMsAtDistance(trace, pbTotalMs, 5_000, 50, trackLength)).not.toBeNull();
    expect(deltaMsAtDistance(trace, pbTotalMs, 5_000, 49, trackLength)).toBeNull();
  });

  // Note on the `span <= 0` guard inside `deltaMsAtDistance`'s binary
  // search: it's defensive-only. The search uses `lo = mid` greedily on
  // equal-d, so for any monotonically-non-decreasing trace the bracketing
  // pair never has `a.d === b.d`. The guard exists to harden against a
  // corrupted trace, not against a normal in-order one — there's no
  // realistic test fixture that lands on it.
});
