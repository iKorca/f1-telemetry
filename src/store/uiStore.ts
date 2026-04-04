import { create } from 'zustand';
import type { RecordingStatus, TunnelStatus } from '@shared/types';

type TabId = 'dashboard' | 'timing' | 'race' | 'session' | 'history' | 'settings';
type ConnectionStatus = 'live' | 'waiting' | 'off';

interface UIState {
  activeTab: TabId;
  connectionStatus: ConnectionStatus;
  isRecording: boolean;
  recLapCount: number;
  recSessionId: string | null;
  tunnelUrl: string | null;
  tunnelActive: boolean;
  lastDataTs: number;
  notificationsEnabled: boolean;
  showShortcutsOverlay: boolean;

  // Actions
  switchTab: (tab: TabId) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  handleRecStatus: (data: RecordingStatus) => void;
  handleTunnel: (data: TunnelStatus) => void;
  setLastDataTs: (ts: number) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  toggleShortcutsOverlay: () => void;
}

export const useUIStore = create<UIState>()((set) => ({
  activeTab: 'dashboard',
  connectionStatus: 'off',
  isRecording: false,
  recLapCount: 0,
  recSessionId: null,
  tunnelUrl: null,
  tunnelActive: false,
  lastDataTs: 0,
  notificationsEnabled: false,
  showShortcutsOverlay: false,

  switchTab: (tab) => {
    set({ activeTab: tab });
  },

  setConnectionStatus: (status) => {
    set({ connectionStatus: status });
  },

  handleRecStatus: (data) => {
    set({
      isRecording: data.isRecording,
      recLapCount: data.lapCount || 0,
      recSessionId: data.sessionId || null,
    });
  },

  handleTunnel: (data) => {
    set({
      tunnelUrl: data.url || null,
      tunnelActive: data.active,
    });
  },

  setLastDataTs: (ts) => {
    set({ lastDataTs: ts });
  },

  setNotificationsEnabled: (enabled) => {
    set({ notificationsEnabled: enabled });
  },

  toggleShortcutsOverlay: () => {
    set((state) => ({ showShortcutsOverlay: !state.showShortcutsOverlay }));
  },
}));

export type { TabId, ConnectionStatus };
