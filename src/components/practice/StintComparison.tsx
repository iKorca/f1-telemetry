import React from 'react';
import type { PracticeRun } from '@shared/types';
import { fmtTime } from '@/lib/formatters';
import styles from './PracticeTab.module.css';

interface StintComparisonProps {
  runs: PracticeRun[];
}

interface MetricRow {
  label: string;
  getValue: (r: PracticeRun) => string;
  getBest: (runs: PracticeRun[]) => number;
  getRaw: (r: PracticeRun) => number;
  lowerIsBetter?: boolean;
}

const METRICS: MetricRow[] = [
  {
    label: 'Best Lap',
    getValue: (r) => (r.bestLapMs > 0 ? fmtTime(r.bestLapMs) : '\u2014'),
    getBest: (runs) => Math.min(...runs.filter((r) => r.bestLapMs > 0).map((r) => r.bestLapMs)),
    getRaw: (r) => r.bestLapMs,
    lowerIsBetter: true,
  },
  {
    label: 'Avg Lap',
    getValue: (r) => (r.avgLapMs > 0 ? fmtTime(r.avgLapMs) : '\u2014'),
    getBest: (runs) => Math.min(...runs.filter((r) => r.avgLapMs > 0).map((r) => r.avgLapMs)),
    getRaw: (r) => r.avgLapMs,
    lowerIsBetter: true,
  },
  {
    label: 'Best S1',
    getValue: (r) => (r.bestS1Ms > 0 ? fmtTime(r.bestS1Ms) : '\u2014'),
    getBest: (runs) => Math.min(...runs.filter((r) => r.bestS1Ms > 0).map((r) => r.bestS1Ms)),
    getRaw: (r) => r.bestS1Ms,
    lowerIsBetter: true,
  },
  {
    label: 'Best S2',
    getValue: (r) => (r.bestS2Ms > 0 ? fmtTime(r.bestS2Ms) : '\u2014'),
    getBest: (runs) => Math.min(...runs.filter((r) => r.bestS2Ms > 0).map((r) => r.bestS2Ms)),
    getRaw: (r) => r.bestS2Ms,
    lowerIsBetter: true,
  },
  {
    label: 'Best S3',
    getValue: (r) => (r.bestS3Ms > 0 ? fmtTime(r.bestS3Ms) : '\u2014'),
    getBest: (runs) => Math.min(...runs.filter((r) => r.bestS3Ms > 0).map((r) => r.bestS3Ms)),
    getRaw: (r) => r.bestS3Ms,
    lowerIsBetter: true,
  },
  {
    label: 'Max Speed',
    getValue: (r) => (r.maxSpeed > 0 ? `${r.maxSpeed} km/h` : '\u2014'),
    getBest: (runs) => Math.max(...runs.filter((r) => r.maxSpeed > 0).map((r) => r.maxSpeed)),
    getRaw: (r) => r.maxSpeed,
    lowerIsBetter: false,
  },
  {
    label: 'Consistency',
    getValue: (r) => (r.consistency > 0 ? `${r.consistency}%` : '\u2014'),
    getBest: (runs) => Math.max(...runs.filter((r) => r.consistency > 0).map((r) => r.consistency)),
    getRaw: (r) => r.consistency,
    lowerIsBetter: false,
  },
  {
    label: 'Valid Laps',
    getValue: (r) => `${r.validLapCount}/${r.lapCount}`,
    getBest: (runs) => Math.max(...runs.map((r) => r.validLapCount)),
    getRaw: (r) => r.validLapCount,
    lowerIsBetter: false,
  },
];

export default function StintComparison({ runs }: StintComparisonProps) {
  return (
    <div>
      <div className={styles.sectionTitle}>STINT COMPARISON</div>
      <div
        className={styles.comparisonGrid}
        style={{ gridTemplateColumns: `140px repeat(${runs.length}, minmax(120px, 1fr))` }}
      >
        {/* Header row */}
        <div className={styles.comparisonLabel}>Metric</div>
        {runs.map((r) => (
          <div key={r.id} className={styles.comparisonLabel} style={{ textAlign: 'center' }}>
            {r.label || r.compound}
          </div>
        ))}

        {/* Data rows */}
        {METRICS.map((metric) => {
          const best = metric.getBest(runs);
          return (
            <React.Fragment key={metric.label}>
              <div className={styles.comparisonLabel}>{metric.label}</div>
              {runs.map((r) => {
                const raw = metric.getRaw(r);
                const isBest =
                  raw > 0 &&
                  isFinite(best) &&
                  (metric.lowerIsBetter ? raw <= best : raw >= best);
                return (
                  <div
                    key={r.id}
                    className={`${styles.comparisonValue} ${isBest ? styles.comparisonBest : ''}`}
                  >
                    {metric.getValue(r)}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
