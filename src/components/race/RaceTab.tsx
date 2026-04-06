import React, { useState, useCallback } from 'react';
import { useRaceStore } from '@/store/raceStore';
import { useTimingStore } from '@/store/timingStore';
import ColumnPicker from './ColumnPicker';
import RaceTable from './RaceTable';
import PitPredictor from './PitPredictor';
import WeatherImpact from './WeatherImpact';
import EmptyState from '@/components/common/EmptyState';
import styles from './RaceTab.module.css';

// 11 columns: all visible by default
const DEFAULT_COLUMNS = Array(11).fill(true);

function RaceTab() {
  const raceState = useRaceStore((s) => s.raceState);
  const playerCarIndex = useTimingStore((s) => s.playerCarIndex);

  const [visibleColumns, setVisibleColumns] = useState<boolean[]>(DEFAULT_COLUMNS);

  const handleToggle = useCallback((index: number) => {
    setVisibleColumns((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  if (!raceState || !raceState.active) {
    return (
      <div className={styles.wrapper}>
        <EmptyState message="No race data" />
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <ColumnPicker visibleColumns={visibleColumns} onToggle={handleToggle} />
      <RaceTable
        raceState={raceState}
        playerCarIndex={playerCarIndex}
        visibleColumns={visibleColumns}
      />
      <PitPredictor raceState={raceState} playerCarIndex={playerCarIndex} />
      <WeatherImpact />
    </div>
  );
}

export default RaceTab;
