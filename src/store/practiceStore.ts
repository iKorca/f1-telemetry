import { create } from 'zustand';
import type {
  PracticeWorkbook,
  PracticeRun,
  PracticeTrackSummary,
} from '@shared/types';

interface PracticeState {
  // Available tracks
  tracks: PracticeTrackSummary[];

  // Current workbook
  selectedTrack: string | null;
  workbook: PracticeWorkbook | null;

  // Selection state
  selectedRunIds: Set<string>;
  baselineRunId: string | null;

  // Condition filter
  conditionFilter: 'all' | 'dry' | 'wet';

  // Actions
  setTracks: (tracks: PracticeTrackSummary[]) => void;
  setSelectedTrack: (track: string | null) => void;
  setWorkbook: (wb: PracticeWorkbook | null) => void;
  toggleRunSelection: (runId: string) => void;
  setRunSelection: (runIds: Set<string>) => void;
  clearRunSelection: () => void;
  setBaselineRunId: (runId: string | null) => void;
  setConditionFilter: (f: 'all' | 'dry' | 'wet') => void;
  updateRun: (runId: string, changes: Partial<PracticeRun>) => void;
}

export const usePracticeStore = create<PracticeState>()((set) => ({
  tracks: [],
  selectedTrack: null,
  workbook: null,
  selectedRunIds: new Set(),
  baselineRunId: null,
  conditionFilter: 'all',

  setTracks: (tracks) => set({ tracks }),
  setSelectedTrack: (track) =>
    set({ selectedTrack: track, workbook: null, selectedRunIds: new Set(), baselineRunId: null }),
  setWorkbook: (wb) => set({ workbook: wb }),

  toggleRunSelection: (runId) =>
    set((s) => {
      const next = new Set(s.selectedRunIds);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return { selectedRunIds: next };
    }),

  setRunSelection: (runIds) => set({ selectedRunIds: runIds }),
  clearRunSelection: () => set({ selectedRunIds: new Set() }),
  setBaselineRunId: (runId) => set({ baselineRunId: runId }),
  setConditionFilter: (f) => set({ conditionFilter: f }),

  updateRun: (runId, changes) =>
    set((s) => {
      if (!s.workbook) return s;
      const runs = s.workbook.runs.map((r) =>
        r.id === runId ? { ...r, ...changes } : r,
      );
      return { workbook: { ...s.workbook, runs } };
    }),
}));
