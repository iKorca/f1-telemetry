/**
 * Single source of truth for chart colours + wheel conventions.
 *
 * Until recently every per-lap chart re-declared `RUN_COLORS`, `WHEEL_COLORS`,
 * `WHEEL_LABELS`, and a small `avgWheels()` helper. Consolidating here kills
 * ~160 LOC of duplication and makes palette swaps (colour-blind preset, etc.)
 * a one-file change.
 */

export const RUN_COLORS = [
  '#e8002d', // red
  '#3b82f6', // blue
  '#39d353', // green
  '#f5c518', // yellow
  '#a855f7', // purple
  '#ec4899', // pink
];

/** Deuteranopia-friendly alternative — chosen for distinctness under CVD. */
export const RUN_COLORS_CVD = [
  '#d62728', // vermilion
  '#0072b2', // strong blue
  '#e69f00', // orange-yellow
  '#f0e442', // bright yellow
  '#cc79a7', // reddish-purple
  '#117733', // teal-green
];

// Tyre array order across the whole F1 25 UDP spec is [RL, RR, FL, FR].
// Keep that ordering everywhere (recorder, charts, setup pages).
export const WHEEL_LABELS = ['RL', 'RR', 'FL', 'FR'] as const;

export const WHEEL_COLORS = [
  '#e8002d', // RL — red
  '#f5c518', // RR — yellow
  '#3b82f6', // FL — blue
  '#39d353', // FR — green
];

/** Average of a 4-wheel numeric array, ignoring zeros. Null when all zero. */
export function avgWheels(arr: number[] | undefined | null): number | null {
  if (!arr) return null;
  const vals = arr.filter((v) => v > 0);
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Pick a run's colour by its stable selection index. */
export function runColor(index: number, palette: 'default' | 'cvd' = 'default'): string {
  const source = palette === 'cvd' ? RUN_COLORS_CVD : RUN_COLORS;
  return source[index % source.length];
}
