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
  aiDifficulty?: number;
  seasonLinkIdentifier?: number;
  weekendLinkIdentifier?: number;
  sessionLinkIdentifier?: number;
  steeringAssist?: number;
  brakingAssist?: number;
  gearboxAssist?: number;
  pitAssist?: number;
  pitReleaseAssist?: number;
  ERSAssist?: number;
  DRSAssist?: number;
  dynamicRacingLine?: number;
  dynamicRacingLineType?: number;
  gameMode?: number;
  ruleSet?: number;
  gameModeName?: string;
  ruleSetName?: string;
  timeOfDay?: number;
  sessionLength?: number;
  speedUnitsLeadPlayer?: number;
  temperatureUnitsLeadPlayer?: number;
  speedUnitsSecondaryPlayer?: number;
  temperatureUnitsSecondaryPlayer?: number;
  numSafetyCarPeriods?: number;
  numVirtualSafetyCarPeriods?: number;
  numRedFlagPeriods?: number;
}

export interface Participant {
  aiControlled: number;
  driverId: number;
  networkId: number;
  teamId: number;
  myTeam: number;
  raceNumber: number;
  nationality: number;
  name: string;
  platform: number;
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
  sector1Valid: boolean;
  sector2Valid: boolean;
  sector3Valid: boolean;
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
  bestSector1LapNum: number;
  bestSector2LapNum: number;
  bestSector3LapNum: number;
  laps: HistoryLap[];
  stints: HistoryStint[];
}

export interface EventData {
  eventStringCode: string;
  eventName: string;
  details: {
    vehicleIdx?: number;
    otherVehicleIdx?: number;
    lapTime?: number;
    reason?: number;
    penaltyType?: number;
    infringementType?: number;
    time?: number;
    lapNum?: number;
    placesGained?: number;
    penaltyTypeName?: string;
    infringementTypeName?: string;
    speed?: number;
    isOverallFastestInSession?: number;
    isDriverFastestInSession?: number;
    fastestVehicleIdxInSession?: number;
    fastestSpeedInSession?: number;
    numLights?: number;
    flashbackFrameIdentifier?: number;
    flashbackSessionTime?: number;
    buttonStatus?: number;
    overtakingVehicleIdx?: number;
    beingOvertakenVehicleIdx?: number;
    safetyCarType?: number;
    eventType?: number;
    safetyCarTypeName?: string;
    eventTypeName?: string;
    vehicle1Idx?: number;
    vehicle2Idx?: number;
  };
}

export interface FinalClassification {
  position: number;
  numLaps: number;
  gridPosition: number;
  points: number;
  numPitStops: number;
  resultStatus: number;
  resultStatusName: string;
  bestLapTimeInMS: number;
  totalRaceTime: number;
  penaltiesTime: number;
  numPenalties: number;
  numTyreStints: number;
  tyreStintsActual: number[];
  tyreStintsVisual: number[];
  tyreStintsEndLaps: number[];
  resultReason: number;
}

export interface FinalClassificationData {
  numCars: number;
  classifications: FinalClassification[];
}

export interface LobbyPlayer {
  aiControlled: number;
  teamId: number;
  nationality: number;
  platform: number;
  name: string;
  carNumber: number;
  yourTelemetry: number;
  showOnlineNames: number;
  techLevel: number;
  readyStatus: number;
}

export interface LobbyInfoData {
  numPlayers: number;
  players: LobbyPlayer[];
}

export interface TyreSetEntry {
  actualCompound: number;
  visualCompound: number;
  compoundName: string;
  wear: number;
  available: number;
  recommendedSession: number;
  lifeSpan: number;
  usableLife: number;
  lapDeltaTime: number;
  fitted: number;
}

export interface TyreSetsData {
  carIdx: number;
  sets: TyreSetEntry[];
  fittedIdx: number;
}

export interface TimeTrialSet {
  carIdx: number;
  teamId: number;
  lapTimeInMS: number;
  sector1TimeInMS: number;
  sector2TimeInMS: number;
  sector3TimeInMS: number;
  tractionControl: number;
  gearboxAssist: number;
  antiLockBrakes: number;
  equalCarPerformance: number;
  customSetup: number;
  valid: number;
}

export interface TimeTrialData {
  playerSessionBestDataSet: TimeTrialSet;
  personalBestDataSet: TimeTrialSet;
  rivalDataSet: TimeTrialSet;
}

export interface LapPositionsData {
  numLaps: number;
  lapStart: number;
  positionForVehicleIdx: number[][];
}
