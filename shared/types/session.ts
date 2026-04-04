export interface MarshalZone {
  zoneStart: number;
  zoneFlag: number;
  zoneFlagName: string;
}

export interface WeatherForecastItem {
  sessionType: number;
  timeOffset: number;
  weather: number;
  weatherName: string;
  trackTemperature: number;
  trackTempChange: number;
  airTemperature: number;
  airTempChange: number;
  rainPercentage: number;
}

export interface SessionPacket {
  weather: number;
  trackTemperature: number;
  airTemperature: number;
  totalLaps: number;
  trackLength: number;
  sessionType: number;
  trackId: number;
  formula: number;
  sessionTimeLeft: number;
  sessionDuration: number;
  pitSpeedLimit: number;
  weatherName: string;
  sessionTypeName: string;
  trackName: string;
  marshalZones: MarshalZone[];
  safetyCarStatus: number;
  safetyCarName: string;
  weatherForecast: WeatherForecastItem[];
  forecastAccuracy: number;
  pitStopWindowIdealLap: number;
  pitStopWindowLatestLap: number;
  pitStopRejoinPosition: number;
}

export interface Participant {
  aiControlled: number;
  driverId: number;
  networkId: number;
  teamId: number;
  raceNumber: number;
  nationality: number;
  name: string;
}

export interface ParticipantsData {
  numActiveCars: number;
  participants: Participant[];
  playerName: string;
}

export interface HistoryLap {
  lapNum: number;
  lapTimeInMS: number;
  sector1TimeInMS: number;
  sector2TimeInMS: number;
  sector3TimeInMS: number;
  lapValid: boolean;
}

export interface HistoryStint {
  endLap: number;
  actualCompound: number;
  visualCompound: number;
  compoundName: string;
}

export interface SessionHistoryData {
  carIdx: number;
  numLaps: number;
  numTyreStints: number;
  bestLapTimeLapNum: number;
  laps: HistoryLap[];
  stints: HistoryStint[];
}
