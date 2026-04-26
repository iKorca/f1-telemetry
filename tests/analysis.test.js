import { describe, it, expect } from 'vitest';
import {
  median,
  mad,
  linearFit,
  theoreticalBest,
  extrapolateWear,
  detectTrafficLaps,
  recomputeRunAggregates,
} from '../server/analysis.js';

// Helpers
const makeLap = (lapNum, overrides = {}) => ({
  lapNum,
  lapTimeMs: 80000,
  s1Ms: 26000,
  s2Ms: 27000,
  s3Ms: 27000,
  maxSpeed: 300,
  avgThrottle: 0.65,
  avgBrake: 0.15,
  tyreAge: lapNum,
  fuel: 2.5,
  tyreWear: [5, 5, 5, 5],
  valid: true,
  isOutLap: false,
  isPitLap: false,
  trafficLap: false,
  flag: null,
  ...overrides,
});

describe('median', () => {
  it('returns 0 on empty input', () => expect(median([])).toBe(0));
  it('handles odd length', () => expect(median([1, 5, 2])).toBe(2));
  it('averages the middle two on even length', () => expect(median([1, 2, 3, 4])).toBe(2.5));
  it('does not mutate the input', () => {
    const xs = [3, 1, 2];
    median(xs);
    expect(xs).toEqual([3, 1, 2]);
  });
});

describe('mad', () => {
  it('returns 0 on empty input', () => expect(mad([])).toBe(0));
  it('gives zero when all values equal the median', () => {
    expect(mad([5, 5, 5, 5])).toBe(0);
  });
  it('matches classic example', () => {
    // median=2, deviations=[1,1,0,1,2] → MAD=1
    expect(mad([1, 1, 2, 2, 4])).toBe(1);
  });
});

describe('linearFit', () => {
  it('returns null on too-short input', () => {
    expect(linearFit([1], [1])).toBeNull();
  });
  it('fits y = 2x + 1 exactly', () => {
    const fit = linearFit([0, 1, 2, 3], [1, 3, 5, 7]);
    expect(fit).not.toBeNull();
    expect(fit.slope).toBeCloseTo(2, 6);
    expect(fit.intercept).toBeCloseTo(1, 6);
  });
  it('rejects degenerate x (all equal)', () => {
    expect(linearFit([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});

describe('theoreticalBest', () => {
  it('returns 0 for empty run', () => {
    expect(theoreticalBest({ laps: [] })).toBe(0);
  });
  it('picks the best sector from different laps', () => {
    const run = {
      laps: [
        { s1Ms: 26000, s2Ms: 27500, s3Ms: 27500 }, // run-best S1
        { s1Ms: 26500, s2Ms: 27000, s3Ms: 27500 }, // run-best S2
        { s1Ms: 26500, s2Ms: 27500, s3Ms: 27000 }, // run-best S3
      ],
    };
    expect(theoreticalBest(run)).toBe(26000 + 27000 + 27000);
  });
  it('returns 0 if any sector is missing', () => {
    const run = { laps: [{ s1Ms: 26000, s2Ms: 0, s3Ms: 27000 }] };
    expect(theoreticalBest(run)).toBe(0);
  });
});

describe('extrapolateWear', () => {
  it('returns null on too-few laps', () => {
    expect(extrapolateWear([makeLap(1)])).toBeNull();
  });
  it('identifies the fastest-wearing wheel and projects laps to 100%', () => {
    // Worst wheel (FR, idx=3) wears 10% per lap starting at 10% on lap 1.
    const laps = [1, 2, 3, 4, 5].map((n) =>
      makeLap(n, { tyreWear: [5, 5, 5, 10 + (n - 1) * 10] }),
    );
    const res = extrapolateWear(laps);
    expect(res).not.toBeNull();
    expect(res.worstWheel).toBe(3);
    // latest = 50%, slope = 10 → (100-50)/10 = 5 more laps
    expect(res.lapsRemaining).toBe(5);
  });
  it('returns null when wear is flat', () => {
    const laps = [1, 2, 3].map((n) => makeLap(n, { tyreWear: [5, 5, 5, 5] }));
    expect(extrapolateWear(laps)).toBeNull();
  });
});

describe('detectTrafficLaps', () => {
  it('ignores stints with too-few clean laps', () => {
    const laps = [1, 2, 3].map(makeLap);
    expect(detectTrafficLaps(laps)).toBe(0);
    expect(laps.every((l) => !l.trafficLap)).toBe(true);
  });
  it('flags a clearly slow outlier lap', () => {
    const laps = [];
    // 6 clean laps with small jitter (±200 ms), plus one at +5 s (traffic)
    const jitter = [0, 100, -200, 150, -100, 50];
    for (let i = 1; i <= 6; i++) laps.push(makeLap(i, { lapTimeMs: 80000 + jitter[i - 1] }));
    laps.push(makeLap(7, { lapTimeMs: 85000 }));
    const flagged = detectTrafficLaps(laps);
    expect(flagged).toBeGreaterThanOrEqual(1);
    expect(laps[6].trafficLap).toBe(true);
    expect(laps[6].flag).toBe('traffic');
  });
  it('respects a manual flag override', () => {
    const laps = [];
    const jitter = [0, 100, -200, 150, -100, 50];
    for (let i = 1; i <= 6; i++) laps.push(makeLap(i, { lapTimeMs: 80000 + jitter[i - 1] }));
    laps.push(makeLap(7, { lapTimeMs: 85000, flag: 'clean' }));
    detectTrafficLaps(laps);
    expect(laps[6].trafficLap).toBeFalsy();
    expect(laps[6].flag).toBe('clean'); // user override preserved
  });
});

describe('recomputeRunAggregates', () => {
  it('fills best/avg from clean laps', () => {
    const run = {
      laps: [
        makeLap(1, { lapTimeMs: 80000 }),
        makeLap(2, { lapTimeMs: 81000 }),
        makeLap(3, { lapTimeMs: 79500 }),
      ],
    };
    recomputeRunAggregates(run);
    expect(run.bestLapMs).toBe(79500);
    expect(run.avgLapMs).toBe(Math.round((80000 + 81000 + 79500) / 3));
    expect(run.lapCount).toBe(3);
    expect(run.validLapCount).toBe(3);
  });

  it('zeroes bestLap when no clean/valid laps exist', () => {
    const run = { laps: [makeLap(1, { valid: false })] };
    recomputeRunAggregates(run);
    expect(run.bestLapMs).toBe(0);
    expect(run.avgLapMs).toBe(0);
  });

  it('computes consistency as high when lap times are tight', () => {
    const run = {
      laps: [80000, 80100, 80200, 80050].map((ms, i) => makeLap(i + 1, { lapTimeMs: ms })),
    };
    recomputeRunAggregates(run);
    expect(run.consistency).toBeGreaterThan(90);
  });

  it('skips tyreAge=0 laps in fuel averaging (out-laps)', () => {
    const run = {
      laps: [
        makeLap(1, { tyreAge: 0, fuel: 4.5 }), // out-lap — excluded
        makeLap(2, { fuel: 2.5 }),
        makeLap(3, { fuel: 2.6 }),
      ],
    };
    recomputeRunAggregates(run);
    expect(run.avgFuelPerLap).toBeCloseTo(2.55, 2);
    expect(run.maxFuelPerLap).toBe(2.6);
  });
});
