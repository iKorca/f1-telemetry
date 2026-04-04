// Re-export enums and constants from shared types
export {
  PACKET_IDS,
  TEAM_COLORS,
  COMPOUND_COLORS,
  WEATHER_ICONS,
  DRIVER_STATUS,
  RESULT_STATUS,
} from '@shared/types';

export type { PacketId, CompoundColor } from '@shared/types';

// Additional UI-specific constants

/** Maximum G-force value for display scaling */
export const MAX_G = 5;

/** Maximum RPM fallback for display scaling */
export const DEFAULT_MAX_RPM = 15000;

/** WebSocket reconnect delay in ms */
export const WS_RECONNECT_DELAY = 2000;

/** Data watchdog timeout in ms (no data = "waiting" state) */
export const DATA_WATCHDOG_TIMEOUT = 4000;

/** ERS full charge energy in Joules */
export const ERS_FULL_ENERGY = 4_000_000;

/** Safety car status names */
export const SAFETY_CAR_STATUS: Record<number, string> = {
  0: '',
  1: 'Full SC',
  2: 'VSC',
  3: 'Formation Lap',
};

/** Tab IDs for navigation */
export const TAB_IDS = [
  'dashboard',
  'timing',
  'race',
  'session',
  'history',
  'settings',
] as const;
