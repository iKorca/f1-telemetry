import React, { useMemo } from 'react';
import { useTelemetryStore } from '@/store/telemetryStore';
import { useTimingStore } from '@/store/timingStore';
import { ERS_FULL_ENERGY } from '@/lib/constants';
import styles from './InputBars.module.css';

function InputBars() {
  const throttle = useTelemetryStore((s) => s.throttle);
  const brake = useTelemetryStore((s) => s.brake);
  const allCarStatus = useTimingStore((s) => s.allCarStatus);

  const thrPct = Math.round(throttle * 100);
  const brkPct = Math.round(brake * 100);

  const { ersPct, fuelPct, fuelLow } = useMemo(() => {
    const car = allCarStatus?.playerData;
    if (!car) return { ersPct: 0, fuelPct: 0, fuelLow: false };

    const ers = Math.min(100, (car.ersStoreEnergy / ERS_FULL_ENERGY) * 100);
    const fuel = car.fuelCapacity > 0
      ? Math.min(100, (car.fuelInTank / car.fuelCapacity) * 100)
      : 0;
    const low = (car.fuelRemainingLaps || 0) < 3;

    return { ersPct: ers, fuelPct: fuel, fuelLow: low };
  }, [allCarStatus]);

  return (
    <div className={styles.inputsGrid}>
      {/* Throttle */}
      <div className={styles.inputCol}>
        <span className={styles.inputLabel}>THROTTLE</span>
        <div className={styles.vbarWrap}>
          <div
            className={`${styles.vbar} ${styles.green}`}
            style={{ height: `${thrPct}%` }}
          />
        </div>
        <span className={styles.inputVal}>{thrPct}%</span>
      </div>

      {/* Brake */}
      <div className={styles.inputCol}>
        <span className={styles.inputLabel}>BRAKE</span>
        <div className={styles.vbarWrap}>
          <div
            className={`${styles.vbar} ${styles.red}`}
            style={{ height: `${brkPct}%` }}
          />
        </div>
        <span className={styles.inputVal}>{brkPct}%</span>
      </div>

      {/* ERS */}
      <div className={styles.inputCol}>
        <span className={styles.inputLabel}>ERS</span>
        <div className={styles.vbarWrap}>
          <div
            className={`${styles.vbar} ${styles.blue}`}
            style={{ height: `${Math.round(ersPct)}%` }}
          />
        </div>
        <span className={styles.inputVal}>{Math.round(ersPct)}%</span>
      </div>

      {/* Fuel */}
      <div className={styles.inputCol}>
        <span className={styles.inputLabel}>FUEL</span>
        <div className={styles.vbarWrap}>
          <div
            className={`${styles.vbar} ${fuelLow ? styles.fuelLow : styles.yellow}`}
            style={{ height: `${Math.round(fuelPct)}%` }}
          />
        </div>
        <span className={styles.inputVal}>{Math.round(fuelPct)}%</span>
      </div>
    </div>
  );
}

export default React.memo(InputBars);
