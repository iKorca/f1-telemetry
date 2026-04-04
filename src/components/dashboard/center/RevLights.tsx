import React, { useMemo } from 'react';
import { useTelemetryStore } from '@/store/telemetryStore';
import styles from './RevLights.module.css';

const LIGHT_COUNT = 15;

function RevLights() {
  const revLightsPercent = useTelemetryStore((s) => s.revLightsPercent);

  const lights = useMemo(() => {
    const lit = Math.round((revLightsPercent / 100) * LIGHT_COUNT);
    const flash = revLightsPercent >= 100;

    const result: string[] = [];
    for (let i = 0; i < LIGHT_COUNT; i++) {
      if (!flash && i >= lit) {
        result.push(styles.rl);
      } else {
        const colorClass = i < 5 ? styles.gOn : i < 10 ? styles.oOn : styles.rOn;
        result.push(
          `${styles.rl} ${colorClass}${flash ? ` ${styles.flash}` : ''}`
        );
      }
    }
    return result;
  }, [revLightsPercent]);

  return (
    <div className={styles.revLights}>
      {lights.map((cls, i) => (
        <div key={i} className={cls} />
      ))}
    </div>
  );
}

export default React.memo(RevLights);
