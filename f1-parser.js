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
      gridPosition:             buf.readUInt8(o + 43),
      driverStatus:             buf.readUInt8(o + 44),  // 0=garage,1=flying lap,2=in lap,3=out lap,4=on track
      resultStatus:             buf.readUInt8(o + 45),
      pitLaneTimerActive:       buf.readUInt8(o + 46),
      pitLaneTimeInLaneInMS:    buf.readUInt16LE(o + 47),
      pitStopTimerInMS:         buf.readUInt16LE(o + 49),
      pitStopShouldServePen:    buf.readUInt8(o + 51),
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
// CarDamageData = 42 bytes per car

function parseCarDamage(buf, header) {
  const SIZE = 42;
  const cars = [];

  for (let i = 0; i < NUM_CARS; i++) {
    const o = HEADER_SIZE + i * SIZE;
    if (o + SIZE > buf.length) break;

    cars.push({
      // Tyre array order: [RL, RR, FL, FR]
      tyresWear: [
        buf.readFloatLE(o),      // RL
        buf.readFloatLE(o + 4),  // RR
        buf.readFloatLE(o + 8),  // FL
        buf.readFloatLE(o + 12), // FR
      ],
      tyresDamage: [
        buf.readUInt8(o + 16), // RL
        buf.readUInt8(o + 17), // RR
        buf.readUInt8(o + 18), // FL
        buf.readUInt8(o + 19), // FR
      ],
      brakesDamage: [
        buf.readUInt8(o + 20), // RL
        buf.readUInt8(o + 21), // RR
        buf.readUInt8(o + 22), // FL
        buf.readUInt8(o + 23), // FR
      ],
      frontLeftWingDamage:  buf.readUInt8(o + 24),
      frontRightWingDamage: buf.readUInt8(o + 25),
      rearWingDamage:       buf.readUInt8(o + 26),
      floorDamage:          buf.readUInt8(o + 27),
      diffuserDamage:       buf.readUInt8(o + 28),
      sidepodDamage:        buf.readUInt8(o + 29),
      drsFault:             buf.readUInt8(o + 30),
      ersFault:             buf.readUInt8(o + 31),
      gearBoxDamage:        buf.readUInt8(o + 32),
      engineDamage:         buf.readUInt8(o + 33),
      engineMGUHWear:       buf.readUInt8(o + 34),
      engineESWear:         buf.readUInt8(o + 35),
      engineCEWear:         buf.readUInt8(o + 36),
      engineICEWear:        buf.readUInt8(o + 37),
      engineMGUKWear:       buf.readUInt8(o + 38),
      engineTCWear:         buf.readUInt8(o + 39),
      engineBlown:          buf.readUInt8(o + 40),
      engineSeized:         buf.readUInt8(o + 41),
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
      case PACKET_IDS.MOTION:          data = parseMotion(buf, header);         break;
      case PACKET_IDS.CAR_TELEMETRY:   data = parseCarTelemetry(buf, header);   break;
      case PACKET_IDS.LAP_DATA:        data = parseLapData(buf, header);        break;
      case PACKET_IDS.CAR_STATUS:      data = parseCarStatus(buf, header);      break;
      case PACKET_IDS.CAR_SETUPS:     data = parseCarSetups(buf, header);     break;
      case PACKET_IDS.SESSION:         data = parseSession(buf);                break;
      case PACKET_IDS.PARTICIPANTS:    data = parseParticipants(buf, header);   break;
      case PACKET_IDS.CAR_DAMAGE:      data = parseCarDamage(buf, header);      break;
      case PACKET_IDS.SESSION_HISTORY: data = parseSessionHistory(buf, header); break;
      default: return null;
    }
  } catch {
    return null;
  }

  if (!data) return null;

  return { type: header.packetId, header, data };
}

module.exports = { parsePacket, PACKET_IDS };
