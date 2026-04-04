import React, { useMemo } from 'react';
import type { RaceEngineerData } from '@shared/types';
import RaceRow from './RaceRow';
import styles from './RaceTable.module.css';

const COLUMN_HEADERS = [
  'POS', 'DRIVER', 'LAST LAP', 'BEST LAP', 'GAP LEADER',
  'GAP AHEAD', 'TYRE', 'AGE', 'STINT HISTORY', 'PITS', 'STATUS',
];

interface RaceTableProps {
  raceState: RaceEngineerData;
  playerCarIndex: number;
  visibleColumns: boolean[];
}

function RaceTable({ raceState, playerCarIndex, visibleColumns }: RaceTableProps) {
  const sortedCars = useMemo(() => {
    return raceState.cars
      .map((c, i) => ({ ...c, idx: i }))
      .filter((c) => c.name && c.position > 0)
      .sort((a, b) => a.position - b.position);
  }, [raceState.cars]);

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {COLUMN_HEADERS.map((header, i) =>
              visibleColumns[i] ? <th key={header}>{header}</th> : null,
            )}
          </tr>
        </thead>
        <tbody>
          {sortedCars.map((car) => (
            <RaceRow
              key={car.idx}
              car={car}
              playerCarIndex={playerCarIndex}
              visibleColumns={visibleColumns}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default React.memo(RaceTable);
