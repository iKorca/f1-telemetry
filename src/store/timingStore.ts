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

  // Actions
  handleLapData: (data: LapDataPacket) => void;
  handleParticipants: (data: ParticipantsData) => void;
  handleCarStatus: (data: CarStatusData) => void;
  handleCarDamage: (data: CarDamageData) => void;
  handleCarSetups: (data: CarSetupsData) => void;
  handleSessionHistory: (data: SessionHistoryData) => void;
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

  handleLapData: (data) => {
    const car = data.playerData;
    if (!car) return;
    set((state) => {
      const newState: Partial<TimingState> = {
        allLapData: data,
        sector: car.sector,
        currentLap: car.currentLapNum,
        currentLapTimeMs: car.currentLapTimeInMS || 0,
        currentLapDistance: car.lapDistance || 0,
        position: car.carPosition || 0,
        gapToLeader: car.deltaToLeaderInMS || 0,
        numPitStops: car.numPitStops || 0,
        penalties: car.penalties || 0,
        currentLapInvalid: car.currentLapInvalid === 1,
        pitStatus: car.pitStatus || 0,
      };

      // Update last lap
      if (car.lastLapTimeInMS > 0 && car.lastLapTimeInMS !== state.lastLapMs) {
        newState.lastLapMs = car.lastLapTimeInMS;
        // Update best lap
        if (!state.bestLapMs || car.lastLapTimeInMS < state.bestLapMs) {
          newState.bestLapMs = car.lastLapTimeInMS;
          newState.bestLapTimeMs = car.lastLapTimeInMS;
        }
      }

      // Sector times
      if (car.sector1TimeInMS > 0) {
        newState.lastSector1 = car.sector1TimeInMS;
      }
      if (car.sector2TimeInMS > 0) {
        newState.lastSector2 = car.sector2TimeInMS;
      }

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
}));
