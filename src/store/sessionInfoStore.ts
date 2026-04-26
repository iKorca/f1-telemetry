import { create } from 'zustand';
import type { SessionPacket, MarshalZone, WeatherForecastItem } from '@shared/types';
import { useTimingStore } from './timingStore';

interface TrackPoint {
  x: number;
  z: number;
}

interface TrackBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface SessionInfoState {
  // Session metadata
  trackName: string;
  trackId: number;
  sessionTypeName: string;
  weatherName: string;
  trackTemperature: number;
  airTemperature: number;
  totalLaps: number;
  sessionTimeLeft: number;
  sessionDuration: number;
  safetyCarStatus: number;
  safetyCarName: string;
  marshalZones: MarshalZone[];
  weatherForecast: WeatherForecastItem[];
  pitStopWindowIdealLap: number;
  pitStopWindowLatestLap: number;
  trackLength: number;

  // Track outline
  trackPoints: TrackPoint[];
  trackBounds: TrackBounds | null;
  trackOutlineSaved: boolean;
  trackOutlineLoaded: boolean;

  // Actions
  handleSession: (data: SessionPacket) => void;
  addTrackPoint: (x: number, z: number) => void;
  setTrackOutline: (points: TrackPoint[]) => void;
  resetTrackPoints: () => void;
}

function computeBounds(points: TrackPoint[]): TrackBounds | null {
  if (points.length === 0) return null;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { minX, maxX, minZ, maxZ };
}

export const useSessionInfoStore = create<SessionInfoState>()((set) => ({
  trackName: '',
  trackId: -1,
  sessionTypeName: '',
  weatherName: '',
  trackTemperature: 0,
  airTemperature: 0,
  totalLaps: 0,
  sessionTimeLeft: 0,
  sessionDuration: 0,
  safetyCarStatus: 0,
  safetyCarName: '',
  marshalZones: [],
  weatherForecast: [],
  pitStopWindowIdealLap: 0,
  pitStopWindowLatestLap: 0,
  trackLength: 0,

  trackPoints: [],
  trackBounds: null,
  trackOutlineSaved: false,
  trackOutlineLoaded: false,

  handleSession: (data) => {
    set((state) => {
      const trackChanged = data.trackId !== undefined && data.trackId !== state.trackId;
      const typeChanged = !!data.sessionTypeName && data.sessionTypeName !== state.sessionTypeName;
      // Session transition: any track OR session-type flip means the old
      // lap times / session history don't apply any more. Clear the timing
      // store eagerly so PBs, sector bests, and stint histories start fresh.
      if (trackChanged || typeChanged) {
        // Session transition — clear the timing store so PBs / sector bests
        // from the previous session don't leak through.
        useTimingStore.getState().resetForNewSession();
      }
      return {
        trackName: data.trackName || '',
        trackId: data.trackId ?? state.trackId,
        sessionTypeName: data.sessionTypeName || '',
        weatherName: data.weatherName || '',
        trackTemperature: data.trackTemperature,
        airTemperature: data.airTemperature,
        totalLaps: data.totalLaps || 0,
        sessionTimeLeft: data.sessionTimeLeft || 0,
        sessionDuration: data.sessionDuration || 0,
        safetyCarStatus: data.safetyCarStatus || 0,
        safetyCarName: data.safetyCarName || '',
        marshalZones: data.marshalZones || [],
        weatherForecast: data.weatherForecast || [],
        pitStopWindowIdealLap: data.pitStopWindowIdealLap || 0,
        pitStopWindowLatestLap: data.pitStopWindowLatestLap || 0,
        trackLength: data.trackLength || 0,
        // Reset track outline state when track changes
        ...(trackChanged
          ? { trackOutlineSaved: false, trackOutlineLoaded: false }
          : {}),
      };
    });
  },

  addTrackPoint: (x, z) => {
    set((state) => {
      const newPoints = [...state.trackPoints, { x, z }];
      return {
        trackPoints: newPoints,
        trackBounds: computeBounds(newPoints),
      };
    });
  },

  setTrackOutline: (points) => {
    set({
      trackPoints: points,
      trackBounds: computeBounds(points),
      trackOutlineLoaded: true,
    });
  },

  resetTrackPoints: () => {
    set({
      trackPoints: [],
      trackBounds: null,
      trackOutlineSaved: false,
      trackOutlineLoaded: false,
    });
  },
}));
