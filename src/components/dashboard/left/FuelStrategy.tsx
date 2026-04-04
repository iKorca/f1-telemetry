import React, { useRef, useMemo } from 'react';
import { useTimingStore } from '@/store/timingStore';
import { useSessionInfoStore } from '@/store/sessionInfoStore';
import styles from './FuelStrategy.module.css';

function FuelStrategy() {
  const allCarStatus = useTimingStore((s) => s.allCarStatus);
  const currentLap = useTimingStore((s) => s.currentLap);
  const totalLaps = useSessionInfoStore((s) => s.totalLaps);

  // Refs for tracking fuel across laps
  const fuelSamplesRef = useRef<number[]>([]);
  const lastFuelInTankRef = useRef<number | null>(null);
  const lastFuelLapRef = useRef<number>(0);

  const playerData = allCarStatus?.playerData;
  const fuelInTank = playerData?.fuelInTank ?? 0;
  const fuelRemainingLaps = playerData?.fuelRemainingLaps ?? 0;

  // Calculate fuel per lap from game data
  if (
    lastFuelInTankRef.current !== null &&
    currentLap > lastFuelLapRef.current &&
    currentLap > 1
  ) {
    const used = lastFuelInTankRef.current - fuelInTank;
    if (used > 0 && used < 10) {
      fuelSamplesRef.current.push(used);
      if (fuelSamplesRef.current.length > 20) {
        fuelSamplesRef.current.shift();
      }
    }
  }
  lastFuelInTankRef.current = fuelInTank;
  lastFuelLapRef.current = currentLap;

  const { perLapText, targetText, deltaText, deltaClass } = useMemo(() => {
    const samples = fuelSamplesRef.current;
    const avgPerLap =
      samples.length > 0
        ? samples.reduce((a, b) => a + b, 0) / samples.length
        : fuelRemainingLaps > 0
          ? fuelInTank / fuelRemainingLaps
          : 0;

    const perLap =
      avgPerLap > 0 ? `Per Lap: ${avgPerLap.toFixed(2)} kg` : 'Per Lap: \u2014';

    let target = '';
    let delta = '';
    let dClass = '';

    if (totalLaps > 0 && avgPerLap > 0) {
      const lapsRemaining = totalLaps - currentLap;
      const fuelNeeded = lapsRemaining * avgPerLap;
      const fuelDelta = fuelInTank - fuelNeeded;

      target = `Need: ${fuelNeeded.toFixed(1)} kg for ${lapsRemaining} laps`;

      if (fuelDelta >= 0) {
        delta = `+${fuelDelta.toFixed(1)} kg surplus`;
        dClass = styles.fuelSurplus;
      } else {
        delta = `${fuelDelta.toFixed(1)} kg SHORT`;
        dClass = styles.fuelDeficit;
      }
    } else {
      target = `Remaining: ~${fuelRemainingLaps.toFixed(1)} laps`;
      delta = '';
      dClass = '';
    }

    return {
      perLapText: perLap,
      targetText: target,
      deltaText: delta,
      deltaClass: dClass,
    };
  }, [fuelInTank, fuelRemainingLaps, totalLaps, currentLap]);

  return (
    <div className={styles.section}>
      <span className="section-label">FUEL STRATEGY</span>
      <div className={styles.fuelStat}>{perLapText}</div>
      <div className={styles.fuelStat}>{targetText}</div>
      {deltaText && (
        <div className={`${styles.fuelStat} ${styles.fuelDelta} ${deltaClass}`}>
          {deltaText}
        </div>
      )}
    </div>
  );
}

export default React.memo(FuelStrategy);
