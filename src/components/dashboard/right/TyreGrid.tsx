import React, { useMemo } from 'react';
import { useTelemetryStore } from '@/store/telemetryStore';
import { useTimingStore } from '@/store/timingStore';
import { tyreTempColor, wearColor } from '@/lib/colors';
import styles from './TyreGrid.module.css';

// F1 tyre array order: [RL=0, RR=1, FL=2, FR=3]
const CORNERS = [
  { label: 'FL', idx: 2 },
  { label: 'FR', idx: 3 },
  { label: 'RL', idx: 0 },
  { label: 'RR', idx: 1 },
] as const;

function TyreGrid() {
  const surfaceTemps = useTelemetryStore((s) => s.tyresSurfaceTemperature);
  const innerTemps = useTelemetryStore((s) => s.tyresInnerTemperature);
  const pressures = useTelemetryStore((s) => s.tyresPressure);
  const allCarDamage = useTimingStore((s) => s.allCarDamage);

  const tyresWear = useMemo(() => {
    return allCarDamage?.playerData?.tyresWear ?? [0, 0, 0, 0];
  }, [allCarDamage]);

  return (
    <div className={styles.grid}>
      {CORNERS.map(({ label, idx }) => {
        const surfTemp = Math.round(surfaceTemps[idx]);
        const innTemp = Math.round(innerTemps[idx]);
        const wear = Math.min(100, Math.max(0, tyresWear[idx]));
        const pressure = pressures[idx].toFixed(1);
        const tempColor = tyreTempColor(surfTemp);

        return (
          <div key={label} className={styles.corner}>
            <span className={styles.pos}>{label}</span>
            <span className={styles.surf} style={{ color: tempColor }}>
              {surfTemp}°C
            </span>
            <span className={styles.inner} style={{ color: tyreTempColor(innTemp) }}>
              {innTemp}°C
            </span>
            <div className={styles.wearWrap}>
              <div
                className={styles.wearBar}
                style={{
                  width: `${wear}%`,
                  background: wearColor(wear),
                }}
              />
            </div>
            <span className={styles.pres}>{pressure} psi</span>
          </div>
        );
      })}
    </div>
  );
}

export default React.memo(TyreGrid);
