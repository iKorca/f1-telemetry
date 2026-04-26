/**
 * F1 25 UDP Telemetry Packet Parser
 * Based on the F1 2025 UDP Specification (packetFormat 2025)
 *
 * Packet header is 29 bytes. Tyre array order: [RL, RR, FL, FR]
 */

const PACKET_IDS = {
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
};

const HEADER_SIZE = 29;
const NUM_CARS = 22;

// Visual tyre compound (shown to user)
const VISUAL_TYRE = {
  16: 'SOFT',
  17: 'MEDIUM',
  18: 'HARD',
  7: 'INTER',
  8: 'WET',
};

// Actual tyre compound (C1–C5 etc.)
const ACTUAL_TYRE = {
  16: 'C5', 17: 'C4', 18: 'C3', 19: 'C2', 20: 'C1', 21: 'C0', 22: 'C6',
  7: 'INTER', 8: 'WET',
};

const SESSION_TYPES = [
  'Unknown',        // 0
  'P1', 'P2', 'P3', 'Short P',          // 1-4
  'Q1', 'Q2', 'Q3', 'Short Q', 'OSQ',   // 5-9
  'Sprint SO1', 'Sprint SO2', 'Sprint SO3', 'Short Sprint SO', 'OSS SO',  // 10-14
  'Race', 'Race 2', 'Race 3',           // 15-17
  'Time Trial',                          // 18
];

const WEATHER_NAMES = ['Clear', 'Light Cloud', 'Overcast', 'Light Rain', 'Heavy Rain', 'Storm'];

const TRACK_IDS = {
  '-1': 'Unknown',
  0: 'Melbourne', 1: 'Paul Ricard', 2: 'Shanghai',
  3: 'Bahrain', 4: 'Catalunya', 5: 'Monaco',
  6: 'Montreal', 7: 'Silverstone', 8: 'Hockenheim',
  9: 'Hungaroring', 10: 'Spa', 11: 'Monza',
  12: 'Singapore', 13: 'Suzuka', 14: 'Abu Dhabi',
  15: 'Austin', 16: 'Brazil', 17: 'Austria',
  18: 'Sochi', 19: 'Mexico City', 20: 'Baku',
  21: 'Bahrain Short', 22: 'Silverstone Short',
  23: 'Austin Short', 24: 'Suzuka Short',
  25: 'Hanoi', 26: 'Zandvoort', 27: 'Imola',
  28: 'Portimão', 29: 'Jeddah', 30: 'Miami',
  31: 'Las Vegas', 32: 'Lusail', 33: 'Madrid',
  34: 'Spa Short', 35: 'Monza Short', 36: 'Singapore Short',
  37: 'Suzuka Extended', 38: 'Abu Dhabi Short',
  39: 'Silverstone Reverse', 40: 'Austria Reverse', 41: 'Zandvoort Reverse',
};

const ERS_DEPLOY_MODES = ['None', 'Medium', 'Hotlap', 'Overtake'];

const MARSHAL_FLAGS = {
  0: 'NONE', 1: 'GREEN', 2: 'BLUE', 3: 'YELLOW', 4: 'RED',
};

const WEATHER_CHANGE = { 0: 'UP', 1: 'DOWN', 2: 'NONE' };

const EVENT_NAMES = {
  SSTA: 'Session Started',
  SEND: 'Session Ended',
  FTLP: 'Fastest Lap',
  RTMT: 'Retirement',
  DRSE: 'DRS Enabled',
  DRSD: 'DRS Disabled',
  TMPT: 'Team Mate In Pits',
  CHQF: 'Chequered Flag',
  RCWN: 'Race Winner',
  PENA: 'Penalty Issued',
  SPTP: 'Speed Trap Triggered',
  STLG: 'Start Lights',
  LGOT: 'Lights Out',
  DTSV: 'Drive Through Served',
  SGSV: 'Stop Go Served',
  FLBK: 'Flashback',
  BUTN: 'Button Status',
  RDFL: 'Red Flag',
  OVTK: 'Overtake',
  SCAR: 'Safety Car',
  VCAR: 'Virtual Safety Car',
  COLL: 'Collision',
};

const PENALTY_TYPES = [
  'Drive through', 'Stop Go', '5 second time penalty', '10 second time penalty',
  'Disqualified', 'Removed from formation lap', 'Parked too long timer', 'Tyre regulations',
  'This lap invalidated', 'This and next lap invalidated', 'This lap invalidated without reason',
  'This and next lap invalidated without reason', 'This and previous lap invalidated',
  'This and previous lap invalidated without reason', 'Retired', 'Black flag timer',
];

const INFRINGEMENT_TYPES = [
  'Blocking by slow driving', 'Blocking by wrong way driving', 'Reversing off the start line',
  'Big Collision', 'Small Collision', 'Collision failed to hand back position single',
  'Collision failed to hand back position multiple', 'Corner cutting gained time',
  'Corner cutting overtake single', 'Corner cutting overtake multiple', 'Crossed pit exit lane',
  'Ignoring blue flags', 'Ignoring yellow flags', 'Ignoring drive through', 'Too many drive throughs',
  'Drive through reminder serve within n laps', 'Drive through reminder serve this lap',
  'Pit lane speeding', 'Parked for too long', 'Ignoring tyre regulations', 'Too many penalties',
  'Multiple warnings', 'Approaching disqualification', 'Tyre regulations select single',
  'Tyre regulations select multiple', 'Lap invalidated corner cutting', 'Lap invalidated running wide',
  'Corner cutting ran wide gained time minor', 'Corner cutting ran wide gained time significant',
  'Corner cutting ran wide gained time extreme', 'Lap invalidated wall riding',
  'Lap invalidated flashback used', 'Lap invalidated reset to track', 'Blocking the pitlane',
  'Jump start', 'Safety car to car collision', 'Safety car illegal overtake',
  'Safety car exceeding allowed pace', 'Virtual safety car exceeding allowed pace',
  'Formation lap below allowed speed', 'Formation lap parking', 'Retired mechanical failure',
  'Retired terminally damaged', 'Safety car falling too far back', 'Black flag timer',
  'Unserved stop go penalty', 'Unserved drive through penalty', 'Engine component change',
  'Gearbox change', 'Parc Fermé change', 'League grid penalty', 'Retry penalty', 'Illegal time gain',
  'Mandatory pitstop', 'Attribute assigned',
];

const SURFACE_TYPES = [
  'Tarmac', 'Rumble strip', 'Concrete', 'Rock', 'Gravel', 'Mud',
  'Sand', 'Grass', 'Water', 'Cobblestone', 'Metal', 'Ridged',
];

const SAFETY_CAR_EVENT_TYPES = ['Deployed', 'Returning', 'Returned', 'Resume Race'];
const SAFETY_CAR_TYPES       = ['No Safety Car', 'Full Safety Car', 'Virtual Safety Car', 'Formation Lap'];

const RESULT_STATUS_NAMES = [
  'Invalid', 'Inactive', 'Active', 'Finished', 'Did Not Finish',
  'Disqualified', 'Not Classified', 'Retired',
];

const DRIVER_STATUS_NAMES = ['In Garage', 'Flying Lap', 'In Lap', 'Out Lap', 'On Track'];

const PIT_STATUS_NAMES = ['None', 'Pitting', 'In Pit Area'];

const FUEL_MIX_NAMES = ['Lean', 'Standard', 'Rich', 'Max'];

const GAME_MODES = {
  0: 'Event Mode',
  3: 'Grand Prix',
  4: 'Grand Prix \'23',
  5: 'Time Trial',
  6: 'Splitscreen',
  7: 'Online Custom',
  8: 'Online League',
  11: 'Career Invitational',
  12: 'Championship Invitational',
  13: 'Championship',
  14: 'Online Championship',
  15: 'Online Weekly Event',
  17: 'Story Mode',
  19: 'Career \'22',
  20: 'Career \'22 Online',
  21: 'Career \'23',
  22: 'Career \'23 Online',
  23: 'Driver Career \'24',
  24: 'Driver Career Online \'24',
  25: 'My Team Career \'24',
  26: 'My Team Career Online \'24',
  27: 'Curated Career \'24',
  93: 'Benchmark',
};

const RULE_SETS = {
  0: 'Practice & Qualifying',
  1: 'Race',
  2: 'Time Trial',
  4: 'Time Attack',
  6: 'Checkpoint Challenge',
  8: 'Autocross',
  9: 'Drift',
  10: 'Average Speed Zone',
  11: 'Rival Duel',
};

// ─── Header ──────────────────────────────────────────────────────────────────

function parseHeader(buf) {
  return {
    packetFormat: buf.readUInt16LE(0),        // should be 2025
    gameYear: buf.readUInt8(2),
    gameMajorVersion: buf.readUInt8(3),
    gameMinorVersion: buf.readUInt8(4),
    packetVersion: buf.readUInt8(5),
    packetId: buf.readUInt8(6),
    sessionUID: buf.readBigUInt64LE(7).toString(),
    sessionTime: buf.readFloatLE(15),
    frameIdentifier: buf.readUInt32LE(19),
    overallFrameIdentifier: buf.readUInt32LE(23),
    playerCarIndex: buf.readUInt8(27),
    secondaryPlayerCarIndex: buf.readUInt8(28),
  };
}

// ─── Packet 0: Motion ────────────────────────────────────────────────────────
// MotionData = 60 bytes per car

function parseMotion(buf, header) {
  const SIZE = 60;
  const cars = [];

  for (let i = 0; i < NUM_CARS; i++) {
    const o = HEADER_SIZE + i * SIZE;
    if (o + SIZE > buf.length) break;

    cars.push({
      worldPositionX:    buf.readFloatLE(o),
      worldPositionY:    buf.readFloatLE(o + 4),
      worldPositionZ:    buf.readFloatLE(o + 8),
      worldVelocityX:    buf.readFloatLE(o + 12),
      worldVelocityY:    buf.readFloatLE(o + 16),
      worldVelocityZ:    buf.readFloatLE(o + 20),
      worldForwardDirX:  buf.readInt16LE(o + 24),
      worldForwardDirY:  buf.readInt16LE(o + 26),
      worldForwardDirZ:  buf.readInt16LE(o + 28),
      worldRightDirX:    buf.readInt16LE(o + 30),
      worldRightDirY:    buf.readInt16LE(o + 32),
      worldRightDirZ:    buf.readInt16LE(o + 34),
      gForceLateral:     buf.readFloatLE(o + 36),
      gForceLongitudinal: buf.readFloatLE(o + 40),
      gForceVertical:    buf.readFloatLE(o + 44),
      yaw:               buf.readFloatLE(o + 48),
      pitch:             buf.readFloatLE(o + 52),
      roll:              buf.readFloatLE(o + 56),
    });
  }

  return {
    playerData: cars[header.playerCarIndex] || null,
    allCars: cars,
  };
}

// ─── Packet 6: Car Telemetry ──────────────────────────────────────────────────
// CarTelemetryData = 60 bytes per car

function parseCarTelemetry(buf, header) {
  const SIZE = 60;
  const cars = [];

  for (let i = 0; i < NUM_CARS; i++) {
    const o = HEADER_SIZE + i * SIZE;
    if (o + SIZE > buf.length) break;

    cars.push({
      speed:                    buf.readUInt16LE(o),          // km/h
      throttle:                 buf.readFloatLE(o + 2),       // 0.0–1.0
      steer:                    buf.readFloatLE(o + 6),       // -1.0–1.0
      brake:                    buf.readFloatLE(o + 10),      // 0.0–1.0
      clutch:                   buf.readUInt8(o + 14),        // 0–100
      gear:                     buf.readInt8(o + 15),         // -1=R, 0=N, 1–8
      engineRPM:                buf.readUInt16LE(o + 16),
      drs:                      buf.readUInt8(o + 18),        // 0=off, 1=on
      revLightsPercent:         buf.readUInt8(o + 19),        // 0–100
      revLightsBitValue:        buf.readUInt16LE(o + 20),
      // Tyre array order: [RL, RR, FL, FR]
      brakesTemperature: [
        buf.readUInt16LE(o + 22), buf.readUInt16LE(o + 24),
        buf.readUInt16LE(o + 26), buf.readUInt16LE(o + 28),
      ],
      tyresSurfaceTemperature: [
        buf.readUInt8(o + 30), buf.readUInt8(o + 31),
        buf.readUInt8(o + 32), buf.readUInt8(o + 33),
      ],
      tyresInnerTemperature: [
        buf.readUInt8(o + 34), buf.readUInt8(o + 35),
        buf.readUInt8(o + 36), buf.readUInt8(o + 37),
      ],
      engineTemperature:        buf.readUInt16LE(o + 38),     // Celsius
      tyresPressure: [
        buf.readFloatLE(o + 40), buf.readFloatLE(o + 44),
        buf.readFloatLE(o + 48), buf.readFloatLE(o + 52),
      ],
      surfaceType: [
        buf.readUInt8(o + 56), buf.readUInt8(o + 57),
        buf.readUInt8(o + 58), buf.readUInt8(o + 59),
      ],
      surfaceTypeNames: [
        SURFACE_TYPES[buf.readUInt8(o + 56)] || 'Unknown',
        SURFACE_TYPES[buf.readUInt8(o + 57)] || 'Unknown',
        SURFACE_TYPES[buf.readUInt8(o + 58)] || 'Unknown',
        SURFACE_TYPES[buf.readUInt8(o + 59)] || 'Unknown',
      ],
    });
  }

  // Trailing fields after all cars
  const trailO = HEADER_SIZE + NUM_CARS * SIZE;
  let suggestedGear = null;
  if (trailO + 3 <= buf.length) {
    suggestedGear = buf.readInt8(trailO + 2);
  }

  return {
    playerData: cars[header.playerCarIndex] || null,
    allCars: cars,
    suggestedGear,
  };
}

// ─── Packet 2: Lap Data ───────────────────────────────────────────────────────
// LapData = 57 bytes per car (F1 25 with speedTrap fields)
// We try 57 first then fallback to 55 (F1 24 size)

function parseLapData(buf, header) {
  // Detect struct size from packet length
  const dataBytes = buf.length - HEADER_SIZE - 1; // -1 for trailing byte
  const size57 = 57 * NUM_CARS;
  const size55 = 55 * NUM_CARS;
  let SIZE = 57;
  if (Math.abs(dataBytes - size55) < Math.abs(dataBytes - size57)) SIZE = 55;

  const cars = [];

  for (let i = 0; i < NUM_CARS; i++) {
    const o = HEADER_SIZE + i * SIZE;
    if (o + SIZE > buf.length) break;

    const sector1Ms = buf.readUInt16LE(o + 8);
    const sector1Min = buf.readUInt8(o + 10);
    const sector2Ms = buf.readUInt16LE(o + 11);
    const sector2Min = buf.readUInt8(o + 13);

    // Delta fields: each is uint16 ms + uint8 minutes (3 bytes each)
    const deltaFrontMs  = buf.readUInt16LE(o + 14);
    const deltaFrontMin = buf.readUInt8(o + 16);
    const deltaLeaderMs = buf.readUInt16LE(o + 17);
    const deltaLeaderMin = buf.readUInt8(o + 19);

    cars.push({
      lastLapTimeInMS:          buf.readUInt32LE(o),
      currentLapTimeInMS:       buf.readUInt32LE(o + 4),
      sector1TimeInMS:          sector1Min * 60000 + sector1Ms,
      sector2TimeInMS:          sector2Min * 60000 + sector2Ms,
      deltaToCarInFrontInMS:    deltaFrontMin * 60000 + deltaFrontMs,
      deltaToLeaderInMS:        deltaLeaderMin * 60000 + deltaLeaderMs,
      lapDistance:              buf.readFloatLE(o + 20),
      totalDistance:            buf.readFloatLE(o + 24),
      safetyCarDelta:           buf.readFloatLE(o + 28),
      carPosition:              buf.readUInt8(o + 32),
      currentLapNum:            buf.readUInt8(o + 33),
      pitStatus:                buf.readUInt8(o + 34),   // 0=none,1=pitting,2=pit lane
      numPitStops:              buf.readUInt8(o + 35),
      sector:                   buf.readUInt8(o + 36),   // 0/1/2
      currentLapInvalid:        buf.readUInt8(o + 37),
      penalties:                buf.readUInt8(o + 38),
      totalWarnings:            buf.readUInt8(o + 39),
      cornerCuttingWarnings:    buf.readUInt8(o + 40),
      numUnservedDriveThroughPens: buf.readUInt8(o + 41),
      numUnservedStopGoPens:    buf.readUInt8(o + 42),
      gridPosition:             buf.readUInt8(o + 43),
      driverStatus:             buf.readUInt8(o + 44),  // 0=garage,1=flying lap,2=in lap,3=out lap,4=on track
      resultStatus:             buf.readUInt8(o + 45),
      pitLaneTimerActive:       buf.readUInt8(o + 46),
      pitLaneTimeInLaneInMS:    buf.readUInt16LE(o + 47),
      pitStopTimerInMS:         buf.readUInt16LE(o + 49),
      pitStopShouldServePen:    buf.readUInt8(o + 51),
      // F1 25 only (SIZE == 57): speed trap fastest for the player across the session
      speedTrapFastestSpeed:    SIZE >= 57 ? buf.readFloatLE(o + 52) : 0,
      speedTrapFastestLap:      SIZE >= 57 ? buf.readUInt8(o + 56) : 0,
      driverStatusName:         DRIVER_STATUS_NAMES[buf.readUInt8(o + 44)] || 'Unknown',
      resultStatusName:         RESULT_STATUS_NAMES[buf.readUInt8(o + 45)] || 'Unknown',
      pitStatusName:            PIT_STATUS_NAMES[buf.readUInt8(o + 34)] || 'Unknown',
    });
  }

  return {
    playerData: cars[header.playerCarIndex] || null,
    allCars: cars,
  };
}

// ─── Packet 7: Car Status ─────────────────────────────────────────────────────
// CarStatusData = 55 bytes per car

function parseCarStatus(buf, header) {
  const SIZE = 55;
  const cars = [];

  for (let i = 0; i < NUM_CARS; i++) {
    const o = HEADER_SIZE + i * SIZE;
    if (o + SIZE > buf.length) break;

    const actualCompound = buf.readUInt8(o + 25);
    const visualCompound = buf.readUInt8(o + 26);

    cars.push({
      tractionControl:          buf.readUInt8(o),
      antiLockBrakes:           buf.readUInt8(o + 1),
      fuelMix:                  buf.readUInt8(o + 2),
      frontBrakeBias:           buf.readUInt8(o + 3),
      pitLimiterStatus:         buf.readUInt8(o + 4),
      fuelInTank:               buf.readFloatLE(o + 5),
      fuelCapacity:             buf.readFloatLE(o + 9),
      fuelRemainingLaps:        buf.readFloatLE(o + 13),
      maxRPM:                   buf.readUInt16LE(o + 17),
      idleRPM:                  buf.readUInt16LE(o + 19),
      maxGears:                 buf.readUInt8(o + 21),
      drsAllowed:               buf.readUInt8(o + 22),  // 0=not allowed, 1=allowed
      drsActivationDistance:    buf.readUInt16LE(o + 23),
      actualTyreCompound:       actualCompound,
      visualTyreCompound:       visualCompound,
      tyresAgeLaps:             buf.readUInt8(o + 27),
      vehicleFiaFlags:          buf.readInt8(o + 28),
      enginePowerICE:           buf.readFloatLE(o + 29),
      enginePowerMGUK:          buf.readFloatLE(o + 33),
      ersStoreEnergy:           buf.readFloatLE(o + 37),  // Joules, max ~4,000,000
      ersDeployMode:            buf.readUInt8(o + 41),
      ersHarvestedThisLapMGUK:  buf.readFloatLE(o + 42),
      ersHarvestedThisLapMGUH:  buf.readFloatLE(o + 46),
      ersDeployedThisLap:       buf.readFloatLE(o + 50),
      networkPaused:            buf.readUInt8(o + 54),
      // Derived
      tyreCompoundName:   VISUAL_TYRE[visualCompound] || ACTUAL_TYRE[actualCompound] || 'UNKNOWN',
      ersDeployModeName:  ERS_DEPLOY_MODES[buf.readUInt8(o + 41)] || 'Unknown',
    });
  }

  return {
    playerData: cars[header.playerCarIndex] || null,
    allCars: cars,
  };
}

// ─── Packet 1: Session ────────────────────────────────────────────────────────

function parseSession(buf) {
  if (buf.length < HEADER_SIZE + 14) return null;
  const o = HEADER_SIZE;

  const weather = buf.readUInt8(o);
  const trackTemperature = buf.readInt8(o + 1);
  const airTemperature = buf.readInt8(o + 2);
  const totalLaps = buf.readUInt8(o + 3);
  const trackLength = buf.readUInt16LE(o + 4);
  const sessionType = buf.readUInt8(o + 6);
  const trackId = buf.readInt8(o + 7);
  const formula = buf.readUInt8(o + 8);
  const sessionTimeLeft = buf.readUInt16LE(o + 9);
  const sessionDuration = buf.readUInt16LE(o + 11);
  const pitSpeedLimit = buf.readUInt8(o + 13);

  const result = {
    weather,
    trackTemperature,
    airTemperature,
    totalLaps,
    trackLength,
    sessionType,
    trackId,
    formula,
    sessionTimeLeft,
    sessionDuration,
    pitSpeedLimit,
    // Derived
    weatherName:     WEATHER_NAMES[weather] || 'Unknown',
    sessionTypeName: SESSION_TYPES[sessionType] || 'Unknown',
    trackName:       TRACK_IDS[trackId] || `Track ${trackId}`,
    // Extended (populated below if packet is large enough)
    marshalZones:           [],
    safetyCarStatus:        0,
    safetyCarName:          'None',
    weatherForecast:        [],
    forecastAccuracy:       0,
    pitStopWindowIdealLap:  0,
    pitStopWindowLatestLap: 0,
    pitStopRejoinPosition:  0,
  };

  // Extended session fields — only parse if packet is large enough
  // o+14: gamePaused, o+15: isSpectating, o+16: spectatorCarIndex, o+17: sliPro
  // o+18: numMarshalZones, o+19: marshalZones[21] × 5 bytes
  if (buf.length < o + 19) return result;

  const numMarshalZones = buf.readUInt8(o + 18);
  const ZONE_SIZE = 5; // Float32 + Int8
  const zonesEnd = o + 19 + 21 * ZONE_SIZE; // fixed allocation = 105 bytes

  for (let i = 0; i < Math.min(numMarshalZones, 21); i++) {
    const zo = o + 19 + i * ZONE_SIZE;
    if (zo + ZONE_SIZE > buf.length) break;
    result.marshalZones.push({
      zoneStart: buf.readFloatLE(zo),         // 0.0–1.0 fraction of track
      zoneFlag:  buf.readInt8(zo + 4),
      zoneFlagName: MARSHAL_FLAGS[buf.readInt8(zo + 4)] || 'NONE',
    });
  }

  // o+124: safetyCarStatus, o+125: networkGame, o+126: numWeatherForecastSamples
  if (buf.length < zonesEnd + 3) return result;

  result.safetyCarStatus = buf.readUInt8(zonesEnd);
  const SC_NAMES = ['None', 'Full SC', 'Virtual SC', 'Formation Lap'];
  result.safetyCarName = SC_NAMES[result.safetyCarStatus] || 'None';

  const numForecast = buf.readUInt8(zonesEnd + 2);
  const FORECAST_SIZE = 8;
  const forecastStart = zonesEnd + 3;

  for (let i = 0; i < Math.min(numForecast, 64); i++) {
    const fo = forecastStart + i * FORECAST_SIZE;
    if (fo + FORECAST_SIZE > buf.length) break;
    result.weatherForecast.push({
      sessionType:         buf.readUInt8(fo),
      timeOffset:          buf.readUInt8(fo + 1),   // minutes
      weather:             buf.readUInt8(fo + 2),
      weatherName:         WEATHER_NAMES[buf.readUInt8(fo + 2)] || 'Unknown',
      trackTemperature:    buf.readInt8(fo + 3),
      trackTempChange:     buf.readInt8(fo + 4),
      airTemperature:      buf.readInt8(fo + 5),
      airTempChange:       buf.readInt8(fo + 6),
      rainPercentage:      buf.readUInt8(fo + 7),
    });
  }

  // After forecast: zonesEnd + 3 + 64*8 = zonesEnd + 515
  const afterForecast = forecastStart + 64 * FORECAST_SIZE;

  // forecastAccuracy at afterForecast
  if (buf.length > afterForecast) {
    result.forecastAccuracy = buf.readUInt8(afterForecast);
  }

  // Pit stop window at afterForecast + 14 (skip aiDifficulty + 3×UInt32 link IDs)
  const pitWindowOff = afterForecast + 14;
  if (buf.length >= pitWindowOff + 3) {
    result.pitStopWindowIdealLap  = buf.readUInt8(pitWindowOff);
    result.pitStopWindowLatestLap = buf.readUInt8(pitWindowOff + 1);
    result.pitStopRejoinPosition  = buf.readUInt8(pitWindowOff + 2);
  }

  // aiDifficulty lives at afterForecast + 1 (between forecastAccuracy and link IDs)
  if (buf.length > afterForecast + 1) {
    result.aiDifficulty = buf.readUInt8(afterForecast + 1);
  }
  if (buf.length >= afterForecast + 14) {
    result.seasonLinkIdentifier  = buf.readUInt32LE(afterForecast + 2);
    result.weekendLinkIdentifier = buf.readUInt32LE(afterForecast + 6);
    result.sessionLinkIdentifier = buf.readUInt32LE(afterForecast + 10);
  }

  // Assists (7 × uint8) starting at pitWindowOff + 3
  const assistsOff = pitWindowOff + 3;
  if (buf.length >= assistsOff + 7) {
    result.steeringAssist    = buf.readUInt8(assistsOff);
    result.brakingAssist     = buf.readUInt8(assistsOff + 1);
    result.gearboxAssist     = buf.readUInt8(assistsOff + 2);
    result.pitAssist         = buf.readUInt8(assistsOff + 3);
    result.pitReleaseAssist  = buf.readUInt8(assistsOff + 4);
    result.ERSAssist         = buf.readUInt8(assistsOff + 5);
    result.DRSAssist         = buf.readUInt8(assistsOff + 6);
  }

  // Racing-line + game mode / rule set starting at assistsOff + 7
  const modeOff = assistsOff + 7;
  if (buf.length >= modeOff + 4) {
    result.dynamicRacingLine     = buf.readUInt8(modeOff);
    result.dynamicRacingLineType = buf.readUInt8(modeOff + 1);
    result.gameMode              = buf.readUInt8(modeOff + 2);
    result.ruleSet               = buf.readUInt8(modeOff + 3);
    result.gameModeName = GAME_MODES[result.gameMode] || `Mode ${result.gameMode}`;
    result.ruleSetName  = RULE_SETS[result.ruleSet] || `Rule ${result.ruleSet}`;
  }

  // Time of day, session length, unit prefs, flag counters
  const timeOff = modeOff + 4;
  if (buf.length >= timeOff + 4) {
    result.timeOfDay = buf.readUInt32LE(timeOff);  // minutes since midnight
  }
  if (buf.length >= timeOff + 5) {
    result.sessionLength = buf.readUInt8(timeOff + 4);
  }
  if (buf.length >= timeOff + 9) {
    result.speedUnitsLeadPlayer            = buf.readUInt8(timeOff + 5);
    result.temperatureUnitsLeadPlayer      = buf.readUInt8(timeOff + 6);
    result.speedUnitsSecondaryPlayer       = buf.readUInt8(timeOff + 7);
    result.temperatureUnitsSecondaryPlayer = buf.readUInt8(timeOff + 8);
  }
  if (buf.length >= timeOff + 12) {
    result.numSafetyCarPeriods        = buf.readUInt8(timeOff + 9);
    result.numVirtualSafetyCarPeriods = buf.readUInt8(timeOff + 10);
    result.numRedFlagPeriods          = buf.readUInt8(timeOff + 11);
  }

  // F1 25 extends the session packet further, but exact tail layout varies
  // across patches. Anything past here is opaque — leave untouched so callers
  // that care can sniff it out per build.

  return result;
}

// ─── Packet 5: Car Setups ────────────────────────────────────────────────
// CarSetupData = 49 bytes per car (F1 25)

function parseCarSetups(buf, header) {
  // Auto-detect struct size from packet
  const dataBytes = buf.length - HEADER_SIZE;
  const guessedSize = Math.round(dataBytes / NUM_CARS);
  const SIZE = (guessedSize >= 45 && guessedSize <= 55) ? guessedSize : 49;

  const cars = [];

  for (let i = 0; i < NUM_CARS; i++) {
    const o = HEADER_SIZE + i * SIZE;
    if (o + 30 > buf.length) break;

    cars.push({
      frontWing:             buf.readUInt8(o),
      rearWing:              buf.readUInt8(o + 1),
      onThrottle:            buf.readUInt8(o + 2),       // differential
      offThrottle:           buf.readUInt8(o + 3),       // differential
      frontCamber:           buf.readFloatLE(o + 4),
      rearCamber:            buf.readFloatLE(o + 8),
      frontToe:              buf.readFloatLE(o + 12),
      rearToe:               buf.readFloatLE(o + 16),
      frontSuspension:       buf.readUInt8(o + 20),
      rearSuspension:        buf.readUInt8(o + 21),
      frontAntiRollBar:      buf.readUInt8(o + 22),
      rearAntiRollBar:       buf.readUInt8(o + 23),
      frontSuspensionHeight: buf.readUInt8(o + 24),
      rearSuspensionHeight:  buf.readUInt8(o + 25),
      brakePressure:         buf.readUInt8(o + 26),
      brakeBias:             buf.readUInt8(o + 27),
      rearLeftTyrePressure:  buf.readFloatLE(o + 28),
      rearRightTyrePressure: buf.readFloatLE(o + 32),
      frontLeftTyrePressure: buf.readFloatLE(o + 36),
      frontRightTyrePressure: buf.readFloatLE(o + 40),
      ballast:               o + 44 < buf.length ? buf.readUInt8(o + 44) : 0,
      fuelLoad:              o + 49 <= buf.length ? buf.readFloatLE(o + 45) : 0,
    });
  }

  return {
    playerData: cars[header.playerCarIndex] || null,
    allCars: cars,
  };
}

// ─── Packet 4: Participants ───────────────────────────────────────────────────

function parseParticipants(buf, header) {
  const o = HEADER_SIZE;
  if (buf.length < o + 1) return null;

  const numActiveCars = buf.readUInt8(o);

  // Determine struct size from packet format version (reliable) with packet-size fallback
  // F1 25 (2025): ParticipantData = 57 bytes, m_name = char[32]
  // F1 24 (2024): ParticipantData = 58 bytes, m_name = char[48]
  // Packet ALWAYS contains 22 participant entries
  let participantSize, nameLen;

  if (header.packetFormat >= 2025) {
    participantSize = 57;
    nameLen = 32;
  } else {
    participantSize = 58;
    nameLen = 48;
  }

  // Cross-check with actual packet size; override if mismatch
  const dataBytes = buf.length - o - 1;
  const expectedBytes = NUM_CARS * participantSize;
  if (Math.abs(dataBytes - expectedBytes) > NUM_CARS) {
    // Packet size doesn't match expected — auto-detect
    const detected = Math.round(dataBytes / NUM_CARS);
    if (detected >= 50 && detected <= 70) {
      participantSize = detected;
      nameLen = detected <= 57 ? 32 : 48;
    }
  }

  const participants = [];
  for (let i = 0; i < NUM_CARS; i++) {
    const pO = o + 1 + i * participantSize;
    if (pO + 7 + nameLen > buf.length) break;

    // Read name: truncate at FIRST null byte (bytes after null are uninitialized garbage)
    // This is the critical fix — .replace(/\0/g, '') would concatenate garbage with the name
    const nameStart = pO + 7;
    const nameBytes = buf.subarray(nameStart, nameStart + nameLen);
    const nullIdx = nameBytes.indexOf(0);
    let name = (nullIdx >= 0 ? nameBytes.subarray(0, nullIdx) : nameBytes)
      .toString('utf8')
      .trim();

    // Parse trailing fields after name
    const afterName = nameStart + nameLen;
    let platform = 0;
    if (nameLen === 32 && afterName + 6 <= buf.length) {
      // F1 25 layout after name: yourTelemetry(1) + showOnlineNames(1) + techLevel(2) + platform(1) + numColours(1)
      platform = buf.readUInt8(afterName + 4); // 1=Steam, 3=PS, 4=Xbox, 6=Origin
    }

    participants.push({
      aiControlled: buf.readUInt8(pO),
      driverId:     buf.readUInt8(pO + 1),
      networkId:    buf.readUInt8(pO + 2),
      teamId:       buf.readUInt8(pO + 3),
      myTeam:       buf.readUInt8(pO + 4),
      raceNumber:   buf.readUInt8(pO + 5),
      nationality:  buf.readUInt8(pO + 6),
      name,
      platform,
    });
  }

  // Only return active cars (first numActiveCars entries)
  const active = participants.slice(0, numActiveCars);

  return {
    numActiveCars,
    participants: active,
    playerName: active[header.playerCarIndex]?.name || '',
  };
}

// ─── Packet 10: Car Damage ────────────────────────────────────────────────────
//
// Per-car size differs between game years:
//   F1 24: 42 bytes/car  (total = 953 bytes)
//   F1 25: 46 bytes/car  (total = 1041 bytes — confirmed by UDP probe)
//
// F1 25 added a new uint8[4] `m_tyreBlisters` field between `m_brakesDamage`
// and `m_frontLeftWingDamage` (offset 24..27). Every downstream field shifts
// by +4 bytes. Source: F1 25 UDP spec v3 (EA Forums) + F1Laps docs + MacManley
// F1-25 parser reference.
//
// F1 25 layout (46 bytes):
//    0..15  float[4]  tyresWear
//   16..19  uint8[4]  tyresDamage
//   20..23  uint8[4]  brakesDamage
//   24..27  uint8[4]  tyreBlisters      ← NEW in F1 25
//   28      uint8     frontLeftWingDamage
//   29      uint8     frontRightWingDamage
//   30      uint8     rearWingDamage
//   31      uint8     floorDamage
//   32      uint8     diffuserDamage
//   33      uint8     sidepodDamage
//   34      uint8     drsFault
//   35      uint8     ersFault
//   36      uint8     gearBoxDamage
//   37      uint8     engineDamage
//   38..43  uint8[6]  engine wear (MGUH/ES/CE/ICE/MGUK/TC)
//   44      uint8     engineBlown
//   45      uint8     engineSeized
//
// F1 24 keeps the pre-blisters layout (no `tyreBlisters`, wings start at 24).

function parseCarDamage(buf, header) {
  const dataBytes = buf.length - HEADER_SIZE;
  const perCar = Math.round(dataBytes / NUM_CARS);
  // Prefer the probed per-car size; clamp to known layouts.
  const SIZE = perCar >= 44 ? 46 : 42;
  const isF125 = SIZE === 46;
  // All post-blisters fields shift by +4 in F1 25.
  const off = (base) => base + (isF125 ? 4 : 0);

  const cars = [];
  for (let i = 0; i < NUM_CARS; i++) {
    const o = HEADER_SIZE + i * SIZE;
    if (o + SIZE > buf.length) break;

    cars.push({
      // Same in both versions: float[4] tyresWear at the head
      tyresWear: [
        buf.readFloatLE(o),      // RL
        buf.readFloatLE(o + 4),  // RR
        buf.readFloatLE(o + 8),  // FL
        buf.readFloatLE(o + 12), // FR
      ],
      tyresDamage: [
        buf.readUInt8(o + 16), buf.readUInt8(o + 17),
        buf.readUInt8(o + 18), buf.readUInt8(o + 19),
      ],
      brakesDamage: [
        buf.readUInt8(o + 20), buf.readUInt8(o + 21),
        buf.readUInt8(o + 22), buf.readUInt8(o + 23),
      ],
      // F1 25 only — populated as zeros on F1 24.
      tyreBlisters: isF125
        ? [
            buf.readUInt8(o + 24), buf.readUInt8(o + 25),
            buf.readUInt8(o + 26), buf.readUInt8(o + 27),
          ]
        : [0, 0, 0, 0],
      frontLeftWingDamage:  buf.readUInt8(o + off(24)),
      frontRightWingDamage: buf.readUInt8(o + off(25)),
      rearWingDamage:       buf.readUInt8(o + off(26)),
      floorDamage:          buf.readUInt8(o + off(27)),
      diffuserDamage:       buf.readUInt8(o + off(28)),
      sidepodDamage:        buf.readUInt8(o + off(29)),
      drsFault:             buf.readUInt8(o + off(30)),
      ersFault:             buf.readUInt8(o + off(31)),
      gearBoxDamage:        buf.readUInt8(o + off(32)),
      engineDamage:         buf.readUInt8(o + off(33)),
      engineMGUHWear:       buf.readUInt8(o + off(34)),
      engineESWear:         buf.readUInt8(o + off(35)),
      engineCEWear:         buf.readUInt8(o + off(36)),
      engineICEWear:        buf.readUInt8(o + off(37)),
      engineMGUKWear:       buf.readUInt8(o + off(38)),
      engineTCWear:         buf.readUInt8(o + off(39)),
      engineBlown:          buf.readUInt8(o + off(40)),
      engineSeized:         buf.readUInt8(o + off(41)),
    });
  }

  return {
    playerData: cars[header.playerCarIndex] || null,
    allCars: cars,
  };
}

// ─── Packet 11: Session History ───────────────────────────────────────────────

function parseSessionHistory(buf, header) {
  const o = HEADER_SIZE;
  if (buf.length < o + 7) return null;

  const carIdx          = buf.readUInt8(o);
  const numLaps         = buf.readUInt8(o + 1);
  const numTyreStints   = buf.readUInt8(o + 2);
  const bestLapTimeLapNum  = buf.readUInt8(o + 3);
  const bestSector1LapNum  = buf.readUInt8(o + 4);
  const bestSector2LapNum  = buf.readUInt8(o + 5);
  const bestSector3LapNum  = buf.readUInt8(o + 6);

  // Parse all cars (not just player) for race data recording

  const LAP_SIZE = 14;
  const lapHistoryOffset = o + 7;
  const laps = [];

  for (let i = 0; i < numLaps && i < 100; i++) {
    const lo = lapHistoryOffset + i * LAP_SIZE;
    if (lo + LAP_SIZE > buf.length) break;

    const lapTimeInMS    = buf.readUInt32LE(lo);
    const sector1InMS    = buf.readUInt16LE(lo + 4);
    const sector1Min     = buf.readUInt8(lo + 6);
    const sector2InMS    = buf.readUInt16LE(lo + 7);
    const sector2Min     = buf.readUInt8(lo + 9);
    const sector3InMS    = buf.readUInt16LE(lo + 10);
    const sector3Min     = buf.readUInt8(lo + 12);
    const lapValidBits   = buf.readUInt8(lo + 13);

    laps.push({
      lapNum:       i + 1,
      lapTimeInMS,
      sector1TimeInMS: sector1Min * 60000 + sector1InMS,
      sector2TimeInMS: sector2Min * 60000 + sector2InMS,
      sector3TimeInMS: sector3Min * 60000 + sector3InMS,
      lapValid:     !!(lapValidBits & 0x01),
      sector1Valid: !!(lapValidBits & 0x02),
      sector2Valid: !!(lapValidBits & 0x04),
      sector3Valid: !!(lapValidBits & 0x08),
    });
  }

  // Tyre stint history: at offset lapHistoryOffset + 100*14 = lapHistoryOffset + 1400
  const stintOffset = lapHistoryOffset + 1400;
  const STINT_SIZE = 3;
  const stints = [];

  for (let i = 0; i < numTyreStints && i < 8; i++) {
    const so = stintOffset + i * STINT_SIZE;
    if (so + STINT_SIZE > buf.length) break;

    const actualCompound = buf.readUInt8(so + 1);
    const visualCompound = buf.readUInt8(so + 2);

    stints.push({
      endLap:         buf.readUInt8(so),
      actualCompound,
      visualCompound,
      compoundName:   VISUAL_TYRE[visualCompound] || ACTUAL_TYRE[actualCompound] || 'UNKNOWN',
    });
  }

  return {
    carIdx,
    numLaps,
    numTyreStints,
    bestLapTimeLapNum,
    bestSector1LapNum,
    bestSector2LapNum,
    bestSector3LapNum,
    laps,
    stints,
  };
}

// ─── Packet 3: Event ──────────────────────────────────────────────────────────
// Header(29) + eventStringCode[4] + eventDetails(union, up to 16 bytes)

function parseEvent(buf) {
  const o = HEADER_SIZE;
  if (buf.length < o + 4) return null;

  const code = buf.slice(o, o + 4).toString('ascii');
  const details = {};
  const d = o + 4;

  switch (code) {
    case 'FTLP':
      if (buf.length >= d + 5) {
        details.vehicleIdx = buf.readUInt8(d);
        details.lapTime    = buf.readFloatLE(d + 1); // seconds
      }
      break;
    case 'RTMT':
      if (buf.length >= d + 1) details.vehicleIdx = buf.readUInt8(d);
      if (buf.length >= d + 2) details.reason     = buf.readUInt8(d + 1);
      break;
    case 'TMPT':
    case 'RCWN':
    case 'DTSV':
    case 'SGSV':
      if (buf.length >= d + 1) details.vehicleIdx = buf.readUInt8(d);
      break;
    case 'PENA':
      if (buf.length >= d + 7) {
        details.penaltyType      = buf.readUInt8(d);
        details.infringementType = buf.readUInt8(d + 1);
        details.vehicleIdx       = buf.readUInt8(d + 2);
        details.otherVehicleIdx  = buf.readUInt8(d + 3);
        details.time             = buf.readUInt8(d + 4);
        details.lapNum           = buf.readUInt8(d + 5);
        details.placesGained     = buf.readUInt8(d + 6);
        details.penaltyTypeName      = PENALTY_TYPES[details.penaltyType] || `Type ${details.penaltyType}`;
        details.infringementTypeName = INFRINGEMENT_TYPES[details.infringementType] || `Infringement ${details.infringementType}`;
      }
      break;
    case 'SPTP':
      if (buf.length >= d + 12) {
        details.vehicleIdx                 = buf.readUInt8(d);
        details.speed                      = buf.readFloatLE(d + 1);
        details.isOverallFastestInSession  = buf.readUInt8(d + 5);
        details.isDriverFastestInSession   = buf.readUInt8(d + 6);
        details.fastestVehicleIdxInSession = buf.readUInt8(d + 7);
        details.fastestSpeedInSession      = buf.readFloatLE(d + 8);
      }
      break;
    case 'STLG':
      if (buf.length >= d + 1) details.numLights = buf.readUInt8(d);
      break;
    case 'FLBK':
      if (buf.length >= d + 8) {
        details.flashbackFrameIdentifier = buf.readUInt32LE(d);
        details.flashbackSessionTime     = buf.readFloatLE(d + 4);
      }
      break;
    case 'BUTN':
      if (buf.length >= d + 4) details.buttonStatus = buf.readUInt32LE(d);
      break;
    case 'OVTK':
      if (buf.length >= d + 2) {
        details.overtakingVehicleIdx    = buf.readUInt8(d);
        details.beingOvertakenVehicleIdx = buf.readUInt8(d + 1);
      }
      break;
    case 'SCAR':
    case 'VCAR':
      if (buf.length >= d + 2) {
        details.safetyCarType     = buf.readUInt8(d);
        details.eventType         = buf.readUInt8(d + 1);
        details.safetyCarTypeName = SAFETY_CAR_TYPES[details.safetyCarType] || 'Unknown';
        details.eventTypeName     = SAFETY_CAR_EVENT_TYPES[details.eventType] || 'Unknown';
      }
      break;
    case 'COLL':
      if (buf.length >= d + 2) {
        details.vehicle1Idx = buf.readUInt8(d);
        details.vehicle2Idx = buf.readUInt8(d + 1);
      }
      break;
    // SSTA, SEND, DRSE, DRSD, CHQF, LGOT, RDFL: no details
  }

  return {
    eventStringCode: code,
    eventName:       EVENT_NAMES[code] || code,
    details,
  };
}

// ─── Packet 8: Final Classification ───────────────────────────────────────────
// numCars(1) + FinalClassificationData[22].
// F1 24 = 45 bytes per car; F1 25 = 46 bytes (adds resultReason).

function parseFinalClassification(buf, header) {
  const o = HEADER_SIZE;
  if (buf.length < o + 1) return null;

  const numCars = buf.readUInt8(o);

  const dataBytes = buf.length - o - 1;
  const exp25 = NUM_CARS * 46;
  const exp24 = NUM_CARS * 45;
  let SIZE;
  if (Math.abs(dataBytes - exp25) <= Math.abs(dataBytes - exp24)) SIZE = 46;
  else SIZE = 45;

  const classifications = [];
  for (let i = 0; i < Math.min(numCars, NUM_CARS); i++) {
    const pO = o + 1 + i * SIZE;
    if (pO + SIZE > buf.length) break;

    const tyreStintsActual   = [];
    const tyreStintsVisual   = [];
    const tyreStintsEndLaps  = [];
    for (let s = 0; s < 8; s++) {
      tyreStintsActual.push(buf.readUInt8(pO + 21 + s));
      tyreStintsVisual.push(buf.readUInt8(pO + 29 + s));
      tyreStintsEndLaps.push(buf.readUInt8(pO + 37 + s));
    }

    classifications.push({
      position:          buf.readUInt8(pO),
      numLaps:           buf.readUInt8(pO + 1),
      gridPosition:      buf.readUInt8(pO + 2),
      points:            buf.readUInt8(pO + 3),
      numPitStops:       buf.readUInt8(pO + 4),
      resultStatus:      buf.readUInt8(pO + 5),
      resultStatusName:  RESULT_STATUS_NAMES[buf.readUInt8(pO + 5)] || 'Unknown',
      bestLapTimeInMS:   buf.readUInt32LE(pO + 6),
      totalRaceTime:     buf.readDoubleLE(pO + 10),
      penaltiesTime:     buf.readUInt8(pO + 18),
      numPenalties:      buf.readUInt8(pO + 19),
      numTyreStints:     buf.readUInt8(pO + 20),
      tyreStintsActual,
      tyreStintsVisual,
      tyreStintsEndLaps,
      resultReason:      SIZE >= 46 && pO + 45 < buf.length ? buf.readUInt8(pO + 45) : 0,
    });
  }

  return { numCars, classifications };
}

// ─── Packet 9: Lobby Info ─────────────────────────────────────────────────────
// numPlayers(1) + LobbyInfoData[22]
// F1 25: name[32] → 42 bytes; F1 24: name[48] → 58 bytes.

function parseLobbyInfo(buf, header) {
  const o = HEADER_SIZE;
  if (buf.length < o + 1) return null;

  const numPlayers = buf.readUInt8(o);

  const size25 = 42;
  const size24 = 58;
  const dataBytes = buf.length - o - 1;
  const exp25 = NUM_CARS * size25;
  const exp24 = NUM_CARS * size24;
  let SIZE, nameLen;
  if (header.packetFormat >= 2025 && Math.abs(dataBytes - exp25) <= Math.abs(dataBytes - exp24)) {
    SIZE = size25; nameLen = 32;
  } else {
    SIZE = size24; nameLen = 48;
  }

  const players = [];
  for (let i = 0; i < Math.min(numPlayers, NUM_CARS); i++) {
    const pO = o + 1 + i * SIZE;
    if (pO + SIZE > buf.length) break;

    const nameStart = pO + 4;
    const nameBytes = buf.subarray(nameStart, nameStart + nameLen);
    const nullIdx = nameBytes.indexOf(0);
    const name = (nullIdx >= 0 ? nameBytes.subarray(0, nullIdx) : nameBytes).toString('utf8').trim();

    const afterName = nameStart + nameLen;
    players.push({
      aiControlled:    buf.readUInt8(pO),
      teamId:          buf.readUInt8(pO + 1),
      nationality:     buf.readUInt8(pO + 2),
      platform:        buf.readUInt8(pO + 3),
      name,
      carNumber:       afterName + 0 < buf.length ? buf.readUInt8(afterName)     : 0,
      yourTelemetry:   afterName + 1 < buf.length ? buf.readUInt8(afterName + 1) : 0,
      showOnlineNames: afterName + 2 < buf.length ? buf.readUInt8(afterName + 2) : 0,
      techLevel:       afterName + 4 <= buf.length ? buf.readUInt16LE(afterName + 3) : 0,
      readyStatus:     afterName + 5 < buf.length ? buf.readUInt8(afterName + 5) : 0,
    });
  }

  return { numPlayers, players };
}

// ─── Packet 12: Tyre Sets ─────────────────────────────────────────────────────
// carIdx(1) + TyreSetData[20] × 10 bytes + fittedIdx(1)

function parseTyreSets(buf, header) {
  const o = HEADER_SIZE;
  if (buf.length < o + 1 + 200 + 1) return null;

  const carIdx = buf.readUInt8(o);
  const SIZE = 10;
  const sets = [];

  for (let i = 0; i < 20; i++) {
    const sO = o + 1 + i * SIZE;
    if (sO + SIZE > buf.length) break;
    const actualCompound = buf.readUInt8(sO);
    const visualCompound = buf.readUInt8(sO + 1);
    sets.push({
      actualCompound,
      visualCompound,
      compoundName:        VISUAL_TYRE[visualCompound] || ACTUAL_TYRE[actualCompound] || 'UNKNOWN',
      wear:                buf.readUInt8(sO + 2),
      available:           buf.readUInt8(sO + 3),
      recommendedSession:  buf.readUInt8(sO + 4),
      lifeSpan:            buf.readUInt8(sO + 5),
      usableLife:          buf.readUInt8(sO + 6),
      lapDeltaTime:        buf.readInt16LE(sO + 7),
      fitted:              buf.readUInt8(sO + 9),
    });
  }

  const fittedIdx = buf.readUInt8(o + 1 + 200);

  return { carIdx, sets, fittedIdx };
}

// ─── Packet 13: Motion Ex ─────────────────────────────────────────────────────
// Player-only struct; exact size varies between F1 24 (≈208 B) and F1 25 (≈212 B).
// Parse defensively — every read is bounds-checked.

function parseMotionEx(buf) {
  const o = HEADER_SIZE;
  if (buf.length < o + 80) return null;

  // helper: read a float array of length 4 at offset `from`
  const read4 = (from) => {
    if (from + 16 > buf.length) return [0, 0, 0, 0];
    return [
      buf.readFloatLE(from),
      buf.readFloatLE(from + 4),
      buf.readFloatLE(from + 8),
      buf.readFloatLE(from + 12),
    ];
  };

  const data = {
    suspensionPosition:     read4(o),
    suspensionVelocity:     read4(o + 16),
    suspensionAcceleration: read4(o + 32),
    wheelSpeed:             read4(o + 48),
    wheelSlipRatio:         read4(o + 64),
    wheelSlipAngle:         read4(o + 80),
    wheelLatForce:          read4(o + 96),
    wheelLongForce:         read4(o + 112),
    heightOfCOGAboveGround: buf.length >= o + 132 ? buf.readFloatLE(o + 128) : 0,
    localVelocityX:         buf.length >= o + 136 ? buf.readFloatLE(o + 132) : 0,
    localVelocityY:         buf.length >= o + 140 ? buf.readFloatLE(o + 136) : 0,
    localVelocityZ:         buf.length >= o + 144 ? buf.readFloatLE(o + 140) : 0,
    angularVelocityX:       buf.length >= o + 148 ? buf.readFloatLE(o + 144) : 0,
    angularVelocityY:       buf.length >= o + 152 ? buf.readFloatLE(o + 148) : 0,
    angularVelocityZ:       buf.length >= o + 156 ? buf.readFloatLE(o + 152) : 0,
    angularAccelerationX:   buf.length >= o + 160 ? buf.readFloatLE(o + 156) : 0,
    angularAccelerationY:   buf.length >= o + 164 ? buf.readFloatLE(o + 160) : 0,
    angularAccelerationZ:   buf.length >= o + 168 ? buf.readFloatLE(o + 164) : 0,
    frontWheelsAngle:       buf.length >= o + 172 ? buf.readFloatLE(o + 168) : 0,
    wheelVertForce:         read4(o + 172),
    frontAeroHeight:        buf.length >= o + 192 ? buf.readFloatLE(o + 188) : 0,
    rearAeroHeight:         buf.length >= o + 196 ? buf.readFloatLE(o + 192) : 0,
    frontRollAngle:         buf.length >= o + 200 ? buf.readFloatLE(o + 196) : 0,
    rearRollAngle:          buf.length >= o + 204 ? buf.readFloatLE(o + 200) : 0,
    chassisYaw:             buf.length >= o + 208 ? buf.readFloatLE(o + 204) : 0,
    chassisPitch:           buf.length >= o + 212 ? buf.readFloatLE(o + 208) : 0, // F1 25
  };

  return data;
}

// ─── Packet 14: Time Trial ────────────────────────────────────────────────────
// Three TimeTrialDataSet structs (24 bytes each) for player session best,
// personal best, rival.

function parseTimeTrial(buf) {
  const o = HEADER_SIZE;
  const SET_SIZE = 24;
  if (buf.length < o + 3 * SET_SIZE) return null;

  const readSet = (from) => ({
    carIdx:              buf.readUInt8(from),
    teamId:              buf.readUInt8(from + 1),
    lapTimeInMS:         buf.readUInt32LE(from + 2),
    sector1TimeInMS:     buf.readUInt32LE(from + 6),
    sector2TimeInMS:     buf.readUInt32LE(from + 10),
    sector3TimeInMS:     buf.readUInt32LE(from + 14),
    tractionControl:     buf.readUInt8(from + 18),
    gearboxAssist:       buf.readUInt8(from + 19),
    antiLockBrakes:      buf.readUInt8(from + 20),
    equalCarPerformance: buf.readUInt8(from + 21),
    customSetup:         buf.readUInt8(from + 22),
    valid:               buf.readUInt8(from + 23),
  });

  return {
    playerSessionBestDataSet: readSet(o),
    personalBestDataSet:      readSet(o + SET_SIZE),
    rivalDataSet:             readSet(o + 2 * SET_SIZE),
  };
}

// ─── Packet 15: Lap Positions ─────────────────────────────────────────────────
// numLaps(1) + lapStart(1) + positionForVehicleIdx[50][22] uint8 matrix

function parseLapPositions(buf) {
  const o = HEADER_SIZE;
  if (buf.length < o + 2) return null;

  const numLaps  = buf.readUInt8(o);
  const lapStart = buf.readUInt8(o + 1);

  const MAX_LAPS = 50;
  const matrix = []; // matrix[lapIdx][carIdx]
  const base = o + 2;

  for (let l = 0; l < MAX_LAPS; l++) {
    const row = new Array(NUM_CARS).fill(0);
    for (let c = 0; c < NUM_CARS; c++) {
      const off = base + l * NUM_CARS + c;
      if (off >= buf.length) break;
      row[c] = buf.readUInt8(off);
    }
    matrix.push(row);
  }

  return { numLaps, lapStart, positionForVehicleIdx: matrix };
}

// ─── Main export ─────────────────────────────────────────────────────────────

function parsePacket(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (buf.length < HEADER_SIZE) return null;

  let header;
  try {
    header = parseHeader(buf);
  } catch {
    return null;
  }

  let data = null;
  try {
    switch (header.packetId) {
      case PACKET_IDS.MOTION:               data = parseMotion(buf, header);              break;
      case PACKET_IDS.CAR_TELEMETRY:        data = parseCarTelemetry(buf, header);        break;
      case PACKET_IDS.LAP_DATA:             data = parseLapData(buf, header);             break;
      case PACKET_IDS.CAR_STATUS:           data = parseCarStatus(buf, header);           break;
      case PACKET_IDS.CAR_SETUPS:           data = parseCarSetups(buf, header);           break;
      case PACKET_IDS.SESSION:              data = parseSession(buf);                     break;
      case PACKET_IDS.PARTICIPANTS:         data = parseParticipants(buf, header);        break;
      case PACKET_IDS.CAR_DAMAGE:           data = parseCarDamage(buf, header);           break;
      case PACKET_IDS.SESSION_HISTORY:      data = parseSessionHistory(buf, header);      break;
      case PACKET_IDS.EVENT:                data = parseEvent(buf);                       break;
      case PACKET_IDS.FINAL_CLASSIFICATION: data = parseFinalClassification(buf, header); break;
      case PACKET_IDS.LOBBY_INFO:           data = parseLobbyInfo(buf, header);           break;
      case PACKET_IDS.TYRE_SETS:            data = parseTyreSets(buf, header);            break;
      case PACKET_IDS.MOTION_EX:            data = parseMotionEx(buf);                    break;
      case PACKET_IDS.TIME_TRIAL:           data = parseTimeTrial(buf);                   break;
      case PACKET_IDS.LAP_POSITIONS:        data = parseLapPositions(buf);                break;
      default: return null;
    }
  } catch {
    return null;
  }

  if (!data) return null;

  return { type: header.packetId, header, data };
}

module.exports = { parsePacket, PACKET_IDS };
