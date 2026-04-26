import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SettingsConfig } from '@shared/types';

type SpeedUnit = 'kmh' | 'mph';
type TempUnit = 'C' | 'F';
type FontPreset = 'modern' | 'racing' | 'mono' | 'classic';

export const FONT_PRESETS: Record<FontPreset, { display: string; ui: string; label: string }> = {
  modern:  { display: "'Exo 2', sans-serif",       ui: "'Inter', sans-serif",          label: 'Modern (Exo 2 + Inter)' },
  racing:  { display: "'Orbitron', monospace",      ui: "'Rajdhani', sans-serif",       label: 'Racing (Orbitron + Rajdhani)' },
  mono:    { display: "'JetBrains Mono', monospace", ui: "'JetBrains Mono', monospace", label: 'Monospace (JetBrains Mono)' },
  classic: { display: "'Space Grotesk', sans-serif", ui: "'Inter', sans-serif",         label: 'Classic (Space Grotesk + Inter)' },
};

interface SettingsState {
  settings: SettingsConfig | null;
  speedUnit: SpeedUnit;
  tempUnit: TempUnit;
  fontPreset: FontPreset;
  uiScale: number;

  // ── Analysis tunables (persisted locally) ─────────────────────────────────
  /** Fuel safety margin (%) applied to race-fuel projection */
  fuelSafetyMarginPct: number;
  /** Default starting fuel load (kg) for the race-fuel calculator */
  defaultStartingFuelKg: number;

  // Actions
  setSettings: (config: SettingsConfig) => void;
  updateSpeedUnit: (unit: SpeedUnit) => void;
  setTempUnit: (u: TempUnit) => void;
  setFontPreset: (preset: FontPreset) => void;
  setUIScale: (scale: number) => void;
  setFuelSafetyMargin: (pct: number) => void;
  setDefaultStartingFuel: (kg: number) => void;
  applyDisplaySettings: () => void;
}

function applyToDOM(fontPreset: FontPreset, uiScale: number) {
  const root = document.documentElement;
  const fonts = FONT_PRESETS[fontPreset];
  root.style.setProperty('--font-d', fonts.display);
  root.style.setProperty('--font-u', fonts.ui);
  root.style.fontSize = `${(uiScale / 100) * 21}px`;
}

export const useSettingsStore = create<SettingsState>()(persist((set, get) => ({
  settings: null,
  speedUnit: 'kmh',
  tempUnit: 'C',
  fontPreset: 'modern',
  uiScale: 100,
  fuelSafetyMarginPct: 3,
  defaultStartingFuelKg: 110,

  setSettings: (config) => {
    const fontPreset = (config.display?.fontPreset as FontPreset) || 'modern';
    const uiScale = config.display?.uiScale || 100;
    set({
      settings: config,
      speedUnit: config.display?.speedUnit || 'kmh',
      fontPreset,
      uiScale,
    });
    applyToDOM(fontPreset, uiScale);
  },

  updateSpeedUnit: (unit) => {
    set({ speedUnit: unit });
  },

  setFontPreset: (preset) => {
    set({ fontPreset: preset });
    applyToDOM(preset, get().uiScale);
  },

  setUIScale: (scale) => {
    set({ uiScale: scale });
    applyToDOM(get().fontPreset, scale);
  },

  setTempUnit: (u) => set({ tempUnit: u }),
  setFuelSafetyMargin: (pct) =>
    set({ fuelSafetyMarginPct: Math.max(0, Math.min(20, pct)) }),
  setDefaultStartingFuel: (kg) =>
    set({ defaultStartingFuelKg: Math.max(50, Math.min(110, kg)) }),

  applyDisplaySettings: () => {
    const { fontPreset, uiScale } = get();
    applyToDOM(fontPreset, uiScale);
  },
}), {
  name: 'f1-settings',
  partialize: (s) => ({
    speedUnit: s.speedUnit,
    tempUnit: s.tempUnit,
    fontPreset: s.fontPreset,
    uiScale: s.uiScale,
    fuelSafetyMarginPct: s.fuelSafetyMarginPct,
    defaultStartingFuelKg: s.defaultStartingFuelKg,
  }),
}));
