import React, { useMemo } from 'react';
import type { RaceEngineerData } from '@shared/types';
import styles from './PitPredictor.module.css';

interface PitPredictorProps {
  raceState: RaceEngineerData;
  playerCarIndex: number;
}

function PitPredictor({ raceState, playerCarIndex }: PitPredictorProps) {
  const result = useMemo(() => {
    if (playerCarIndex < 0) return null;
    const car = raceState.cars[playerCarIndex];
    if (!car || !car.currentCompound || car.lapTimes.length < 3) return null;

    const age = car.tyreAge || 0;
    const lapTimes = car.lapTimes;
    const recent = lapTimes.slice(-5);

    // Estimate degradation: compare first 3 laps on stint vs last 3
    const first3 = lapTimes.slice(0, Math.min(3, lapTimes.length));
    const last3 = recent.slice(-3);
    const avgFirst = first3.reduce((a, b) => a + b, 0) / first3.length;
    const avgLast = last3.reduce((a, b) => a + b, 0) / last3.length;
    const degPerLap = lapTimes.length > 3
      ? (avgLast - avgFirst) / (lapTimes.length - 3)
      : 0;

    // Pit loss estimate (~22s)
    const pitLoss = 22000;
    // Crossover: when cumulative deg loss > pit loss
    let crossoverLap = '\u2014';
    if (degPerLap > 0) {
      const lapsToBreakeven = Math.ceil(Math.sqrt(2 * pitLoss / degPerLap));
      crossoverLap = `Lap ${car.currentLap + lapsToBreakeven}`;
    }

    // Undercut/overcut windows
    const strategyHints: Array<{ text: string }> = [];
    const carAhead = raceState.cars.find((c) => c.position === car.position - 1);
    const carBehind = raceState.cars.find((c) => c.position === car.position + 1);

    if (carAhead && carAhead.gapToLeaderMs > 0) {
      const gapAhead = car.gapToAheadMs;
      if (gapAhead > 0 && gapAhead < pitLoss) {
        strategyHints.push({
          text: `Undercut ${carAhead.name}: gap ${(gapAhead / 1000).toFixed(1)}s`,
        });
      }
    }
    if (carBehind) {
      const gapBehind = carBehind.gapToAheadMs || 0;
      if (gapBehind > 0 && gapBehind < pitLoss) {
        strategyHints.push({
          text: `Watch ${carBehind.name}: ${(gapBehind / 1000).toFixed(1)}s behind`,
        });
      }
    }

    const degRate = degPerLap > 0
      ? '+' + (degPerLap / 1000).toFixed(3) + 's/lap'
      : 'stable';
    const tyreOk = degPerLap < 50;

    return {
      compound: car.currentCompound,
      age,
      degRate,
      tyreOk,
      crossoverLap,
      pitLoss,
      numPitStops: car.numPitStops,
      strategyHints,
    };
  }, [raceState, playerCarIndex]);

  if (!result) return null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.label}>Pit Strategy Predictor</div>
      <div className={styles.content}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Tyre Status</div>
          <div className={`${styles.cardValue} ${result.tyreOk ? styles.pitOk : styles.pitNow}`}>
            {result.compound} &middot; {result.age} laps
          </div>
          <div className={styles.cardDetail}>Degradation: {result.degRate}</div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Optimal Pit Window</div>
          <div className={styles.cardValue}>{result.crossoverLap}</div>
          <div className={styles.cardDetail}>
            Pit loss: ~{(result.pitLoss / 1000).toFixed(0)}s
          </div>
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Strategy</div>
          <div className={styles.cardValue}>
            {result.numPitStops} stop{result.numPitStops !== 1 ? 's' : ''}
          </div>
          {result.strategyHints.map((hint, i) => (
            <div key={i} className={styles.cardDetail}>{hint.text}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default React.memo(PitPredictor);
