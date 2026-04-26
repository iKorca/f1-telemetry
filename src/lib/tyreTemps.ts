/**
 * F1 25 optimal tyre carcass (inner) temperature windows per compound.
 *
 * Values sourced from the simracingsetup.com F1 25 tyre guide. The "optimal"
 * figure is the temp at which the tyre delivers peak grip and minimum wear.
 * Deviation in either direction trades grip for either cold/under- or
 * over-heating behaviour.
 *
 * Reference: https://simracingsetup.com/ea-sports-f1/f1-25-tyre-guide/
 *
 * Note on the "middle number" vs "top number" from the HUD: the carcass (inner)
 * temperature is the slow-moving, load-bearing reading. The surface temperature
 * swings second-to-second and is not the right signal for a "window" check.
 * These windows are keyed to **carcass (inner) temperature**.
 */

export interface TempWindow {
  min: number;
  optimal: number;
  max: number;
}

/**
 * Indexed by the actual compound code (C0–C6) as well as the visual compound
 * the driver sees on their HUD (SOFT/MEDIUM/HARD/INTER/WET).
 *
 * Visual compounds are ambiguous across race weekends — at one track SOFT is
 * C5 and at another it's C4. For the visual-only fallback we assume the most
 * common FIA allocation (C3/C4/C5 = HARD/MEDIUM/SOFT).
 */
export const TYRE_TEMP_WINDOWS: Record<string, TempWindow> = {
  // Actual compounds — exact
  C0: { min: 90, optimal: 100, max: 115 }, // same as C1 per spec (hardest dry)
  C1: { min: 90, optimal: 100, max: 115 },
  C2: { min: 85, optimal: 95,  max: 115 },
  C3: { min: 80, optimal: 90,  max: 105 },
  C4: { min: 75, optimal: 85,  max: 100 },
  C5: { min: 70, optimal: 80,  max: 90  },
  C6: { min: 65, optimal: 75,  max: 85  },

  // Visual compounds — mapped to the standard C3/C4/C5 allocation
  HARD:   { min: 80, optimal: 90, max: 105 },
  MEDIUM: { min: 75, optimal: 85, max: 100 },
  SOFT:   { min: 70, optimal: 80, max: 90  },

  // Wet compounds
  INTER:        { min: 60, optimal: 70, max: 80 },
  INTERMEDIATE: { min: 60, optimal: 70, max: 80 },
  WET:          { min: 50, optimal: 60, max: 70 },
};

export type TempStatus = 'cold' | 'optimal' | 'hot' | 'unknown';

/**
 * Classify a carcass temperature against the compound's optimal window.
 * Anything inside [min, max] counts as "optimal" — the HUD wants a boolean
 * in/out distinction, not a scalar.
 */
export function tyreTempStatus(temp: number, compound: string | undefined | null): TempStatus {
  if (!temp || !compound) return 'unknown';
  const win = TYRE_TEMP_WINDOWS[compound.toUpperCase()];
  if (!win) return 'unknown';
  if (temp < win.min) return 'cold';
  if (temp > win.max) return 'hot';
  return 'optimal';
}

/**
 * Look up the optimal window for a compound. Returns null if the compound
 * name isn't in our table — prevents silent defaults that mislead the driver.
 */
export function getTempWindow(compound: string | undefined | null): TempWindow | null {
  if (!compound) return null;
  return TYRE_TEMP_WINDOWS[compound.toUpperCase()] ?? null;
}

/**
 * CSS color matching the status. Greens for optimal, blue for cold,
 * red for overheat. Tuned to match the existing palette variables.
 */
export function tempStatusColor(status: TempStatus): string {
  switch (status) {
    case 'optimal': return 'var(--green)';
    case 'cold':    return '#4a90e2';
    case 'hot':     return 'var(--red)';
    default:        return 'var(--grey)';
  }
}
