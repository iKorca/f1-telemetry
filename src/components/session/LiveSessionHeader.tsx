import React from 'react';
import type { SessionDetail } from '@shared/types';
import styles from './LiveSessionHeader.module.css';

interface LiveSessionHeaderProps {
  session: SessionDetail;
}

function LiveSessionHeader({ session }: LiveSessionHeaderProps) {
  return (
    <div className={styles.headerBar}>
      <div className={styles.item}>
        <span className={styles.label}>TRACK</span>
        <span className={`${styles.value} ${styles.big}`}>
          {session.track || '\u2014'}
        </span>
      </div>
      <div className={styles.item}>
        <span className={styles.label}>SESSION</span>
        <span className={`${styles.value} ${styles.muted}`}>
          {session.sessionType || '\u2014'}
        </span>
      </div>
      <span className={styles.recStatus}>RECORDING</span>
      <div className={styles.item}>
        <span className={styles.label}>LAPS</span>
        <span className={styles.value}>
          {session.laps?.length || 0} laps
        </span>
      </div>
      <div className={styles.item}>
        <span className={styles.label}>FRAMES</span>
        <span className={styles.value}>
          {session.frames?.length || 0} frames
        </span>
      </div>
    </div>
  );
}

export default React.memo(LiveSessionHeader);
