import React, { useMemo } from 'react';
import { useTimingStore } from '@/store/timingStore';
import { useSessionInfoStore } from '@/store/sessionInfoStore';
import { fmtDeltaSigned } from '@/lib/formatters';
import styles from './DeltaBar.module.css';

function DeltaBar() {
  const currentLapTimeMs = useTimingStore((s) => s.currentLapTimeMs);
  const bestLapTimeMs = useTimingStore((s) => s.bestLapTimeMs);
  const currentLapDistance = useTimingStore((s) => s.currentLapDistance);
  const trackLength = useSessionInfoStore((s) => s.trackLength);

  const { deltaMs, pct, isFaster } = useMemo(() => {
    let delta = 0;
    if (bestLapTimeMs > 0 && currentLapTimeMs > 0 && trackLength > 0) {
      const lapFraction = Math.max(0, Math.min(1, currentLapDistance / trackLength));
      const expectedMs = bestLapTimeMs * lapFraction;
      delta = currentLapTimeMs - expectedMs;
    }

    const maxDelta = 5000; // 5 seconds max
    const percent = Math.min(50, (Math.abs(delta) / maxDelta) * 50);

    return {
      deltaMs: delta,
      pct: percent,
      isFaster: delta <= 0,
    };
  }, [currentLapTimeMs, bestLapTimeMs, currentLapDistance, trackLength]);

  const negWidth = isFaster ? `${pct}%` : '0%';
  const posWidth = isFaster ? '0%' : `${pct}%`;

  const valueClass = [
    styles.deltaValue,
    deltaMs !== 0 ? (isFaster ? styles.deltaFaster : styles.deltaSlower) : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.section}>
      <span className="section-label">DELTA TO BEST</span>
      <div className={styles.barWrap}>
        <div
          className={`${styles.deltaHalf} ${styles.neg}`}
          style={{ width: negWidth }}
        />
        <div className={styles.center} />
        <div
          className={`${styles.deltaHalf} ${styles.pos}`}
          style={{ width: posWidth }}
        />
      </div>
      <div className={valueClass}>{fmtDeltaSigned(deltaMs)}</div>
    </div>
  );
}

export default React.memo(DeltaBar);
