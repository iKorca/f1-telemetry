import { create } from 'zustand';
import type { SettingsConfig } from '@shared/types';

type SpeedUnit = 'kmh' | 'mph';

interface SettingsState {
  settings: SettingsConfig | null;
  speedUnit: SpeedUnit;

  // Actions
  setSettings: (config: SettingsConfig) => void;
  updateSpeedUnit: (unit: SpeedUnit) => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  settings: null,
  speedUnit: 'kmh',

  setSettings: (config) => {
    set({
      settings: config,
      speedUnit: config.display?.speedUnit || 'kmh',
    });
  },

  updateSpeedUnit: (unit) => {
    set({ speedUnit: unit });
  },
}));
