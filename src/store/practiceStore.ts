import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
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

  // Per-track selection memory. Switching tracks restores the previous
  // selection; the "live" view (`selectedRunIds`, `baselineRunId`) is derived
  // from this map plus `selectedTrack`.
  selectedRunIdsByTrack: Map<string, Set<string>>;
  baselineRunIdByTrack: Map<string, string | null>;

  // Selection state (current track's slice, kept in sync with the maps above)
  selectedRunIds: Set<string>;
  baselineRunId: string | null;

  // Condition filter
  conditionFilter: 'all' | 'dry' | 'wet';

  // Chart x-axis mode (applies to all per-lap charts in the Charts column)
  //  'lap'     — stint-lap number (1, 2, 3…)
  //  'tyreAge' — tyre age in laps (out-laps collapse to 0; stint starts align
  //              across runs with different warmup counts)
  xAxisMode: 'lap' | 'tyreAge';

  // Reference-lap mode: when set, charts subtract the referenced lap's value
  // from every plotted series (delta mode). Identified by (runId, lapNum).
  referenceRunId: string | null;
  referenceLapNum: number | null;

  // Comparison lap for the frame-level Delta Telemetry chart. Independent
  // from the reference lap above (though the two often coincide).
  comparisonRunId: string | null;
  comparisonLapNum: number | null;

  // Feature toggles — persisted via the `persist` middleware wrapper.
  /** When true, invalid/out/pit/traffic laps are still plotted (greyed) */
  includeInvalidLaps: boolean;
  /** Which RUN_COLORS palette to use across charts */
  chartPalette: 'default' | 'cvd';

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
  setXAxisMode: (m: 'lap' | 'tyreAge') => void;
  setReferenceLap: (runId: string | null, lapNum: number | null) => void;
  setComparisonLap: (runId: string | null, lapNum: number | null) => void;
  setIncludeInvalidLaps: (v: boolean) => void;
  setChartPalette: (p: 'default' | 'cvd') => void;
}

export const usePracticeStore = create<PracticeState>()(devtools(persist((set) => ({
  tracks: [],
  selectedTrack: null,
  workbook: null,
  selectedRunIdsByTrack: new Map(),
  baselineRunIdByTrack: new Map(),
  selectedRunIds: new Set(),
  baselineRunId: null,
  conditionFilter: 'all',
  xAxisMode: 'lap',
  referenceRunId: null,
  referenceLapNum: null,
  comparisonRunId: null,
  comparisonLapNum: null,
  includeInvalidLaps: false,
  chartPalette: 'default',

  setTracks: (tracks) => set({ tracks }),

  // Switching tracks: write the outgoing track's selection back into the
  // persistent map, then restore whatever the incoming track had last time.
  setSelectedTrack: (track) =>
    set((s) => {
      // Persist outgoing track's current state
      const nextSelMap = new Map(s.selectedRunIdsByTrack);
      const nextBaseMap = new Map(s.baselineRunIdByTrack);
      if (s.selectedTrack) {
        nextSelMap.set(s.selectedTrack, new Set(s.selectedRunIds));
        nextBaseMap.set(s.selectedTrack, s.baselineRunId);
      }
      // Restore incoming track's state (or default empty)
      const restoredSel = track ? nextSelMap.get(track) ?? new Set<string>() : new Set<string>();
      const restoredBase = track ? nextBaseMap.get(track) ?? null : null;
      return {
        selectedTrack: track,
        workbook: null,
        selectedRunIdsByTrack: nextSelMap,
        baselineRunIdByTrack: nextBaseMap,
        selectedRunIds: new Set(restoredSel),
        baselineRunId: restoredBase,
      };
    }),

  setWorkbook: (wb) => set({ workbook: wb }),

  toggleRunSelection: (runId) =>
    set((s) => {
      const next = new Set(s.selectedRunIds);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      const selMap = new Map(s.selectedRunIdsByTrack);
      if (s.selectedTrack) selMap.set(s.selectedTrack, new Set(next));
      return { selectedRunIds: next, selectedRunIdsByTrack: selMap };
    }),

  setRunSelection: (runIds) =>
    set((s) => {
      const selMap = new Map(s.selectedRunIdsByTrack);
      if (s.selectedTrack) selMap.set(s.selectedTrack, new Set(runIds));
      return { selectedRunIds: runIds, selectedRunIdsByTrack: selMap };
    }),

  clearRunSelection: () =>
    set((s) => {
      const selMap = new Map(s.selectedRunIdsByTrack);
      if (s.selectedTrack) selMap.set(s.selectedTrack, new Set());
      return { selectedRunIds: new Set(), selectedRunIdsByTrack: selMap };
    }),

  setBaselineRunId: (runId) =>
    set((s) => {
      const baseMap = new Map(s.baselineRunIdByTrack);
      if (s.selectedTrack) baseMap.set(s.selectedTrack, runId);
      return { baselineRunId: runId, baselineRunIdByTrack: baseMap };
    }),

  setConditionFilter: (f) => set({ conditionFilter: f }),

  updateRun: (runId, changes) =>
    set((s) => {
      if (!s.workbook) return s;
      const runs = s.workbook.runs.map((r) =>
        r.id === runId ? { ...r, ...changes } : r,
      );
      return { workbook: { ...s.workbook, runs } };
    }),

  setXAxisMode: (m) => set({ xAxisMode: m }),
  setReferenceLap: (runId, lapNum) => set({ referenceRunId: runId, referenceLapNum: lapNum }),
  setComparisonLap: (runId, lapNum) => set({ comparisonRunId: runId, comparisonLapNum: lapNum }),
  setIncludeInvalidLaps: (v) => set({ includeInvalidLaps: v }),
  setChartPalette: (p) => set({ chartPalette: p }),
}), {
  name: 'f1-practice',
  // Only persist user preferences — never per-session transient data.
  // The selection maps use Map/Set which need a custom serialiser.
  partialize: (s) => ({
    xAxisMode: s.xAxisMode,
    conditionFilter: s.conditionFilter,
    includeInvalidLaps: s.includeInvalidLaps,
    chartPalette: s.chartPalette,
  }),
}), { name: 'f1-practice' }));
