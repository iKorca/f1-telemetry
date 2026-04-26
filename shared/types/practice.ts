import type { CarSetup } from './telemetry';

/**
 * A single practice "run" = one stint from any session.
 * Auto-split by compound change, setup change, or pit stop.
 */
export interface PracticeRun {
  id: string;
  sessionId: string;
  timestamp: number;
  label: string;
  condition: 'dry' | 'wet';
  compound: string;
  setup: CarSetup | null;
  weather: string;
  trackTemp?: number;
  airTemp?: number;
  notes: string;
  pinned: boolean;

  // Aggregated stats (pre-computed on save)
  lapCount: number;
  validLapCount: number;
  bestLapMs: number;
  avgLapMs: number;
  bestS1Ms: number;
  bestS2Ms: number;
  bestS3Ms: number;
  maxSpeed: number;
  avgThrottle: number;
  avgBrake: number;
  consistency: number; // 0-100

  // Fuel metrics (kg per lap)
  avgFuelPerLap: number;
  maxFuelPerLap: number;

  // Tyre degradation (ms per lap — positive = getting slower)
  avgDegradationMs: number;
  maxDegradationMs: number;

  // Tyre wear at end of stint (% per wheel: [RL, RR, FL, FR])
  tyreWearEnd: [number, number, number, number];
  avgTyreWear: number;   // average across 4 wheels at end
  maxTyreWear: number;   // worst wheel at end

  // Engine temperature (average and max across stint)
  avgEngineTemp: number;
  maxEngineTemp: number;

  // Tyre temperatures (average across stint, per wheel: [RL, RR, FL, FR])
  avgTyreSurfaceTemp: [number, number, number, number];
  avgTyreInnerTemp: [number, number, number, number];
  maxTyreSurfaceTemp: [number, number, number, number];
  maxTyreInnerTemp: [number, number, number, number];

  // Lap indices in the source session (for loading frames on demand)
  lapIndices: number[];

  // Individual lap details (embedded for display)
  laps?: PracticeRunLap[];
}

/**
 * Per-lap data within a practice run (loaded on demand for comparison).
 */
export interface PracticeRunLap {
  lapNum: number;
  lapTimeMs: number;
  s1Ms: number;
  s2Ms: number;
  s3Ms: number;
  maxSpeed: number;
  avgThrottle: number;
  avgBrake: number;
  tyreAge: number;
  fuel: number;
  tyreWear: [number, number, number, number];         // % at lap end [RL, RR, FL, FR]
  avgSurfaceTemp: [number, number, number, number];   // avg during lap [RL, RR, FL, FR]
  avgInnerTemp: [number, number, number, number];     // avg during lap [RL, RR, FL, FR]
  avgBrakeTemp?: [number, number, number, number];    // avg during lap
  avgPressure?: [number, number, number, number];     // avg during lap (psi)
  avgEngineTemp: number;                              // avg during lap
  avgBatteryPct?: number;                             // 0-100, averaged across lap
  ersHarvestedMJ?: number;                            // energy harvested this lap (MJ)
  ersDeployedMJ?: number;                             // energy deployed this lap (MJ)
  valid: boolean;
  isOutLap?: boolean;
  isPitLap?: boolean;
  trafficLap?: boolean;                                // auto-flagged by MAD outlier detection
  flag?: 'traffic' | 'mistake' | 'reference' | 'clean' | null;
  notes?: string;
  trackTemp?: number | null;                           // °C at lap completion
  airTemp?: number | null;                             // °C at lap completion
  weather?: string | null;                             // e.g. "Light Cloud"
}

/**
 * Persistent workbook for a track — stored server-side.
 */
export interface PracticeWorkbook {
  trackName: string;
  runs: PracticeRun[];
  baselineRunId: string | null;
  lastUpdated: number;
}

/**
 * Summary of available tracks with practice data.
 */
export interface PracticeTrackSummary {
  trackName: string;
  runCount: number;
  lastUpdated: number;
}
