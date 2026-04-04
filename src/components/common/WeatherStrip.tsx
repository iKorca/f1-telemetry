import { useSessionInfoStore } from '../../store/sessionInfoStore';
import { WEATHER_ICONS } from '@shared/types';
import styles from './WeatherStrip.module.css';

export default function WeatherStrip() {
  const weatherForecast = useSessionInfoStore((s) => s.weatherForecast);

  if (!weatherForecast || weatherForecast.length === 0) {
    return null;
  }

  // Deduplicate by timeOffset, show up to 8 items
  const seen = new Set<number>();
  const unique = [];
  for (const f of weatherForecast) {
    if (!seen.has(f.timeOffset)) {
      seen.add(f.timeOffset);
      unique.push(f);
    }
    if (unique.length >= 8) break;
  }

  return (
    <div className={styles.strip}>
      <div className={styles.items}>
        {unique.map((f, i) => {
          const icon = WEATHER_ICONS[f.weather] || '?';
          return (
            <div key={i} className={styles.item}>
              <span className={styles.time}>+{f.timeOffset}m</span>
              <span className={styles.icon}>{icon}</span>
              <span>{f.weatherName || ''}</span>
              <span className={styles.temp}>{f.trackTemperature}&deg;</span>
              {f.rainPercentage > 0 && (
                <span className={styles.rain}>{f.rainPercentage}%</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
