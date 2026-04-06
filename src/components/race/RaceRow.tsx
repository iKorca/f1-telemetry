import React from 'react';
import type { RaceEngineerCar } from '@shared/types';
import { TEAM_COLORS, COMPOUND_COLORS, DRIVER_STATUS, RESULT_STATUS } from '@/lib/constants';
import { fmtTime, fmtGap } from '@/lib/formatters';
import StintBadge from './StintBadge';
import styles from './RaceRow.module.css';

const RaceRow = React.memo(function RaceRow({
  car,
  playerCarIndex,
  visibleColumns,
}: {
  car: RaceEngineerCar & { idx: number };
  playerCarIndex: number;
  visibleColumns: boolean[];
}) {
  const teamColor = TEAM_COLORS[car.teamId] || '#888';
  const isPlayer = car.idx === playerCarIndex;
  const isRetired = car.resultStatus >= 4;
  const isPit = car.driverStatus === 0;

  const classNames = [
    isPlayer ? styles.player : '',
    isPit ? styles.pit : '',
    isRetired ? styles.retired : '',
  ].filter(Boolean).join(' ');

  const gapLeader = car.position === 1
    ? 'LEAD'
    : car.gapToLeaderMs > 0
      ? '+' + fmtGap(car.gapToLeaderMs)
      : '\u2014';

  const gapAhead = car.position === 1
    ? '\u2014'
    : car.gapToAheadMs > 0
      ? '+' + fmtGap(car.gapToAheadMs)
      : '\u2014';

  const compColor = COMPOUND_COLORS[car.currentCompound as keyof typeof COMPOUND_COLORS] || '#888';

  const status = isRetired
    ? (RESULT_STATUS[car.resultStatus] || 'RET')
    : (DRIVER_STATUS[car.driverStatus] || '');

  // Column cells indexed 0-10
  const cells = [
    /* 0  POS */    <td key="pos">{car.position}</td>,
    /* 1  DRIVER */ <td key="drv">{car.name}</td>,
    /* 2  LAST */   <td key="last">{car.lastLapMs ? fmtTime(car.lastLapMs) : '\u2014'}</td>,
    /* 3  BEST */   <td key="best">{car.bestLapMs ? fmtTime(car.bestLapMs) : '\u2014'}</td>,
    /* 4  GAP L */  <td key="gapl">{gapLeader}</td>,
    /* 5  GAP A */  <td key="gapa">{gapAhead}</td>,
    /* 6  TYRE */   <td key="tyre">
                      <span className={styles.tyreDot} style={{ background: compColor }} />
                      {car.currentCompound || '\u2014'}
                    </td>,
    /* 7  AGE */    <td key="age">{car.tyreAge}</td>,
    /* 8  STINT */  <td key="stint" className={styles.stintCell}>
                      <StintBadge
                        stints={car.stints || []}
                        currentCompound={car.currentCompound}
                        currentLap={car.currentLap}
                      />
                    </td>,
    /* 9  PITS */   <td key="pits">{car.numPitStops}</td>,
    /* 10 STATUS */ <td key="stat">{status}</td>,
  ];

  return (
    <tr className={classNames} style={{ borderLeft: `3px solid ${teamColor}` }}>
      {cells.map((cell, i) =>
        visibleColumns[i] ? cell : null,
      )}
    </tr>
  );
}, (prev, next) => {
  // Custom comparator: skip re-render if car data and visibility haven't changed
  const a = prev.car;
  const b = next.car;
  return (
    a.position === b.position &&
    a.lastLapMs === b.lastLapMs &&
    a.bestLapMs === b.bestLapMs &&
    a.gapToLeaderMs === b.gapToLeaderMs &&
    a.gapToAheadMs === b.gapToAheadMs &&
    a.currentCompound === b.currentCompound &&
    a.tyreAge === b.tyreAge &&
    a.numPitStops === b.numPitStops &&
    a.driverStatus === b.driverStatus &&
    a.resultStatus === b.resultStatus &&
    a.currentLap === b.currentLap &&
    a.stints?.length === b.stints?.length &&
    prev.playerCarIndex === next.playerCarIndex &&
    prev.visibleColumns === next.visibleColumns
  );
});

export default RaceRow;
