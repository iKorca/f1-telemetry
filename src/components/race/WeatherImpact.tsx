import React, { useMemo } from 'react';
import { useRaceStore } from '@/store/raceStore';
import styles from './WeatherImpact.module.css';

function WeatherImpact() {
  const weatherHistory = useRaceStore((s) => s.weatherHistory);

  const recent = useMemo(() => {
    return weatherHistory.slice(-8);
  }, [weatherHistory]);

  if (recent.length < 2) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.label}>Weather Impact</div>
      <div>
        {recent.map((entry, i) => {
          let delta = '';
          let deltaClass = '';
          if (i > 0) {
            const diff = entry.lapTimeMs - recent[i - 1].lapTimeMs;
            delta = (diff >= 0 ? '+' : '') + (diff / 1000).toFixed(2) + 's';
            deltaClass = diff < 0 ? styles.faster : styles.slower;
          }
          return (
            <div key={entry.lap} className={styles.entry}>
              <span className={styles.lap}>L{entry.lap}</span>
              <span className={styles.cond}>
                {entry.weather} &middot; Track {entry.trackTemp}&deg; &middot; Air {entry.airTemp}&deg;
              </span>
              <span className={`${styles.delta} ${deltaClass}`}>{delta}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(WeatherImpact);
