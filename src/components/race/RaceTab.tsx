import React from 'react';
import { useRaceStore } from '@/store/raceStore';
import { useTimingStore } from '@/store/timingStore';
import RaceTable from './RaceTable';
import PitPredictor from './PitPredictor';
import WeatherImpact from './WeatherImpact';
import EmptyState from '@/components/common/EmptyState';
import styles from './RaceTab.module.css';

/**
 * Race tab shell. Column visibility, sort, and drag-reorder all live on
 * RaceTable via the shared DataTable primitive now — the old ColumnPicker
 * + DEFAULT_COLUMNS boolean array were dropped.
 */
function RaceTab() {
  const raceState = useRaceStore((s) => s.raceState);
  const playerCarIndex = useTimingStore((s) => s.playerCarIndex);

  if (!raceState || !raceState.active) {
    return (
      <div className={styles.wrapper}>
        <EmptyState message="No race data" />
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <RaceTable />
      <PitPredictor raceState={raceState} playerCarIndex={playerCarIndex} />
      <WeatherImpact />
    </div>
  );
}

export default RaceTab;
