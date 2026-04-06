import { create } from 'zustand';
import type { SettingsConfig } from '@shared/types';

type SpeedUnit = 'kmh' | 'mph';
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
  fontPreset: FontPreset;
  uiScale: number;

  // Actions
  setSettings: (config: SettingsConfig) => void;
  updateSpeedUnit: (unit: SpeedUnit) => void;
  setFontPreset: (preset: FontPreset) => void;
  setUIScale: (scale: number) => void;
  applyDisplaySettings: () => void;
}

function applyToDOM(fontPreset: FontPreset, uiScale: number) {
  const root = document.documentElement;
  const fonts = FONT_PRESETS[fontPreset];
  root.style.setProperty('--font-d', fonts.display);
  root.style.setProperty('--font-u', fonts.ui);
  root.style.fontSize = `${(uiScale / 100) * 16}px`;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: null,
  speedUnit: 'kmh',
  fontPreset: 'modern',
  uiScale: 100,

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

  applyDisplaySettings: () => {
    const { fontPreset, uiScale } = get();
    applyToDOM(fontPreset, uiScale);
  },
}));
