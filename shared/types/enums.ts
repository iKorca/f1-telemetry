export const PACKET_IDS = {
  MOTION: 0,
  SESSION: 1,
  LAP_DATA: 2,
  EVENT: 3,
  PARTICIPANTS: 4,
  CAR_SETUPS: 5,
  CAR_TELEMETRY: 6,
  CAR_STATUS: 7,
  FINAL_CLASSIFICATION: 8,
  LOBBY_INFO: 9,
  CAR_DAMAGE: 10,
  SESSION_HISTORY: 11,
  TYRE_SETS: 12,
  MOTION_EX: 13,
  TIME_TRIAL: 14,
} as const;

export type PacketId = (typeof PACKET_IDS)[keyof typeof PACKET_IDS];

// F1 25 official team palette (id ↔ team mapping per the F1 25 UDP spec).
export const TEAM_COLORS: Record<number, string> = {
  0: '#27f4d2', // Mercedes
  1: '#e80020', // Ferrari
  2: '#3671c6', // Red Bull
  3: '#64c4ff', // Williams
  4: '#229971', // Aston Martin
  5: '#ff87bc', // Alpine
  6: '#6692ff', // RB (VCARB)
  7: '#b6babd', // Haas
  8: '#ff8000', // McLaren
  9: '#52e252', // Kick Sauber
  255: '#888888',
} as const;

export const COMPOUND_COLORS = {
  SOFT: '#ff3333',
  MEDIUM: '#f5c518',
  HARD: '#eeeeee',
  INTER: '#39d353',
  WET: '#3b82f6',
  UNKNOWN: '#888888',
} as const;

export type CompoundColor = (typeof COMPOUND_COLORS)[keyof typeof COMPOUND_COLORS];

export const WEATHER_ICONS = ['☀️', '⛅', '☁️', '🌧️', '🌧️', '⛈️'] as const;

export const DRIVER_STATUS = ['Garage', 'Flying', 'In Lap', 'Out Lap', 'On Track'] as const;

export const RESULT_STATUS = ['Invalid', 'Inactive', 'Active', 'Finished', 'DNF', 'DSQ', 'NC', 'RET'] as const;
