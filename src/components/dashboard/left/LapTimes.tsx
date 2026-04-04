import React from 'react';
import { useTimingStore } from '@/store/timingStore';
import { fmtTime } from '@/lib/formatters';
import styles from './LapTimes.module.css';

function LapTimes() {
  const currentLapTimeMs = useTimingStore((s) => s.currentLapTimeMs);
  const lastLapMs = useTimingStore((s) => s.lastLapMs);
  const bestLapMs = useTimingStore((s) => s.bestLapMs);
  const currentLapInvalid = useTimingStore((s) => s.currentLapInvalid);

  const currentClass = [
    styles.lapTime,
    styles.currentTime,
    currentLapInvalid ? styles.invalidTime : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div className={styles.lapRow}>
        <div className={styles.lapLabel}>CURRENT</div>
        <div className={currentClass}>{fmtTime(currentLapTimeMs)}</div>
      </div>
      <div className={styles.lapRow}>
        <div className={styles.lapLabel}>LAST</div>
        <div className={styles.lapTime}>{fmtTime(lastLapMs)}</div>
      </div>
      <div className={styles.lapRow}>
        <div className={styles.lapLabel}>BEST</div>
        <div className={`${styles.lapTime} ${styles.bestTime}`}>
          {fmtTime(bestLapMs)}
        </div>
      </div>
    </>
  );
}

export default React.memo(LapTimes);
