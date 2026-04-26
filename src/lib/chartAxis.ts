import type { PracticeRun, PracticeRunLap } from '@shared/types';

export type XAxisMode = 'lap' | 'tyreAge';

/**
 * Return the x-axis value for a lap under the chosen mode.
 *
 * - "lap":     stint-lap number (index + 1). Pre-existing behaviour.
 * - "tyreAge": tyre age in laps. Out-laps collapse to 0 — so stints with
 *              different warmup counts still align at the moment the tyres
 *              came out of the garage. Missing tyre age falls back to the
 *              lap index so we never drop data.
 */
export function xForLap(lap: PracticeRunLap, index: number, mode: XAxisMode): number {
  if (mode === 'tyreAge') {
    return lap.tyreAge != null ? lap.tyreAge : index;
  }
  return index + 1;
}

/**
 * Build the shared, sorted, unique X-axis array across a set of runs.
 * Every run's Y-series will be aligned to this X array when rendering.
 */
export function buildXData(runs: PracticeRun[], mode: XAxisMode): number[] {
  const xs = new Set<number>();
  for (const r of runs) {
    if (!r.laps) continue;
    r.laps.forEach((lap, i) => xs.add(xForLap(lap, i, mode)));
  }
  return Array.from(xs).sort((a, b) => a - b);
}

/** Human-facing axis label for the active mode. */
export function xAxisLabel(mode: XAxisMode): string {
  return mode === 'tyreAge' ? 'Tyre Age (laps)' : 'Stint Lap';
}

/**
 * Build an uPlot-aligned Y array for one run against a shared X array.
 *
 * `getY` receives the lap and returns a number (or null for "no data at
 * this lap"). If multiple laps collapse to the same X value (e.g. two
 * out-laps both with tyreAge=0), keep the first non-null.
 */
export function buildYArray(
  run: PracticeRun,
  xData: number[],
  mode: XAxisMode,
  getY: (lap: PracticeRunLap, index: number) => number | null,
): (number | null)[] {
  const xIndex = new Map(xData.map((x, i) => [x, i]));
  const out: (number | null)[] = new Array(xData.length).fill(null);
  if (!run.laps) return out;
  run.laps.forEach((lap, i) => {
    const x = xForLap(lap, i, mode);
    const idx = xIndex.get(x);
    if (idx == null) return;
    const y = getY(lap, i);
    if (y == null) return;
    if (out[idx] == null) out[idx] = y;
  });
  return out;
}

/**
 * Outlier-safe range helper — returns a `[min, max]` uPlot range callback
 * that clamps the axis to the `lower`/`upper` percentile of the supplied
 * values. One bad flashback-induced lap time (or a stray NaN) won't compress
 * the rest of the chart flat.
 *
 * Usage:
 *   y: { range: percentileRange(allYValues, { pad: 0.05 }) }
 */
export function percentileRange(
  values: Array<number | null | undefined>,
  opts: { lower?: number; upper?: number; pad?: number; floorZero?: boolean } = {},
) {
  const lower = opts.lower ?? 1;
  const upper = opts.upper ?? 95;
  const pad = opts.pad ?? 0.05;

  // Pre-compute clamped bounds once — uPlot calls the range fn on every pan
  // frame; re-sorting every call would be wasteful.
  const sorted = values
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .sort((a, b) => a - b);

  return (u: unknown, dataMin: number | null, dataMax: number | null): [number, number] => {
    if (sorted.length === 0) {
      const fallbackMin = dataMin ?? 0;
      const fallbackMax = dataMax ?? 1;
      return [fallbackMin, fallbackMax];
    }
    const pick = (p: number): number => {
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * (sorted.length - 1))));
      return sorted[idx];
    };
    let lo = pick(lower);
    let hi = pick(upper);
    if (lo === hi) {
      lo -= 1;
      hi += 1;
    }
    const span = hi - lo;
    lo = lo - span * pad;
    hi = hi + span * pad;
    if (opts.floorZero) lo = Math.max(0, lo);
    return [lo, hi];
  };
}
