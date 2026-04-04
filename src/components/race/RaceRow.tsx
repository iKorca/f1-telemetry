import React from 'react';
import type { RaceEngineerCar } from '@shared/types';
import StintBadge from './StintBadge';
import styles from './RaceRow.module.css';

const TEAM_COLORS: Record<number, string> = {
  0: '#00e5ff', 1: '#dc0000', 2: '#00d2be', 3: '#ff8000', 4: '#0600ef',
  5: '#006f62', 6: '#2293d1', 7: '#b6babd', 8: '#52e252', 9: '#1868db',
  255: '#888888',
};

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: '#ff3333', MEDIUM: '#ffcc00', HARD: '#ffffff',
  INTER: '#33cc33', WET: '#3399ff', UNKNOWN: '#888888',
};

const DRIVER_STATUS = ['Garage', 'Flying', 'In Lap', 'Out Lap', 'On Track'];
const RESULT_STATUS = ['Invalid', 'Inactive', 'Active', 'Finished', 'DNF', 'DSQ', 'NC', 'RET'];

interface RaceRowProps {
  car: RaceEngineerCar & { idx: number };
  playerCarIndex: number;
  visibleColumns: boolean[];
}

function pad2(n: number) { return String(n).padStart(2, '0'); }
function pad3(n: number) { return String(n).padStart(3, '0'); }

function fmtTime(ms: number): string {
  if (!ms || ms === 0) return '\u2014';
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${mins}:${pad2(secs)}.${pad3(milli)}`;
}

function fmtGap(ms: number): string {
  if (ms < 60000) return (ms / 1000).toFixed(3);
  const m = Math.floor(ms / 60000);
  const s = ((ms % 60000) / 1000).toFixed(3);
  return m + ':' + (parseFloat(s) < 10 ? '0' : '') + s;
}

const RaceRow = React.memo(function RaceRow({
  car,
  playerCarIndex,
  visibleColumns,
}: RaceRowProps) {
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

  const compColor = COMPOUND_COLORS[car.currentCompound] || '#888';

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
