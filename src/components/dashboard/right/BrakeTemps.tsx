import React from 'react';
import { useTelemetryStore } from '@/store/telemetryStore';
import { brakeTempColor } from '@/lib/colors';
import styles from './BrakeTemps.module.css';

// Brake array order: [RL=0, RR=1, FL=2, FR=3]
const CORNERS = [
  { label: 'FL', idx: 2 },
  { label: 'FR', idx: 3 },
  { label: 'RL', idx: 0 },
  { label: 'RR', idx: 1 },
] as const;

function BrakeTemps() {
  const brakesTemperature = useTelemetryStore((s) => s.brakesTemperature);

  return (
    <>
      <span className="section-label">BRAKES</span>
      <div className={styles.grid}>
        {CORNERS.map(({ label, idx }) => {
          const temp = Math.round(brakesTemperature[idx]);
          return (
            <div key={label} className={styles.item}>
              <span className={styles.pos}>{label}</span>
              <span className={styles.val} style={{ color: brakeTempColor(temp) }}>
                {temp}°C
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default React.memo(BrakeTemps);
