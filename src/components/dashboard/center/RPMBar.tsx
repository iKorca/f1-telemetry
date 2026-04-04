import React, { useMemo } from 'react';
import { useTelemetryStore } from '@/store/telemetryStore';
import { useTimingStore } from '@/store/timingStore';
import { rpmColor } from '@/lib/colors';
import { DEFAULT_MAX_RPM } from '@/lib/constants';
import styles from './RPMBar.module.css';

function RPMBar() {
  const engineRPM = useTelemetryStore((s) => s.engineRPM);
  const allCarStatus = useTimingStore((s) => s.allCarStatus);

  const maxRPM = allCarStatus?.playerData?.maxRPM || DEFAULT_MAX_RPM;

  const rpmPct = useMemo(() => {
    if (maxRPM <= 0) return 0;
    return Math.min(100, (engineRPM / maxRPM) * 100);
  }, [engineRPM, maxRPM]);

  const barColor = useMemo(() => rpmColor(rpmPct), [rpmPct]);

  const maxLabel = maxRPM > 0
    ? maxRPM.toLocaleString() + ' MAX'
    : '';

  return (
    <div className={styles.rpmSection}>
      <div className={styles.rpmBarWrap}>
        <div
          className={styles.rpmBar}
          style={{ width: `${rpmPct}%`, background: barColor }}
        />
      </div>
      <div className={styles.rpmLabels}>
        <span>{engineRPM.toLocaleString()} RPM</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

export default React.memo(RPMBar);
