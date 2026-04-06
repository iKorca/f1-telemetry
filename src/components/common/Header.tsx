import { useSessionInfoStore } from '../../store/sessionInfoStore';
import { useTimingStore } from '../../store/timingStore';
import { useUIStore } from '../../store/uiStore';
import styles from './Header.module.css';

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '\u2014';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function Header() {
  const trackName = useSessionInfoStore((s) => s.trackName);
  const sessionTypeName = useSessionInfoStore((s) => s.sessionTypeName);
  const weatherName = useSessionInfoStore((s) => s.weatherName);
  const trackTemp = useSessionInfoStore((s) => s.trackTemperature);
  const airTemp = useSessionInfoStore((s) => s.airTemperature);
  const sessionTimeLeft = useSessionInfoStore((s) => s.sessionTimeLeft);
  const totalLaps = useSessionInfoStore((s) => s.totalLaps);
  const safetyCarStatus = useSessionInfoStore((s) => s.safetyCarStatus);

  const currentLap = useTimingStore((s) => s.currentLap);
  const playerName = useTimingStore((s) => s.playerName);
  const driverStatus = useTimingStore((s) => s.allLapData?.playerData?.driverStatus ?? null);

  const connectionStatus = useUIStore((s) => s.connectionStatus);
  const isRecording = useUIStore((s) => s.isRecording);
  const recLapCount = useUIStore((s) => s.recLapCount);

  const handleRecToggle = async () => {
    if (isRecording) {
      await fetch('/api/recordings/stop', { method: 'POST' });
    } else {
      await fetch('/api/recordings/start', { method: 'POST' });
    }
  };

  const scBadgeClass =
    safetyCarStatus === 1
      ? styles.scFull
      : safetyCarStatus === 2
        ? styles.scVsc
        : styles.scHidden;

  const scText = safetyCarStatus === 1 ? 'SAFETY CAR' : safetyCarStatus === 2 ? 'VSC' : '';

  const signalClass =
    connectionStatus === 'live'
      ? styles.signalLive
      : connectionStatus === 'waiting'
        ? styles.signalWaiting
        : styles.signalOff;

  const signalText =
    connectionStatus === 'live'
      ? 'LIVE'
      : connectionStatus === 'waiting'
        ? 'WAITING'
        : 'NO SIGNAL';

  const DRIVER_STATUS_MAP: Record<number, { label: string; cls: string }> = {
    0: { label: 'GARAGE', cls: styles.dsGarage },
    1: { label: 'FLYING', cls: styles.dsFlying },
    2: { label: 'IN LAP', cls: styles.dsInLap },
    3: { label: 'OUT LAP', cls: styles.dsOutLap },
    4: { label: 'ON TRACK', cls: styles.dsOnTrack },
  };
  const dsInfo = driverStatus !== null ? DRIVER_STATUS_MAP[driverStatus] : null;

  return (
    <header className={styles.header}>
      <div className={styles.hgroup}>
        <span className={styles.hlabel}>TRACK</span>
        <span className={styles.hvalue}>{trackName || '\u2014'}</span>
      </div>

      <div className={styles.hgroup}>
        <span className={styles.hlabel}>SESSION</span>
        <span className={styles.hvalue}>{sessionTypeName || '\u2014'}</span>
      </div>

      <div className={styles.hgroup}>
        <span className={styles.hlabel}>LAP</span>
        <span className={styles.hvalue}>
          {currentLap || '\u2014'} / {totalLaps || '\u2014'}
        </span>
      </div>

      <div className={styles.hgroup}>
        <span className={styles.hlabel}>TIME LEFT</span>
        <span className={`${styles.hvalue} ${styles.countdownVal}`}>
          {formatCountdown(sessionTimeLeft)}
        </span>
      </div>

      <div className={styles.hgroup}>
        <span className={styles.hlabel}>WEATHER</span>
        <span className={styles.hvalue}>{weatherName || '\u2014'}</span>
      </div>

      <div className={styles.hgroup}>
        <span className={styles.hlabel}>TRACK &deg;C</span>
        <span className={styles.hvalue}>{trackTemp}&deg;C</span>
      </div>

      <div className={styles.hgroup}>
        <span className={styles.hlabel}>AIR &deg;C</span>
        <span className={styles.hvalue}>{airTemp}&deg;C</span>
      </div>

      <div className={styles.hgroup}>
        <span className={styles.hlabel}>DRIVER</span>
        <span className={styles.hvalue}>
          {playerName || '\u2014'}
          {dsInfo && (
            <span className={`${styles.dsBadge} ${dsInfo.cls}`}>
              {dsInfo.label}
            </span>
          )}
        </span>
      </div>

      <span className={scBadgeClass}>{scText}</span>

      <button
        className={`${styles.recBtn} ${isRecording ? styles.recActive : ''}`}
        onClick={handleRecToggle}
      >
        {isRecording ? `\u25CF REC ${recLapCount} laps` : '\u25CB REC'}
      </button>

      <span className={`${styles.signal} ${signalClass}`}>{signalText}</span>
    </header>
  );
}
