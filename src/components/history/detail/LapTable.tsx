import React, { useMemo, useCallback } from 'react';
import type { SessionDetail } from '@shared/types';
import { fmtTime, fmtSector } from '@/lib/formatters';
import styles from './LapTable.module.css';

interface LapTableProps {
  session: SessionDetail;
  selectedLapIdx: number | null;
  onLapSelect: (lapIdx: number) => void;
  onContextMenu: (e: React.MouseEvent, lapIdx: number) => void;
}

function LapTable({
  session,
  selectedLapIdx,
  onLapSelect,
  onContextMenu,
}: LapTableProps) {
  const { laps: visibleLaps, bestIdx } = useMemo(() => {
    const allLaps = session.laps || [];
    const visible = allLaps
      .map((l, idx) => ({ lap: l, realIdx: idx }))
      .filter(({ lap }) => !lap.deleted);

    let bestTime = Infinity;
    let best = -1;
    visible.forEach(({ lap, realIdx }) => {
      if (lap.valid && lap.lapTimeMs > 0 && lap.lapTimeMs < bestTime) {
        bestTime = lap.lapTimeMs;
        best = realIdx;
      }
    });
    return { laps: visible, bestIdx: best };
  }, [session.laps]);

  const handleRowClick = useCallback(
    (realIdx: number) => {
      onLapSelect(realIdx);
    },
    [onLapSelect],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, realIdx: number) => {
      e.preventDefault();
      onContextMenu(e, realIdx);
    },
    [onContextMenu],
  );

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>TIME</th>
            <th>S1</th>
            <th>S2</th>
            <th>S3</th>
            <th>COMP</th>
            <th>AGE</th>
            <th>MAX SPD</th>
            <th>VALID</th>
          </tr>
        </thead>
        <tbody>
          {visibleLaps.map(({ lap, realIdx }) => {
            const isBest = realIdx === bestIdx;
            const isInvalid = !lap.valid;
            const isSelected = selectedLapIdx === realIdx;
            const noteIcon = lap.notes ? ' \uD83D\uDCDD' : '';

            let rowClass = '';
            if (isBest) rowClass = styles.bestLap;
            else if (isInvalid) rowClass = styles.invalidLap;
            if (isSelected) rowClass += ` ${styles.selectedLap}`;

            return (
              <tr
                key={realIdx}
                className={rowClass}
                onClick={() => handleRowClick(realIdx)}
                onContextMenu={(e) => handleContextMenu(e, realIdx)}
                title={lap.notes || ''}
              >
                <td>
                  {lap.lapNum}
                  {noteIcon}
                </td>
                <td>{lap.lapTimeMs ? fmtTime(lap.lapTimeMs) : '\u2014'}</td>
                <td>{lap.s1Ms ? fmtSector(lap.s1Ms) : '\u2014'}</td>
                <td>{lap.s2Ms ? fmtSector(lap.s2Ms) : '\u2014'}</td>
                <td>{lap.s3Ms ? fmtSector(lap.s3Ms) : '\u2014'}</td>
                <td>{lap.compound || '\u2014'}</td>
                <td>{lap.tyreAge ?? '\u2014'}</td>
                <td>{lap.maxSpeed ? lap.maxSpeed + ' km/h' : '\u2014'}</td>
                <td>{lap.valid ? '\u2713' : '\u2717'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default React.memo(LapTable);
