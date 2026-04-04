import { create } from 'zustand';
import type { TelemetryData, MotionPacket } from '@shared/types';

type FourTuple = [number, number, number, number];

interface TelemetryState {
  // Car telemetry (20Hz)
  speed: number;
  throttle: number;
  brake: number;
  steer: number;
  clutch: number;
  gear: number;
  engineRPM: number;
  drs: number;
  revLightsPercent: number;
  revLightsBitValue: number;
  brakesTemperature: FourTuple;
  tyresSurfaceTemperature: FourTuple;
  tyresInnerTemperature: FourTuple;
  engineTemperature: number;
  tyresPressure: FourTuple;
  suggestedGear: number | null;

  // Motion data
  gForceLateral: number;
  gForceLongitudinal: number;
  worldPositionX: number;
  worldPositionZ: number;
  allCarPositions: { x: number; z: number }[];

  // Actions
  handleTelemetry: (data: TelemetryData) => void;
  handleMotion: (data: MotionPacket) => void;
}

export const useTelemetryStore = create<TelemetryState>()((set) => ({
  speed: 0,
  throttle: 0,
  brake: 0,
  steer: 0,
  clutch: 0,
  gear: 0,
  engineRPM: 0,
  drs: 0,
  revLightsPercent: 0,
  revLightsBitValue: 0,
  brakesTemperature: [0, 0, 0, 0],
  tyresSurfaceTemperature: [0, 0, 0, 0],
  tyresInnerTemperature: [0, 0, 0, 0],
  engineTemperature: 0,
  tyresPressure: [0, 0, 0, 0],
  suggestedGear: null,

  gForceLateral: 0,
  gForceLongitudinal: 0,
  worldPositionX: 0,
  worldPositionZ: 0,
  allCarPositions: [],

  handleTelemetry: (data) => {
    const car = data.playerData;
    if (!car) return;
    set({
      speed: car.speed,
      throttle: car.throttle,
      brake: car.brake,
      steer: car.steer,
      clutch: car.clutch,
      gear: car.gear,
      engineRPM: car.engineRPM,
      drs: car.drs,
      revLightsPercent: car.revLightsPercent,
      revLightsBitValue: car.revLightsBitValue,
      brakesTemperature: [...car.brakesTemperature] as FourTuple,
      tyresSurfaceTemperature: [...car.tyresSurfaceTemperature] as FourTuple,
      tyresInnerTemperature: [...car.tyresInnerTemperature] as FourTuple,
      engineTemperature: car.engineTemperature,
      tyresPressure: [...car.tyresPressure] as FourTuple,
      suggestedGear: data.suggestedGear,
    });
  },

  handleMotion: (data) => {
    const car = data.playerData;
    if (!car) return;
    const positions = data.allCars
      ? data.allCars.map((c) => ({ x: c.worldPositionX, z: c.worldPositionZ }))
      : [];
    set({
      gForceLateral: car.gForceLateral || 0,
      gForceLongitudinal: car.gForceLongitudinal || 0,
      worldPositionX: car.worldPositionX,
      worldPositionZ: car.worldPositionZ,
      allCarPositions: positions,
    });
  },
}));
