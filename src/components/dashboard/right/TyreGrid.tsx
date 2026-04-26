import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTelemetryStore } from '@/store/telemetryStore';
import { useTimingStore } from '@/store/timingStore';
import { tyreTempColor, wearColor } from '@/lib/colors';
import { getTempWindow, tyreTempStatus, tempStatusColor } from '@/lib/tyreTemps';
import styles from './TyreGrid.module.css';

// F1 tyre array order: [RL=0, RR=1, FL=2, FR=3]
const CORNERS = [
  { label: 'FL', idx: 2 },
  { label: 'FR', idx: 3 },
  { label: 'RL', idx: 0 },
  { label: 'RR', idx: 1 },
] as const;

function TyreGrid() {
  // Shallow compare so we only re-render when a wheel's value actually changes
  // (not on every identity-new array reference the store hands out per packet).
  const { surfaceTemps, innerTemps, pressures } = useTelemetryStore(
    useShallow((s) => ({
      surfaceTemps: s.tyresSurfaceTemperature,
      innerTemps: s.tyresInnerTemperature,
      pressures: s.tyresPressure,
    })),
  );
  const allCarDamage = useTimingStore((s) => s.allCarDamage);
  const allCarStatus = useTimingStore((s) => s.allCarStatus);

  const tyresWear = useMemo(() => {
    return allCarDamage?.playerData?.tyresWear ?? [0, 0, 0, 0];
  }, [allCarDamage]);

  const compound = allCarStatus?.playerData?.tyreCompoundName;
  const window = useMemo(() => getTempWindow(compound), [compound]);

  return (
    <div className={styles.grid}>
      {CORNERS.map(({ label, idx }) => {
        const surfTemp = Math.round(surfaceTemps[idx]);
        const innTemp = Math.round(innerTemps[idx]);
        const wear = Math.min(100, Math.max(0, tyresWear[idx]));
        const pressure = pressures[idx].toFixed(1);
        const tempColor = tyreTempColor(surfTemp);
        const status = tyreTempStatus(innTemp, compound);
        const innerColor = window ? tempStatusColor(status) : tyreTempColor(innTemp);

        // Position indicator: where the current inner temp falls in [min, max]
        const markerPct = window
          ? Math.min(100, Math.max(0, ((innTemp - window.min) / (window.max - window.min)) * 100))
          : 50;

        return (
          <div key={label} className={styles.corner}>
            <span className={styles.pos}>{label}</span>
            <span className={styles.surf} style={{ color: tempColor }}>
              {surfTemp}°C
            </span>
            <span className={styles.inner} style={{ color: innerColor }}>
              {innTemp}°C
              {window && status !== 'unknown' && (
                <span className={styles.windowTag} title={`Optimal ${window.min}–${window.max}°C`}>
                  {status === 'optimal' ? '✓' : status === 'cold' ? '↓' : '↑'}
                </span>
              )}
            </span>
            {window && (
              <div className={styles.windowBar} title={`Optimal window ${window.min}–${window.max}°C (target ${window.optimal}°C)`}>
                <div className={styles.windowMarker} style={{ left: `${markerPct}%`, background: innerColor }} />
              </div>
            )}
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
