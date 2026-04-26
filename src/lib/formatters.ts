/**
 * Zero-pad a number to 2 digits.
 */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Zero-pad a number to 3 digits.
 */
export function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

/**
 * Format milliseconds as M:SS.mmm (e.g. "1:23.456").
 * Returns '—' for zero/falsy values.
 */
export function fmtTime(ms: number | null | undefined): string {
  if (!ms || ms === 0) return '\u2014';
  const total = Math.round(ms); // avoid float precision artifacts
  const mins = Math.floor(total / 60000);
  const secs = Math.floor((total % 60000) / 1000);
  const milli = total % 1000;
  return `${mins}:${pad2(secs)}.${pad3(milli)}`;
}

/**
 * Format sector time as SS.mmm (e.g. "23.456").
 * Returns '—' for zero/falsy values.
 */
export function fmtSector(ms: number | null | undefined): string {
  if (!ms || ms === 0) return '\u2014';
  const secs = Math.floor(ms / 1000);
  const milli = ms % 1000;
  return `${secs}.${pad3(milli)}`;
}

/**
 * Format delta in milliseconds as seconds with 3 decimal places (e.g. "1.234s").
 */
export function fmtDelta(ms: number): string {
  return (ms / 1000).toFixed(3) + 's';
}

/**
 * Format a signed delta (e.g. "+1.234" or "-0.567").
 */
export function fmtDeltaSigned(ms: number): string {
  const sign = ms <= 0 ? '-' : '+';
  const abs = Math.abs(ms);
  return `${sign}${(abs / 1000).toFixed(3)}`;
}

/**
 * Format a timestamp as a readable date string (e.g. "04 Apr 2026, 15:30").
 * Returns '—' for falsy values.
 */
export function fmtDate(ts: number | null | undefined): string {
  if (!ts) return '\u2014';
  const d = new Date(ts);
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ', ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}

/**
 * Format a timestamp as an ISO-like file-safe string (e.g. "2026-04-04T15-30-00").
 */
export function fmtDateFile(ts: number | null | undefined): string {
  if (!ts) return 'unknown';
  const d = new Date(ts);
  return d.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Format a gap in milliseconds.
 * Under 60s: "1.234"
 * Over 60s: "1:01.234"
 */
export function fmtGap(ms: number): string {
  if (ms < 60000) return (ms / 1000).toFixed(3);
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3);
  return m + ':' + (Number(s) < 10 ? '0' : '') + s;
}

// ────────────────────────────────────────────────────────────────────────────
//  Chart-axis tick formatters — plug directly into uPlot's `axes[].values`.
//  Each takes (u, ticks, axisIdx, foundSpace, foundIncr) and returns string[].
//  Keep them lightweight — uPlot calls on every pan/zoom frame.
// ────────────────────────────────────────────────────────────────────────────

export const fmtLapTimeTick = (_u: unknown, ticks: number[]): Array<string | null> =>
  ticks.map((t) => {
    if (t == null || !Number.isFinite(t)) return null;
    const ms = Math.round(t * 1000);
    return fmtTime(ms);
  });

export const fmtFuelTick = (_u: unknown, ticks: number[]): Array<string | null> =>
  ticks.map((t) => (t == null || !Number.isFinite(t) ? null : `${t.toFixed(2)} kg`));

export const fmtDistanceTick = (_u: unknown, ticks: number[]): Array<string | null> =>
  ticks.map((t) => {
    if (t == null || !Number.isFinite(t)) return null;
    if (Math.abs(t) >= 1000) return `${(t / 1000).toFixed(2)} km`;
    return `${Math.round(t)} m`;
  });

export const fmtTempTick = (_u: unknown, ticks: number[]): Array<string | null> =>
  ticks.map((t) => (t == null || !Number.isFinite(t) ? null : `${Math.round(t)}°C`));

export const fmtPctTick = (_u: unknown, ticks: number[]): Array<string | null> =>
  ticks.map((t) => (t == null || !Number.isFinite(t) ? null : `${Math.round(t)}%`));

// ────────────────────────────────────────────────────────────────────────────
//  Series value formatters — plug into uPlot's `series[].value`.
//  Keep gap rendering consistent ("—" rather than raw `null`).
// ────────────────────────────────────────────────────────────────────────────

const EM_DASH = '\u2014';

export const valLapTime = (_u: unknown, v: number | null): string =>
  v == null ? EM_DASH : fmtTime(Math.round(v * 1000));

export const valFuel = (_u: unknown, v: number | null): string =>
  v == null ? EM_DASH : `${v.toFixed(2)} kg`;

export const valDistance = (_u: unknown, v: number | null): string => {
  if (v == null) return EM_DASH;
  return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(2)} km` : `${Math.round(v)} m`;
};

export const valTemp = (_u: unknown, v: number | null): string =>
  v == null ? EM_DASH : `${Math.round(v)}°C`;

export const valPct = (_u: unknown, v: number | null): string =>
  v == null ? EM_DASH : `${v.toFixed(1)}%`;

export const valSpeed = (_u: unknown, v: number | null): string =>
  v == null ? EM_DASH : `${Math.round(v)} km/h`;

export const valEnergy = (_u: unknown, v: number | null): string =>
  v == null ? EM_DASH : `${v.toFixed(2)} MJ`;

export const valMs = (_u: unknown, v: number | null): string =>
  v == null ? EM_DASH : `${v >= 0 ? '+' : ''}${v.toFixed(0)} ms`;

export const valDeltaSec = (_u: unknown, v: number | null): string =>
  v == null ? EM_DASH : `${v >= 0 ? '+' : ''}${(v / 1000).toFixed(3)} s`;
