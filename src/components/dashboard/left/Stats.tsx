import React from 'react';
import { useTimingStore } from '@/store/timingStore';
import { fmtDelta } from '@/lib/formatters';
import styles from './Stats.module.css';

function Stats() {
  const position = useTimingStore((s) => s.position);
  const gapToLeader = useTimingStore((s) => s.gapToLeader);
  const numPitStops = useTimingStore((s) => s.numPitStops);
  const penalties = useTimingStore((s) => s.penalties);

  const gapDisplay =
    gapToLeader > 0 ? '+' + fmtDelta(gapToLeader) : 'LEAD';

  return (
    <>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>POS</div>
          <div className={styles.statValue}>{position || '\u2014'}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>GAP</div>
          <div className={`${styles.statValue} ${styles.small}`}>
            {gapDisplay}
          </div>
        </div>
      </div>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>PIT STOPS</div>
          <div className={styles.statValue}>{numPitStops ?? '\u2014'}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>PENALTIES</div>
          <div className={styles.statValue}>
            {penalties > 0 ? penalties + 's' : '0s'}
          </div>
        </div>
      </div>
    </>
  );
}

export default React.memo(Stats);
