import { create } from 'zustand';
import type {
  LapDataPacket,
  ParticipantsData,
  CarStatusData,
  CarDamageData,
  CarSetup,
  CarSetupsData,
  SessionHistoryData,
} from '@shared/types';
import { MIN_PB_TRACE_SAMPLES, type TracePoint } from '@/lib/lapUtils';

// Sustained-regression detector: 3 consecutive frames going backwards by
// ≥20 m or ≥200 ms wipes the in-progress trace. A single out-of-order UDP
// frame is just skipped so packet-reorder bursts don't strip valid samples.
const REGRESSION_DIST_M = 20;
const REGRESSION_TIME_MS = 200;
const REGRESSION_STREAK_RESET = 3;

interface TimingState {
  // Player identification
  playerCarIndex: number;
  playerName: string;

  // Full packet data for all cars
  allLapData: LapDataPacket | null;
  allParticipants: ParticipantsData | null;
  allCarStatus: CarStatusData | null;
  allCarDamage: CarDamageData | null;

  // Player timing
  fastestLapMs: number | null;
  currentLap: number;
  sector: number;
  lastLapMs: number;
  bestLapMs: number;
  lastSector1: number;
  lastSector2: number;
  currentLapTimeMs: number;
  currentLapDistance: number;
  bestLapTimeMs: number;
  pitStatus: number;

  // Player position info
  position: number;
  gapToLeader: number;
  numPitStops: number;
  penalties: number;
  currentLapInvalid: boolean;

  // Car setup (from carSetups packet)
  carSetupData: CarSetup | null;

  // Session history (per-car)
  sessionHistories: Map<number, SessionHistoryData>;

  // ── PB trace for live delta-to-PB ────────────────────────────────────────
  // Live-delta mode on the glance dashboard needs to compare `currentLapTime`
  // against the PB's time AT THE SAME TRACK DISTANCE — not a linear
  // extrapolation from lap-fraction. We accumulate (distance, time) samples
  // for the in-progress lap and snapshot them as `pbLapTrace` the moment a
  // new PB locks in. The tile then interpolates PB-time at current distance.
  //
  // `pbTotalMs` is the PB lap's full time — used to extrapolate from the
  // trace's last in-lap sample out to the finish line instead of truncating.
  currentLapTrace: TracePoint[];
  pbLapTrace: TracePoint[];
  pbTotalMs: number;
  /**
   * Internal counter for the sustained-regression detector. Counts
   * consecutive frames going backwards by ≥20 m or ≥200 ms; once it
   * hits 3, the partial trace is wiped (handles flashbacks, rewinds,
   * pause-then-resume). Single out-of-order UDP frames don't trip it.
   */
  regressionStreak: number;

  // Actions
  handleLapData: (data: LapDataPacket) => void;
  handleParticipants: (data: ParticipantsData) => void;
  handleCarStatus: (data: CarStatusData) => void;
  handleCarDamage: (data: CarDamageData) => void;
  handleCarSetups: (data: CarSetupsData) => void;
  handleSessionHistory: (data: SessionHistoryData) => void;
  /**
   * Clear every per-session best / last value so a new session starts
   * from a clean slate. Called when a fresh `sessionUID` arrives on the
   * WebSocket so values from the previous session never leak into the next.
   */
  resetForNewSession: () => void;
}

export const useTimingStore = create<TimingState>()((set) => ({
  playerCarIndex: -1,
  playerName: '',
  allLapData: null,
  allParticipants: null,
  allCarStatus: null,
  allCarDamage: null,
  fastestLapMs: null,
  currentLap: 0,
  sector: 0,
  lastLapMs: 0,
  bestLapMs: 0,
  lastSector1: 0,
  lastSector2: 0,
  currentLapTimeMs: 0,
  currentLapDistance: 0,
  bestLapTimeMs: 0,
  pitStatus: 0,
  position: 0,
  gapToLeader: 0,
  numPitStops: 0,
  penalties: 0,
  currentLapInvalid: false,
  carSetupData: null,
  sessionHistories: new Map(),
  currentLapTrace: [],
  pbLapTrace: [],
  pbTotalMs: 0,
  regressionStreak: 0,

  handleLapData: (data) => {
    const car = data.playerData;
    if (!car) return;
    set((state) => {
      const currentLapTimeMs = car.currentLapTimeInMS || 0;
      const currentLapDistance = car.lapDistance || 0;
      const currentLapNum = car.currentLapNum || 0;
      const finishedLapMs = car.lastLapTimeInMS || 0;
      const driverStatus = car.driverStatus ?? 0;
      const pitStatus = car.pitStatus ?? 0;
      const wasInvalid = car.currentLapInvalid === 1;
      const clean = !wasInvalid && driverStatus !== 3 && pitStatus === 0;

      const newState: Partial<TimingState> = {
        allLapData: data,
        sector: car.sector,
        currentLap: currentLapNum,
        currentLapTimeMs,
        currentLapDistance,
        position: car.carPosition || 0,
        gapToLeader: car.deltaToLeaderInMS || 0,
        numPitStops: car.numPitStops || 0,
        penalties: car.penalties || 0,
        currentLapInvalid: wasInvalid,
        pitStatus,
      };

      // ── PB-trace bookkeeping ──────────────────────────────────────────────
      // A new lap is unambiguously signalled by `currentLapNum` incrementing.
      // The timing-based heuristic the previous version used was brittle —
      // rAF batching or paused frames could make it miss or double-fire,
      // which corrupted the PB trace and caused the jumping deltas you saw.
      //
      // We require an EXACT +1 increment to snapshot. A jump of >1 (lapped
      // car, session skip, replay scrub) means the trace and finish time
      // belong to different laps, so we clear the trace without recording.
      const lapDelta = currentLapNum - state.currentLap;
      const newLapStarted = state.currentLap > 0 && lapDelta > 0;
      const cleanLapTransition = lapDelta === 1;

      let currentLapTrace = state.currentLapTrace;
      let pbLapTrace = state.pbLapTrace;
      let pbTotalMs = state.pbTotalMs;

      // The PB trace, the PB time, and `bestLapMs` MUST update atomically.
      // Until this fix `bestLapMs` updated below even when the trace was too
      // short to snapshot, so the delta UI compared live driving against an
      // older PB trace while displaying the newer PB time.
      const beatPB =
        cleanLapTransition &&
        clean &&
        finishedLapMs > 0 &&
        (!state.bestLapMs || finishedLapMs < state.bestLapMs);
      const traceUsable = state.currentLapTrace.length >= MIN_PB_TRACE_SAMPLES;
      // Only record a new PB if we ALSO have a usable trace to attach to it.
      // Otherwise the trace and time would drift apart.
      const recordPB = beatPB && traceUsable;

      if (newLapStarted) {
        if (recordPB) {
          // Freeze the just-completed lap's trace AS-IS (no synthetic tail
          // sample — the consumer extrapolates from the last in-lap sample
          // out to `pbTotalMs` using trackLength).
          pbLapTrace = state.currentLapTrace;
          pbTotalMs = finishedLapMs;
        }
        currentLapTrace = [];
      }

      // Append a (distance, time) sample for the CURRENT lap. Gate on:
      //   - non-zero time (skip the reset packet at S/F crossing)
      //   - forward distance progress (skip flashback rewinds)
      //   - at least 10 m since the last sample (keeps trace under ~600
      //     points per lap on a 6 km track; plenty for interpolation).
      //
      // Detect flashback / pause-rewind: a SUSTAINED regression (≥3
      // consecutive frames going backwards by ≥20 m or ≥200 ms) clears
      // the trace. A single out-of-order UDP frame just gets skipped —
      // wiping the trace on every reordered packet was over-aggressive
      // and stripped valid samples mid-lap.
      const last = currentLapTrace.length > 0
        ? currentLapTrace[currentLapTrace.length - 1]
        : null;
      const isRegressed =
        !!last &&
        (currentLapDistance + REGRESSION_DIST_M < last.d ||
          currentLapTimeMs + REGRESSION_TIME_MS < last.t);

      let regressionStreak = state.regressionStreak;
      if (isRegressed) {
        regressionStreak = regressionStreak + 1;
        if (regressionStreak >= REGRESSION_STREAK_RESET) {
          currentLapTrace = [];
          regressionStreak = 0;
        }
      } else {
        regressionStreak = 0;
      }
      if (regressionStreak !== state.regressionStreak) {
        newState.regressionStreak = regressionStreak;
      }

      const lastAfter = currentLapTrace.length > 0
        ? currentLapTrace[currentLapTrace.length - 1]
        : null;
      // Skip out-of-order frames entirely — they neither extend the trace
      // nor count as forward progress.
      const shouldAppend =
        !isRegressed &&
        currentLapTimeMs > 20 &&
        currentLapDistance > 0 &&
        (!lastAfter || (currentLapDistance > lastAfter.d + 10 && currentLapTimeMs > lastAfter.t));
      if (shouldAppend) {
        currentLapTrace = [...currentLapTrace, { d: currentLapDistance, t: currentLapTimeMs }];
        if (currentLapTrace.length > 2000) {
          currentLapTrace = currentLapTrace.slice(-2000);
        }
      }

      newState.currentLapTrace = currentLapTrace;
      if (pbLapTrace !== state.pbLapTrace) newState.pbLapTrace = pbLapTrace;
      if (pbTotalMs !== state.pbTotalMs) newState.pbTotalMs = pbTotalMs;

      // ── Headline numbers ──────────────────────────────────────────────────
      if (finishedLapMs > 0 && finishedLapMs !== state.lastLapMs) {
        newState.lastLapMs = finishedLapMs;
        // Atomic with the trace snapshot above: only update bestLapMs when we
        // also have a usable trace to compare against. A faster lap that
        // wasn't traced (e.g. recorder started mid-lap) still becomes
        // `lastLapMs` so the user sees their lap time, but it doesn't poison
        // the live-delta comparison.
        if (recordPB) {
          newState.bestLapMs = finishedLapMs;
          newState.bestLapTimeMs = finishedLapMs;
        }
      }
      if (car.sector1TimeInMS > 0) newState.lastSector1 = car.sector1TimeInMS;
      if (car.sector2TimeInMS > 0) newState.lastSector2 = car.sector2TimeInMS;

      return newState;
    });
  },

  handleParticipants: (data) => {
    set((state) => {
      let playerCarIndex = state.playerCarIndex;
      if (data.participants) {
        for (let i = 0; i < data.participants.length; i++) {
          if (data.participants[i].name === data.playerName) {
            playerCarIndex = i;
            break;
          }
        }
      }
      return {
        allParticipants: data,
        playerName: data.playerName || state.playerName,
        playerCarIndex,
      };
    });
  },

  handleCarStatus: (data) => {
    set({ allCarStatus: data });
  },

  handleCarDamage: (data) => {
    set({ allCarDamage: data });
  },

  handleCarSetups: (data) => {
    set({ carSetupData: data.playerData ?? null });
  },

  handleSessionHistory: (data) => {
    set((state) => {
      const newHistories = new Map(state.sessionHistories);
      newHistories.set(data.carIdx, data);
      return { sessionHistories: newHistories };
    });
  },

  resetForNewSession: () => {
    set({
      fastestLapMs: null,
      currentLap: 0,
      sector: 0,
      lastLapMs: 0,
      bestLapMs: 0,
      bestLapTimeMs: 0,
      lastSector1: 0,
      lastSector2: 0,
      currentLapTimeMs: 0,
      currentLapDistance: 0,
      position: 0,
      gapToLeader: 0,
      numPitStops: 0,
      penalties: 0,
      currentLapInvalid: false,
      sessionHistories: new Map(),
      currentLapTrace: [],
      pbLapTrace: [],
      pbTotalMs: 0,
      regressionStreak: 0,
    });
  },
}));
