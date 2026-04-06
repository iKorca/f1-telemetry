import React from 'react';
import type { RecordedLap } from '@shared/types';
import { COMPOUND_COLORS } from '@shared/types';
import { fmtTime } from '@/lib/formatters';
import styles from './LapTableBase.module.css';

export interface LapTableBaseProps {
  /** All laps (including deleted ones, which will be skipped). */
  laps: RecordedLap[];
  /** Index of the best valid lap, or -1 if none. */
  bestLapIdx: number;
  /** Currently selected lap index, or null. */
  selectedLapIdx: number | null;
  /** Called when a lap row is clicked. */
  onLapClick: (lapIdx: number) => void;
  /** Optional right-click handler (used by History detail). */
  onContextMenu?: (e: React.MouseEvent, lapIdx: number) => void;
  /** If true, the last lap will get a flash animation (used by Session live). */
  showFlashAnimation?: boolean;
  /** Index of the lap to flash (typically laps.length - 1 when a new lap arrives). Set to -1 or omit to disable. */
  flashLapIdx?: number;
  /** Show tyre compound as dot+text (session) vs plain text (history). Default true. */
  showTyreDot?: boolean;
}

function LapTableBase({
  laps,
  bestLapIdx,
  selectedLapIdx,
  onLapClick,
  onContextMenu,
  showFlashAnimation = false,
  flashLapIdx = -1,
  showTyreDot = true,
}: LapTableBaseProps) {
  if (!laps.length) return null;

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
            <th>{showTyreDot ? 'TYRE' : 'COMP'}</th>
            <th>AGE</th>
            <th>MAX SPD</th>
            <th>{showTyreDot ? 'V' : 'VALID'}</th>
          </tr>
        </thead>
        <tbody>
          {laps.map((lap, i) => {
            if (lap.deleted) return null;

            const isBest = i === bestLapIdx;
            const isFlash = showFlashAnimation && i === flashLapIdx;

            let cls = '';
            if (isBest) cls += ` ${styles.bestLap}`;
            if (lap.valid === false) cls += ` ${styles.invalidLap}`;
            if (selectedLapIdx === i) cls += ` ${styles.selectedLap}`;
            if (isFlash) cls += ` ${styles.newLap}`;

            const noteIcon = lap.notes ? ' \uD83D\uDCDD' : '';

            const colorKey = (lap.compound || '').toUpperCase() as keyof typeof COMPOUND_COLORS;
            const compColor = COMPOUND_COLORS[colorKey] || '#888';

            return (
              <tr
                key={i}
                className={cls}
                onClick={() => onLapClick(i)}
                onContextMenu={
                  onContextMenu
                    ? (e) => {
                        e.preventDefault();
                        onContextMenu(e, i);
                      }
                    : undefined
                }
                title={lap.notes || ''}
              >
                <td>
                  {lap.lapNum}
                  {noteIcon}
                </td>
                <td>
                  {lap.lapTimeMs > 0 ? fmtTime(lap.lapTimeMs) : '\u2014'}
                </td>
                <td>{lap.s1Ms > 0 ? fmtTime(lap.s1Ms) : '\u2014'}</td>
                <td>{lap.s2Ms > 0 ? fmtTime(lap.s2Ms) : '\u2014'}</td>
                <td>{lap.s3Ms > 0 ? fmtTime(lap.s3Ms) : '\u2014'}</td>
                <td>
                  {showTyreDot && (
                    <span
                      className={styles.tyreDot}
                      style={{ background: compColor }}
                    />
                  )}
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

export default React.memo(LapTableBase);
