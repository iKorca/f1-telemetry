import { create } from 'zustand';
import type { SessionSummary, SessionDetail } from '@shared/types';

interface HistoryState {
  sessions: SessionSummary[];
  currentSessionId: string | null;
  currentSession: SessionDetail | null;
  selectedSessions: Set<string>;
  liveSession: SessionDetail | null;
  liveSessionLapCount: number;

  // Actions
  setSessions: (list: SessionSummary[]) => void;
  setCurrentSession: (session: SessionDetail | null) => void;
  setCurrentSessionId: (id: string | null) => void;
  toggleSessionSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setLiveSession: (session: SessionDetail | null) => void;
  setLiveSessionLapCount: (count: number) => void;
}

export const useHistoryStore = create<HistoryState>()((set) => ({
  sessions: [],
  currentSessionId: null,
  currentSession: null,
  selectedSessions: new Set<string>(),
  liveSession: null,
  liveSessionLapCount: 0,

  setSessions: (list) => {
    set({ sessions: list });
  },

  setCurrentSession: (session) => {
    set({ currentSession: session });
  },

  setCurrentSessionId: (id) => {
    set({ currentSessionId: id });
  },

  toggleSessionSelect: (id) => {
    set((state) => {
      const next = new Set(state.selectedSessions);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedSessions: next };
    });
  },

  selectAll: () => {
    set((state) => ({
      selectedSessions: new Set(state.sessions.map((s) => s.id)),
    }));
  },

  clearSelection: () => {
    set({ selectedSessions: new Set<string>() });
  },

  setLiveSession: (session) => {
    set({ liveSession: session });
  },

  setLiveSessionLapCount: (count) => {
    set({ liveSessionLapCount: count });
  },
}));
