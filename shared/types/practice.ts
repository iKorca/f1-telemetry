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
  valid: boolean;
  isOutLap?: boolean;
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
