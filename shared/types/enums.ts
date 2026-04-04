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

export const TEAM_COLORS: Record<number, string> = {
  0: '#00d2be',
  1: '#dc0000',
  2: '#0600ef',
  3: '#005aff',
  4: '#0090ff',
  5: '#006f62',
  6: '#2b4562',
  7: '#b6babd',
  8: '#ff8700',
  9: '#ff0000',
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
