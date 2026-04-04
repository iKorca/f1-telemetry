import React, { useMemo } from 'react';
import { useTimingStore } from '@/store/timingStore';
import { fmtSector } from '@/lib/formatters';
import styles from './Sectors.module.css';

function Sectors() {
  const lastSector1 = useTimingStore((s) => s.lastSector1);
  const lastSector2 = useTimingStore((s) => s.lastSector2);
  const lastLapMs = useTimingStore((s) => s.lastLapMs);

  const s3 = useMemo(() => {
    if (lastLapMs > 0 && lastSector1 > 0 && lastSector2 > 0) {
      const val = lastLapMs - lastSector1 - lastSector2;
      return val > 0 ? val : 0;
    }
    return 0;
  }, [lastLapMs, lastSector1, lastSector2]);

  return (
    <div className={styles.sectorRow}>
      <div className={styles.sectorCol}>
        <div className={styles.sectorLabel}>S1</div>
        <div className={styles.sectorTime}>{fmtSector(lastSector1)}</div>
      </div>
      <div className={styles.sectorCol}>
        <div className={styles.sectorLabel}>S2</div>
        <div className={styles.sectorTime}>{fmtSector(lastSector2)}</div>
      </div>
      <div className={styles.sectorCol}>
        <div className={styles.sectorLabel}>S3</div>
        <div className={styles.sectorTime}>{fmtSector(s3)}</div>
      </div>
    </div>
  );
}

export default React.memo(Sectors);
