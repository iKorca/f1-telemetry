import type { TelemetryData, LapDataPacket, CarStatusData, CarSetupsData, CarDamageData, MotionPacket, MotionExData } from './telemetry';
import type {
  SessionPacket, ParticipantsData, SessionHistoryData,
  EventData, FinalClassificationData, LobbyInfoData,
  TyreSetsData, TimeTrialData, LapPositionsData,
} from './session';
import type { RecordingStatus } from './recording';
import type { TunnelStatus } from './api';
import type { PracticeWorkbook } from './practice';

export interface RaceEngineerCar {
  name: string;
  teamId: number;
  raceNumber: number;
  position: number;
  currentLap: number;
  lastLapMs: number;
  bestLapMs: number;
  currentCompound: string;
  tyreAge: number;
  stints: Array<{ compound: string; startLap: number; endLap: number }>;
  numPitStops: number;
  gapToLeaderMs: number;
  gapToAheadMs: number;
  driverStatus: number;
  resultStatus: number;
  lapTimes: number[];
}

export interface RaceEngineerData {
  active: boolean;
  cars: RaceEngineerCar[];
}

export type WSMessage =
  | { type: 'telemetry'; data: TelemetryData }
  | { type: 'lapData'; data: LapDataPacket }
  | { type: 'carStatus'; data: CarStatusData }
  | { type: 'session'; data: SessionPacket }
  | { type: 'participants'; data: ParticipantsData }
  | { type: 'carSetups'; data: CarSetupsData }
  | { type: 'carDamage'; data: CarDamageData }
  | { type: 'motion'; data: MotionPacket }
  | { type: 'motionEx'; data: MotionExData }
  | { type: 'sessionHistory'; data: SessionHistoryData }
  | { type: 'event'; data: EventData }
  | { type: 'finalClassification'; data: FinalClassificationData }
  | { type: 'lobbyInfo'; data: LobbyInfoData }
  | { type: 'tyreSets'; data: TyreSetsData }
  | { type: 'timeTrial'; data: TimeTrialData }
  | { type: 'lapPositions'; data: LapPositionsData }
  | { type: 'raceEngineer'; data: RaceEngineerData }
  | { type: 'recStatus'; data: RecordingStatus }
  | { type: 'tunnel'; data: TunnelStatus }
  | { type: 'practiceUpdate'; data: PracticeWorkbook };
