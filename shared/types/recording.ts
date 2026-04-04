import type { Participant } from './session';
import type { CarSetup } from './telemetry';

export interface TelemetryFrame {
  t: number;
  s: number;
  th: number;
  br: number;
  g: number;
  r: number;
  d: number;
  st: number;
  ln: number;
  p: number;
  ts: [number, number, number, number];
  fl: number;
  er: number;
  gL: number;
  gN: number;
}

export interface RecordedLap {
  lapNum: number;
  lapTimeMs: number;
  s1Ms: number;
  s2Ms: number;
  s3Ms: number;
  valid: boolean;
  compound: string;
  tyreAge: number;
  maxSpeed: number;
  avgThrottle: number;
  avgBrake: number;
  startFrameIdx: number;
  endFrameIdx: number;
  setupLapRef: number | null;
  deleted?: boolean;
  notes?: string;
}

export interface RecordedStint {
  startLap: number;
  endLap: number;
  compound: string;
  compoundName: string;
}

export interface CarLap {
  lapNum: number;
  lapTimeMs: number;
  s1Ms: number;
  s2Ms: number;
  s3Ms: number;
  position: number;
  compound: string;
  tyreAge: number;
  pitStatus: number;
  numPitStops: number;
  valid: boolean;
}

export interface CarStint {
  startLap: number;
  endLap: number;
  compound: string;
}

export interface RaceData {
  participants: Participant[];
  carLaps: Record<number, CarLap[]>;
  carStints: Record<number, CarStint[]>;
}

export interface SessionDetail {
  version: number;
  id: string;
  startTime: number;
  endTime: number | null;
  track: string;
  sessionType: string;
  weather: string;
  setup: CarSetup | null;
  lapSetups: Record<number, CarSetup>;
  laps: RecordedLap[];
  stints: RecordedStint[];
  frames: TelemetryFrame[];
  raceData: RaceData;
}

export interface SessionSummary {
  id: string;
  startTime: number;
  endTime: number;
  track: string;
  sessionType: string;
  weather: string;
  lapCount: number;
  bestLapMs: number | null;
  duration: number | null;
  hasRaceData: boolean;
}

export interface RecordingStatus {
  isRecording: boolean;
  sessionId: string | null;
  lapCount: number;
  frameCount: number;
  startTime: number | null;
  currentLap: number;
}
