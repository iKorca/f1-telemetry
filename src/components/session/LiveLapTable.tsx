import React, { useMemo, useRef, useEffect } from 'react';
import type { SessionDetail } from '@shared/types';
import { COMPOUND_COLORS } from '@shared/types';
import { fmtTime } from '@/lib/formatters';
import styles from './LiveLapTable.module.css';

interface LiveLapTableProps {
  session: SessionDetail;
  selectedLap: number | null;
  onLapClick: (lapIdx: number) => void;
}

function LiveLapTable({ session, selectedLap, onLapClick }: LiveLapTableProps) {
  const prevLapCountRef = useRef(0);

  const { laps, bestIdx } = useMemo(() => {
    const laps = session.laps || [];
    let bestTime = Infinity;
    let bestIdx = -1;
    laps.forEach((l, i) => {
      if (
        l.lapTimeMs > 0 &&
        l.valid !== false &&
        !l.deleted &&
        l.lapTimeMs < bestTime
      ) {
        bestTime = l.lapTimeMs;
        bestIdx = i;
      }
    });
    return { laps, bestIdx };
  }, [session.laps]);

  // Track new laps for flash animation
  const currentLapCount = laps.length;
  const hasNewLap = currentLapCount > prevLapCountRef.current;
  useEffect(() => {
    prevLapCountRef.current = currentLapCount;
  }, [currentLapCount]);

  if (!laps.length) return null;

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>#</th>
            <th>LAP TIME</th>
            <th>S1</th>
            <th>S2</th>
            <th>S3</th>
            <th>TYRE</th>
            <th>AGE</th>
            <th>MAX SPD</th>
            <th>V</th>
          </tr>
        </thead>
        <tbody>
          {laps.map((lap, i) => {
            if (lap.deleted) return null;
            const isBest = i === bestIdx;
            const isNew = hasNewLap && i === laps.length - 1;
            let cls = '';
            if (isBest) cls += ` ${styles.bestLap}`;
            if (lap.valid === false) cls += ` ${styles.invalidLap}`;
            if (selectedLap === i) cls += ` ${styles.selectedLap}`;
            if (isNew) cls += ` ${styles.newLap}`;

            const colorKey = (lap.compound || '').toUpperCase() as keyof typeof COMPOUND_COLORS;
            const compColor = COMPOUND_COLORS[colorKey] || '#888';

            return (
              <tr
                key={i}
                className={cls}
                onClick={() => onLapClick(i)}
              >
                <td>{lap.lapNum}</td>
                <td>
                  {lap.lapTimeMs > 0 ? fmtTime(lap.lapTimeMs) : '\u2014'}
                </td>
                <td>{lap.s1Ms > 0 ? fmtTime(lap.s1Ms) : '\u2014'}</td>
                <td>{lap.s2Ms > 0 ? fmtTime(lap.s2Ms) : '\u2014'}</td>
                <td>{lap.s3Ms > 0 ? fmtTime(lap.s3Ms) : '\u2014'}</td>
                <td>
                  <span
                    className={styles.tyreDot}
                    style={{ background: compColor }}
                  />
                  {lap.compound || '\u2014'}
                </td>
                <td>{lap.tyreAge ?? '\u2014'}</td>
                <td>
                  {lap.maxSpeed ? lap.maxSpeed + ' km/h' : '\u2014'}
                </td>
                <td>{lap.valid === false ? '\u2717' : '\u2713'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default React.memo(LiveLapTable);
