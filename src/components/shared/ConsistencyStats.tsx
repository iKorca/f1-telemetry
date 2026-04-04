import React, { useMemo } from 'react';
import type { SessionDetail } from '@shared/types';
import { fmtTime } from '@/lib/formatters';
import styles from './ConsistencyStats.module.css';

interface ConsistencyStatsProps {
  session: SessionDetail;
}

function ConsistencyStats({ session }: ConsistencyStatsProps) {
  const stats = useMemo(() => {
    const laps = (session.laps || []).filter(
      (l) => l.lapTimeMs > 0 && l.valid !== false && !l.deleted,
    );
    if (laps.length < 2) return null;

    const times = laps.map((l) => l.lapTimeMs);
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const sorted = [...times].sort((a, b) => a - b);
    const median =
      sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
    const variance =
      times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length;
    const stddev = Math.sqrt(variance);
    const cv = (stddev / mean) * 100;
    const score = Math.max(0, Math.min(100, 100 - cv * 10));
    const best3 = sorted.slice(0, Math.min(3, sorted.length));
    const worst3 = sorted.slice(-Math.min(3, sorted.length));
    const best3avg = best3.reduce((a, b) => a + b, 0) / best3.length;
    const worst3avg = worst3.reduce((a, b) => a + b, 0) / worst3.length;

    return { mean, median, stddev, score, best3avg, worst3avg };
  }, [session.laps]);

  if (!stats) return null;

  const scoreColor =
    stats.score > 80 ? 'green' : stats.score > 50 ? 'yellow' : 'red';

  return (
    <div className={styles.statsBar}>
      <div className={styles.card}>
        <div className={styles.label}>MEAN</div>
        <div className={styles.value}>{fmtTime(stats.mean)}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>MEDIAN</div>
        <div className={styles.value}>{fmtTime(stats.median)}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>STD DEV</div>
        <div className={styles.value}>
          {(stats.stddev / 1000).toFixed(3)}s
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>CONSISTENCY</div>
        <div className={`${styles.value} ${styles[scoreColor]}`}>
          {stats.score.toFixed(0)}%
        </div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>BEST 3 AVG</div>
        <div className={styles.value}>{fmtTime(stats.best3avg)}</div>
      </div>
      <div className={styles.card}>
        <div className={styles.label}>WORST 3 AVG</div>
        <div className={styles.value}>{fmtTime(stats.worst3avg)}</div>
      </div>
    </div>
  );
}

export default React.memo(ConsistencyStats);
