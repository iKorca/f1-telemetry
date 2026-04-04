import React, { useMemo } from 'react';
import { useTimingStore } from '@/store/timingStore';
import styles from './CompoundBadge.module.css';

function CompoundBadge() {
  const allCarStatus = useTimingStore((s) => s.allCarStatus);
  const playerCarIndex = useTimingStore((s) => s.playerCarIndex);

  const { compoundName, tyresAgeLaps } = useMemo(() => {
    const playerStatus = allCarStatus?.playerData;
    return {
      compoundName: playerStatus?.tyreCompoundName || '\u2014',
      tyresAgeLaps: playerStatus?.tyresAgeLaps ?? 0,
    };
  }, [allCarStatus, playerCarIndex]);

  const compoundClass = useMemo(() => {
    const lower = compoundName.toLowerCase();
    if (lower === 'soft') return styles.soft;
    if (lower === 'medium') return styles.medium;
    if (lower === 'hard') return styles.hard;
    if (lower === 'inter') return styles.inter;
    if (lower === 'wet') return styles.wet;
    return '';
  }, [compoundName]);

  return (
    <div className={styles.compoundRow}>
      <div className={`${styles.badge} ${compoundClass}`}>{compoundName}</div>
      <div>
        <div className={styles.ageLabel}>TYRE AGE</div>
        <div className={styles.ageVal}>{tyresAgeLaps} laps</div>
      </div>
    </div>
  );
}

export default React.memo(CompoundBadge);
