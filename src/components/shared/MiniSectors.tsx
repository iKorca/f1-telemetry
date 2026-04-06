import React, { useMemo } from 'react';
import type { SessionDetail } from '@shared/types';
import { getFramesForLap } from '@/lib/lapUtils';
import styles from './MiniSectors.module.css';

interface MiniSectorsProps {
  session: SessionDetail;
  lapIdx: number;
  compareLapIdx: number | null;
}

const SECTORS = 12;

function MiniSectors({ session, lapIdx, compareLapIdx }: MiniSectorsProps) {
  const data = useMemo(() => {
    const lap = session.laps[lapIdx];
    if (!lap) return null;
    const frames = getFramesForLap(session, lapIdx);
    if (frames.length < SECTORS) return null;

    const segLen = Math.floor(frames.length / SECTORS);
    const segTimes: number[] = [];
    for (let i = 0; i < SECTORS; i++) {
      const start = i * segLen;
      const end =
        i === SECTORS - 1 ? frames.length - 1 : (i + 1) * segLen;
      segTimes.push(frames[end].t - frames[start].t);
    }

    let cmpSegTimes: number[] | null = null;
    if (
      compareLapIdx !== null &&
      compareLapIdx !== undefined &&
      session.laps[compareLapIdx]
    ) {
      const cmpFrames = getFramesForLap(session, compareLapIdx);
      if (cmpFrames.length >= SECTORS) {
        const cmpSegLen = Math.floor(cmpFrames.length / SECTORS);
        cmpSegTimes = [];
        for (let i = 0; i < SECTORS; i++) {
          const start = i * cmpSegLen;
          const end =
            i === SECTORS - 1
              ? cmpFrames.length - 1
              : (i + 1) * cmpSegLen;
          cmpSegTimes.push(cmpFrames[end].t - cmpFrames[start].t);
        }
      }
    }

    return { segTimes, cmpSegTimes };
  }, [session, lapIdx, compareLapIdx]);

  if (!data) return null;

  const { segTimes, cmpSegTimes } = data;

  return (
    <div className={styles.container}>
      <span className="section-label">MINI-SECTORS</span>
      <div className={styles.grid}>
        {segTimes.map((t, i) => {
          let cellClass = styles.cell;
          let delta: string | null = null;
          if (cmpSegTimes) {
            const diff = t - cmpSegTimes[i];
            if (diff < 0) cellClass += ` ${styles.faster}`;
            else if (diff > 0) cellClass += ` ${styles.slower}`;
            delta = `${diff >= 0 ? '+' : ''}${(diff / 1000).toFixed(3)}`;
          }
          return (
            <div className={cellClass} key={i}>
              <span className={styles.num}>S{i + 1}</span>
              <span className={styles.time}>
                {(t / 1000).toFixed(3)}s
              </span>
              {delta !== null && (
                <span className={styles.delta}>{delta}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(MiniSectors);
