import { TEAM_COLORS, COMPOUND_COLORS } from '@shared/types';

/**
 * Returns a CSS color string based on tyre surface/inner temperature.
 * Thresholds: <60 cold blue, 60-80 green, 80-100 bright green,
 * 100-120 yellow, 120-140 orange, 140+ red.
 */
export function tyreTempColor(t: number): string {
  if (!t || t === 0) return 'var(--grey)';
  if (t < 60) return '#4a90e2';
  if (t < 80) return '#27ae60';
  if (t < 100) return '#2ecc71';
  if (t < 120) return '#f5c518';
  if (t < 140) return 'var(--orange)';
  return 'var(--red)';
}

/**
 * Returns a CSS color string based on brake temperature.
 * Thresholds: <100 grey, 100-300 blue, 300-500 green,
 * 500-700 yellow, 700-900 orange, 900+ red.
 */
export function brakeTempColor(t: number): string {
  if (t < 100) return 'var(--grey)';
  if (t < 300) return '#4a90e2';
  if (t < 500) return 'var(--green)';
  if (t < 700) return 'var(--yellow)';
  if (t < 900) return 'var(--orange)';
  return 'var(--red)';
}

/**
 * Returns a CSS color string based on RPM percentage (0-100).
 * <70% green, 70-90% orange, 90%+ red.
 */
export function rpmColor(pct: number): string {
  if (pct < 70) return 'var(--green)';
  if (pct < 90) return 'var(--orange)';
  return 'var(--red)';
}

/**
 * Returns a CSS color string based on tyre wear percentage (0-100).
 * <30% green, 30-60% yellow, 60-80% orange, 80%+ red.
 */
export function wearColor(pct: number): string {
  if (pct < 30) return 'var(--green)';
  if (pct < 60) return 'var(--yellow)';
  if (pct < 80) return 'var(--orange)';
  return 'var(--red)';
}

/**
 * Look up team color by teamId. Falls back to grey.
 */
export function getTeamColor(teamId: number): string {
  return TEAM_COLORS[teamId] ?? TEAM_COLORS[255] ?? '#888888';
}

/**
 * Look up compound color by compound name (e.g. "SOFT", "MEDIUM").
 * Falls back to UNKNOWN grey.
 */
export function getCompoundColor(compound: string): string {
  const key = compound.toUpperCase() as keyof typeof COMPOUND_COLORS;
  return COMPOUND_COLORS[key] ?? COMPOUND_COLORS.UNKNOWN;
}
