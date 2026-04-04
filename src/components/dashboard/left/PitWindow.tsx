import React, { useMemo } from 'react';
import { useSessionInfoStore } from '@/store/sessionInfoStore';
import { useTimingStore } from '@/store/timingStore';
import styles from './PitWindow.module.css';

function PitWindow() {
  const pitStopWindowIdealLap = useSessionInfoStore(
    (s) => s.pitStopWindowIdealLap,
  );
  const pitStopWindowLatestLap = useSessionInfoStore(
    (s) => s.pitStopWindowLatestLap,
  );
  const currentLap = useTimingStore((s) => s.currentLap);

  const { text, statusClass } = useMemo(() => {
    const ideal = pitStopWindowIdealLap;
    const latest = pitStopWindowLatestLap;

    if (ideal === 0 && latest === 0) {
      return { text: '\u2014', statusClass: styles.inactive };
    }

    const label = `LAP ${ideal} \u2014 ${latest}`;

    if (currentLap < ideal - 2) {
      return { text: label, statusClass: styles.inactive };
    } else if (currentLap < ideal) {
      return { text: label, statusClass: styles.approaching };
    } else if (currentLap <= latest) {
      return { text: label, statusClass: styles.active };
    } else {
      return { text: label, statusClass: styles.passed };
    }
  }, [pitStopWindowIdealLap, pitStopWindowLatestLap, currentLap]);

  return (
    <div className={styles.section}>
      <span className="section-label">PIT WINDOW</span>
      <div className={`${styles.badge} ${statusClass}`}>{text}</div>
    </div>
  );
}

export default React.memo(PitWindow);
