import React, { useMemo } from 'react';
import { useTimingStore } from '@/store/timingStore';
import { getTeamColor } from '@/lib/colors';
import { COMPOUND_COLORS } from '@shared/types';
import styles from './RelativeBar.module.css';

/** Resolve compound name from visualTyreCompound id */
function tyreName(visualCompound: number): string {
  const map: Record<number, string> = {
    16: 'SOFT',
    17: 'MEDIUM',
    18: 'HARD',
    7: 'INTER',
    8: 'WET',
  };
  return map[visualCompound] || '';
}

function fmtRelGap(ms: number): string {
  if (!ms || ms === 0) return '0.0';
  return (ms / 1000).toFixed(1);
}

interface RelCar {
  idx: number;
  name: string;
  teamId: number;
  pos: number;
  gap: number;
  isPlayer: boolean;
}

function RelativeBar() {
  const allLapData = useTimingStore((s) => s.allLapData);
  const allParticipants = useTimingStore((s) => s.allParticipants);
  const allCarStatus = useTimingStore((s) => s.allCarStatus);
  const playerCarIndex = useTimingStore((s) => s.playerCarIndex);

  const visibleCars = useMemo(() => {
    const allLaps = allLapData?.allCars;
    const parts = allParticipants?.participants || [];
    const pi = playerCarIndex;
    if (!allLaps || pi < 0 || !allLaps[pi]) return [];

    const playerLap = allLaps[pi];
    const playerPos = playerLap.carPosition || 0;

    const cars: RelCar[] = [];
    for (let i = 0; i < allLaps.length; i++) {
      const lap = allLaps[i];
      if (!lap || !lap.carPosition || lap.carPosition === 0) continue;
      const name = parts[i]?.name || '';
      if (!name) continue;
      const teamId = parts[i]?.teamId ?? 0;

      let gap = 0;
      if (i === pi) {
        gap = 0;
      } else if (lap.carPosition < playerPos) {
        gap = -(lap.deltaToCarInFrontInMS || 0);
      } else {
        gap = lap.deltaToCarInFrontInMS || 0;
      }
      cars.push({ idx: i, name, teamId, pos: lap.carPosition, gap, isPlayer: i === pi });
    }

    cars.sort((a, b) => a.pos - b.pos);
    const playerIdx = cars.findIndex((c) => c.isPlayer);
    const start = Math.max(0, playerIdx - 4);
    const end = Math.min(cars.length, playerIdx + 5);
    return cars.slice(start, end);
  }, [allLapData, allParticipants, allCarStatus, playerCarIndex]);

  if (visibleCars.length === 0) return null;

  const playerPos = allLapData?.allCars?.[playerCarIndex]?.carPosition ?? 0;

  return (
    <div className={styles.bar}>
      <div className={styles.content}>
        {visibleCars.map((c) => {
          const teamColor = getTeamColor(c.teamId);
          const gapStr = c.isPlayer
            ? ''
            : c.pos < playerPos
              ? '-' + fmtRelGap(Math.abs(c.gap))
              : '+' + fmtRelGap(Math.abs(c.gap));
          const gapCls = c.isPlayer
            ? ''
            : c.pos < playerPos
              ? styles.ahead
              : styles.behind;

          return (
            <div
              key={c.idx}
              className={`${styles.car}${c.isPlayer ? ` ${styles.player}` : ''}`}
              style={{ borderLeft: `3px solid ${teamColor}` }}
            >
              <span className={styles.pos}>{c.pos}</span>
              <span className={styles.name}>{c.name}</span>
              <span className={`${styles.gap} ${gapCls}`}>{gapStr}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(RelativeBar);
