export interface CarTelemetry {
  speed: number;
  throttle: number;
  steer: number;
  brake: number;
  clutch: number;
  gear: number;
  engineRPM: number;
  drs: number;
  revLightsPercent: number;
  revLightsBitValue: number;
  brakesTemperature: [number, number, number, number];
  tyresSurfaceTemperature: [number, number, number, number];
  tyresInnerTemperature: [number, number, number, number];
  engineTemperature: number;
  tyresPressure: [number, number, number, number];
  surfaceType: [number, number, number, number];
  surfaceTypeNames: [string, string, string, string];
}

export interface TelemetryData {
  playerData: CarTelemetry | null;
  allCars: CarTelemetry[];
  suggestedGear: number | null;
}

export interface MotionData {
  worldPositionX: number;
  worldPositionY: number;
  worldPositionZ: number;
  worldVelocityX: number;
  worldVelocityY: number;
  worldVelocityZ: number;
  worldForwardDirX: number;
  worldForwardDirY: number;
  worldForwardDirZ: number;
  worldRightDirX: number;
  worldRightDirY: number;
  worldRightDirZ: number;
  gForceLateral: number;
  gForceLongitudinal: number;
  gForceVertical: number;
  yaw: number;
  pitch: number;
  roll: number;
}

export interface MotionExData {
  suspensionPosition: [number, number, number, number];
  suspensionVelocity: [number, number, number, number];
  suspensionAcceleration: [number, number, number, number];
  wheelSpeed: [number, number, number, number];
  wheelSlipRatio: [number, number, number, number];
  wheelSlipAngle: [number, number, number, number];
  wheelLatForce: [number, number, number, number];
  wheelLongForce: [number, number, number, number];
  heightOfCOGAboveGround: number;
  localVelocityX: number;
  localVelocityY: number;
  localVelocityZ: number;
  angularVelocityX: number;
  angularVelocityY: number;
  angularVelocityZ: number;
  angularAccelerationX: number;
  angularAccelerationY: number;
  angularAccelerationZ: number;
  frontWheelsAngle: number;
  wheelVertForce: [number, number, number, number];
  frontAeroHeight: number;
  rearAeroHeight: number;
  frontRollAngle: number;
  rearRollAngle: number;
  chassisYaw: number;
  chassisPitch: number;
}

export interface MotionPacket {
  playerData: MotionData | null;
  allCars: MotionData[];
}

export interface LapData {
  lastLapTimeInMS: number;
  currentLapTimeInMS: number;
  sector1TimeInMS: number;
  sector2TimeInMS: number;
  deltaToCarInFrontInMS: number;
  deltaToLeaderInMS: number;
  lapDistance: number;
  totalDistance: number;
  carPosition: number;
  currentLapNum: number;
  pitStatus: number;
  numPitStops: number;
  sector: number;
  currentLapInvalid: number;
  penalties: number;
  totalWarnings: number;
  cornerCuttingWarnings: number;
  gridPosition: number;
  driverStatus: number;
  resultStatus: number;
  pitLaneTimerActive: number;
  pitLaneTimeInLaneInMS: number;
  pitStopTimerInMS: number;
  pitStopShouldServePen: number;
  numUnservedDriveThroughPens: number;
  numUnservedStopGoPens: number;
  speedTrapFastestSpeed: number;
  speedTrapFastestLap: number;
  driverStatusName: string;
  resultStatusName: string;
  pitStatusName: string;
}

export interface LapDataPacket {
  playerData: LapData | null;
  allCars: LapData[];
}

export interface CarStatus {
  tractionControl: number;
  antiLockBrakes: number;
  fuelMix: number;
  frontBrakeBias: number;
  pitLimiterStatus: number;
  fuelInTank: number;
  fuelCapacity: number;
  fuelRemainingLaps: number;
  maxRPM: number;
  idleRPM: number;
  maxGears: number;
  drsAllowed: number;
  drsActivationDistance: number;
  actualTyreCompound: number;
  visualTyreCompound: number;
  tyresAgeLaps: number;
  vehicleFiaFlags: number;
  enginePowerICE: number;
  enginePowerMGUK: number;
  ersStoreEnergy: number;
  ersDeployMode: number;
  ersHarvestedThisLapMGUK: number;
  ersHarvestedThisLapMGUH: number;
  ersDeployedThisLap: number;
  networkPaused: number;
  tyreCompoundName: string;
  ersDeployModeName: string;
}

export interface CarStatusData {
  playerData: CarStatus | null;
  allCars: CarStatus[];
}

export interface CarSetup {
  frontWing: number;
  rearWing: number;
  onThrottle: number;
  offThrottle: number;
  frontCamber: number;
  rearCamber: number;
  frontToe: number;
  rearToe: number;
  frontSuspension: number;
  rearSuspension: number;
  frontAntiRollBar: number;
  rearAntiRollBar: number;
  frontSuspensionHeight: number;
  rearSuspensionHeight: number;
  brakePressure: number;
  brakeBias: number;
  rearLeftTyrePressure: number;
  rearRightTyrePressure: number;
  frontLeftTyrePressure: number;
  frontRightTyrePressure: number;
  ballast: number;
  fuelLoad: number;
}

export interface CarSetupsData {
  playerData: CarSetup | null;
  allCars: CarSetup[];
}

export interface CarDamage {
  tyresWear: [number, number, number, number];
  tyresDamage: [number, number, number, number];
  brakesDamage: [number, number, number, number];
  frontLeftWingDamage: number;
  frontRightWingDamage: number;
  rearWingDamage: number;
  floorDamage: number;
  diffuserDamage: number;
  sidepodDamage: number;
  drsFault: number;
  ersFault: number;
  gearBoxDamage: number;
  engineDamage: number;
  engineMGUHWear: number;
  engineESWear: number;
  engineCEWear: number;
  engineICEWear: number;
  engineMGUKWear: number;
  engineTCWear: number;
  engineBlown: number;
  engineSeized: number;
}

export interface CarDamageData {
  playerData: CarDamage | null;
  allCars: CarDamage[];
}
