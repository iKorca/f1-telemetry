import type uPlot from 'uplot';

/**
 * Find sector boundary indices within a frames array for overlay rendering.
 * Returns an array of frame indices where sector transitions occur.
 */
export function findSectorBoundaries(
  frames: { t: number }[],
  lap: { s1Ms?: number; s2Ms?: number },
): number[] {
  if (!lap.s1Ms || !lap.s2Ms || frames.length < 3) return [];
  const startTime = frames[0].t;
  const s1End = startTime + lap.s1Ms;
  const s2End = startTime + lap.s1Ms + lap.s2Ms;
  const indices: number[] = [];
  for (let i = 0; i < frames.length; i++) {
    if (indices.length === 0 && frames[i].t >= s1End) indices.push(i);
    if (indices.length === 1 && frames[i].t >= s2End) {
      indices.push(i);
      break;
    }
  }
  return indices;
}

export interface SectorOverlayOptions {
  /** Stroke colors for each sector divider (cycled if fewer than indices). */
  colors?: string[];
  /** Line width. Default: 1.5 */
  lineWidth?: number;
  /** Dash pattern. Default: [6, 4] */
  lineDash?: number[];
}

const defaultOverlayOptions: Required<SectorOverlayOptions> = {
  colors: ['rgba(255,255,255,0.15)'],
  lineWidth: 1.5,
  lineDash: [6, 4],
};

/**
 * Create a uPlot plugin that draws sector divider lines.
 * Pass `options` to customise color, width, or dash pattern.
 */
export function sectorOverlayPlugin(
  sectorIndices: number[],
  options?: SectorOverlayOptions,
): uPlot.Plugin {
  if (!sectorIndices || sectorIndices.length === 0) return {} as uPlot.Plugin;
  const opts = { ...defaultOverlayOptions, ...options };
  return {
    hooks: {
      draw: [
        (u: uPlot) => {
          const ctx = u.ctx;
          const { left, top, height: plotH } = u.bbox;
          ctx.save();
          ctx.lineWidth = opts.lineWidth;
          ctx.setLineDash(opts.lineDash);
          sectorIndices.forEach((fi, i) => {
            const xPos = u.valToPos(fi, 'x', true);
            if (xPos < left) return;
            ctx.beginPath();
            ctx.strokeStyle = opts.colors[i % opts.colors.length];
            ctx.moveTo(xPos, top);
            ctx.lineTo(xPos, top + plotH);
            ctx.stroke();
          });
          ctx.restore();
        },
      ],
    },
  };
}

/**
 * Linearly interpolate / resample an array to a target length.
 */
export function resampleToLength(arr: number[], targetLen: number): number[] {
  if (arr.length === targetLen) return arr;
  const result: number[] = [];
  for (let i = 0; i < targetLen; i++) {
    const srcIdx = (i / (targetLen - 1)) * (arr.length - 1);
    const low = Math.floor(srcIdx);
    const high = Math.min(low + 1, arr.length - 1);
    const frac = srcIdx - low;
    result.push(arr[low] * (1 - frac) + arr[high] * frac);
  }
  return result;
}

/**
 * Resample a comparison lap's values to align with the primary lap's time points.
 * Uses the `t` (lap time in ms) field from each frame for time-based alignment.
 * Both laps are normalised to start at t=0 so they align from the S/F line.
 */
export function resampleByTime(
  primaryTimes: number[],
  cmpTimes: number[],
  cmpValues: number[],
): number[] {
  if (cmpTimes.length < 2) return primaryTimes.map(() => 0);

  const pStart = primaryTimes[0];
  const cStart = cmpTimes[0];

  // Normalise both to start at 0
  const pNorm = primaryTimes.map((t) => t - pStart);
  const cNorm = cmpTimes.map((t) => t - cStart);
  const cMax = cNorm[cNorm.length - 1];

  const result: number[] = [];
  let ci = 0;

  for (let i = 0; i < pNorm.length; i++) {
    const target = pNorm[i];

    // Clamp to comparison lap range
    if (target <= 0) {
      result.push(cmpValues[0]);
      continue;
    }
    if (target >= cMax) {
      result.push(cmpValues[cmpValues.length - 1]);
      continue;
    }

    // Advance pointer
    while (ci < cNorm.length - 2 && cNorm[ci + 1] < target) ci++;

    // Interpolate
    const t0 = cNorm[ci];
    const t1 = cNorm[ci + 1];
    const frac = t1 > t0 ? (target - t0) / (t1 - t0) : 0;
    result.push(cmpValues[ci] * (1 - frac) + cmpValues[ci + 1] * frac);
  }

  return result;
}

/**
 * Find sector boundaries by time value (for time-based x-axis).
 * Returns the actual time values (not indices) where sectors end.
 */
export function findSectorBoundariesByTime(
  frames: { t: number }[],
  lap: { s1Ms?: number; s2Ms?: number },
): number[] {
  if (!lap.s1Ms || !lap.s2Ms || frames.length < 3) return [];
  const startTime = frames[0].t;
  return [startTime + lap.s1Ms, startTime + lap.s1Ms + lap.s2Ms];
}

/**
 * Sector overlay plugin that works with time-based x-axis.
 */
export function sectorOverlayPluginTime(
  sectorTimes: number[],
  options?: SectorOverlayOptions,
): uPlot.Plugin {
  if (!sectorTimes || sectorTimes.length === 0) return {} as uPlot.Plugin;
  const opts = { ...defaultOverlayOptions, ...options };
  return {
    hooks: {
      draw: [
        (u: uPlot) => {
          const ctx = u.ctx;
          const { left, top, height: plotH } = u.bbox;
          ctx.save();
          ctx.lineWidth = opts.lineWidth;
          ctx.setLineDash(opts.lineDash);
          sectorTimes.forEach((t, i) => {
            const xPos = u.valToPos(t, 'x', true);
            if (xPos < left) return;
            ctx.beginPath();
            ctx.strokeStyle = opts.colors[i % opts.colors.length];
            ctx.moveTo(xPos, top);
            ctx.lineTo(xPos, top + plotH);
            ctx.stroke();
          });
          ctx.restore();
        },
      ],
    },
  };
}
