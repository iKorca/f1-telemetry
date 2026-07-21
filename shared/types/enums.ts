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
  LAP_POSITIONS: 15,
  CAR_TELEMETRY2: 16,
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

  // The 2026-season content sits ALONGSIDE the stock 2025 cars rather than
  // replacing them, on its own team-id block. Values below are the primary
  // livery colours the game itself reports in the participants packet, so they
  // match what you see on track. Only a fallback: at runtime we prefer the
  // per-car livery colour off the wire (see driverColor()).
  //
  // The block is listed twice because the id is a different width per UDP
  // format. In the 2026 format m_teamId is a uint16 and these teams are 476-486;
  // on the legacy F1 25 format the same field is a uint8, so the game truncates
  // and they arrive as 220-230 (476 - 256 = 220). Mapping both keeps the colours
  // right whichever output format the game is set to.
  220: '#27f4d2', 476: '#27f4d2', // Mercedes
  221: '#e8002d', 477: '#e8002d', // Ferrari
  222: '#3671c6', 478: '#3671c6', // Red Bull
  223: '#1868db', 479: '#1868db', // Williams
  224: '#229971', 480: '#229971', // Aston Martin
  225: '#00a1e8', 481: '#00a1e8', // Alpine
  226: '#6692ff', 482: '#6692ff', // Racing Bulls
  227: '#dee1e2', 483: '#dee1e2', // Haas
  228: '#ff8000', 484: '#ff8000', // McLaren
  229: '#ff2d00', 485: '#ff2d00', // Audi
  230: '#aaaaad', 486: '#aaaaad', // Cadillac

  255: '#888888',
  65535: '#888888', // 2026 format's uint16 "no team" sentinel
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
