/**
 * Pure helpers that drive the compound-strategy advisor on the glance
 * dashboard. Extracted from `CompoundDeltaTile.tsx` so they can be unit-
 * tested in isolation — the JSX presentation has no business doing the
 * weather → tyre-family mapping.
 */

export type Recommendation = 'DRY' | 'INTER' | 'WET';

/**
 * Pick the right tyre family for a given rain probability (%).
 *
 * F1 25 community consensus thresholds for the inter/wet crossover:
 *   - < 20 % rain   → slicks (any dry compound) are quickest
 *   - 20–65 % rain  → INTERs are quickest (track damp but not flooded)
 *   - > 65 % rain   → WETs are quickest (standing water, aquaplaning risk)
 *
 * The weather name overrides numeric thresholds for the obvious phrases
 * (heavy rain / storm always means WET; any "rain"/"wet" without a
 * percentage means INTER as a safe default).
 */
export function recommend(rainPct: number, weatherName: string): Recommendation {
  const heavy = /storm|heavy rain/i.test(weatherName);
  if (heavy || rainPct > 65) return 'WET';
  if (rainPct >= 20 || /rain|wet/i.test(weatherName)) return 'INTER';
  return 'DRY';
}

/**
 * Identify the tyre family of the currently-fitted compound. Returns
 * `null` when the compound is unknown (empty string / em-dash sentinel)
 * so callers can render a neutral state instead of a phantom "DRY".
 */
export function family(compound: string): Recommendation | null {
  const u = (compound || '').toUpperCase();
  if (!u || u === '—') return null;
  if (u === 'WET') return 'WET';
  if (u === 'INTER' || u === 'INTERMEDIATE') return 'INTER';
  // SOFT / MEDIUM / HARD / SUPER SOFT / etc. all map to DRY.
  return 'DRY';
}

/**
 * Display colour for each recommendation.
 *
 * DRY uses a brightened red (`#ff3a55`, ~6:1 contrast vs the dark tile
 * background) — the original `#e8002d` came in below WCAG AA at 4.19:1.
 */
export function recColor(r: Recommendation): string {
  switch (r) {
    case 'DRY':   return '#ff3a55';
    case 'INTER': return '#39d353';
    case 'WET':   return '#3b82f6';
  }
}

/**
 * Mono glyph baked next to each recommendation. Provides a non-color
 * encoder (sun / umbrella / heavy-rain umbrella) so red/green colour-
 * blind users can still distinguish DRY from INTER without relying on
 * hue alone.
 */
export function recIcon(r: Recommendation): string {
  switch (r) {
    case 'DRY':   return '☀';
    case 'INTER': return '☂';
    case 'WET':   return '☔';
  }
}
