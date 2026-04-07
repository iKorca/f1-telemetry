import { create } from 'zustand';
import type { RaceEngineerData } from '@shared/types';

interface WeatherHistoryEntry {
  lap: number;
  lapTimeMs: number;
  trackTemp: number;
  airTemp: number;
  weather: string;
}

interface RaceState {
  raceState: RaceEngineerData | null;
  weatherHistory: WeatherHistoryEntry[];
  lastWeatherLap: number;

  // Actions
  handleRaceEngineer: (data: RaceEngineerData) => void;
  trackWeatherForLap: (
    currentLap: number,
    lastLapMs: number,
    trackTemp: number,
    airTemp: number,
    weather: string,
  ) => void;
}

export const useRaceStore = create<RaceState>()((set) => ({
  raceState: null,
  weatherHistory: [],
  lastWeatherLap: 0,

  handleRaceEngineer: (data) => {
    set({ raceState: data });
  },

  trackWeatherForLap: (currentLap, lastLapMs, trackTemp, airTemp, weather) => {
    set((state) => {
      if (currentLap <= state.lastWeatherLap || currentLap < 2) return state;
      if (!lastLapMs || lastLapMs <= 0) return state;

      return {
        lastWeatherLap: currentLap,
        weatherHistory: [
          ...state.weatherHistory.slice(-99),
          {
            lap: currentLap - 1,
            lapTimeMs: lastLapMs,
            trackTemp,
            airTemp,
            weather,
          },
        ],
      };
    });
  },
}));
