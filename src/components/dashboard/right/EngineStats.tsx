import React, { useMemo } from 'react';
import { useTelemetryStore } from '@/store/telemetryStore';
import { useTimingStore } from '@/store/timingStore';
import styles from './EngineStats.module.css';

function EngineStats() {
  const engineTemperature = useTelemetryStore((s) => s.engineTemperature);
  const allCarStatus = useTimingStore((s) => s.allCarStatus);

  const brakeBias = useMemo(() => {
    return allCarStatus?.playerData?.frontBrakeBias ?? 0;
  }, [allCarStatus]);

  return (
    <>
      <span className="section-label">ENGINE</span>
      <div className={styles.row}>
        <div className={styles.stat}>
          <span className={styles.label}>TEMP</span>
          <span className={styles.val}>{engineTemperature}°C</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>BRAKE BIAS</span>
          <span className={styles.val}>{brakeBias}%</span>
        </div>
      </div>
    </>
  );
}

export default React.memo(EngineStats);
