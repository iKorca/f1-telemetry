import React from 'react';
import type { PracticeRun } from '@shared/types';
import { fmtTime } from '@/lib/formatters';
import { tyreTempStatus, tempStatusColor, getTempWindow } from '@/lib/tyreTemps';
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

const WHEEL_LABELS = ['RL', 'RR', 'FL', 'FR'];

/** Sum of best-S1 + best-S2 + best-S3 (sectors may come from different laps). */
function theoreticalBest(r: PracticeRun): number {
  if (r.bestS1Ms > 0 && r.bestS2Ms > 0 && r.bestS3Ms > 0) {
    return r.bestS1Ms + r.bestS2Ms + r.bestS3Ms;
  }
  return 0;
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
    // Theoretical best: sum of best S1 + best S2 + best S3 (may come from
    // different laps). Subtracting this from the actual best lap tells the
    // driver how much pace is still on the table.
    label: 'Theoretical Best',
    getValue: (r) => {
      const synth = theoreticalBest(r);
      if (synth <= 0) return '\u2014';
      const delta = r.bestLapMs > 0 ? synth - r.bestLapMs : 0;
      const deltaTxt = delta < 0 ? ` (\u2212${(Math.abs(delta) / 1000).toFixed(3)}s)` : '';
      return `${fmtTime(synth)}${deltaTxt}`;
    },
    getBest: (runs) =>
      Math.min(
        ...runs.map(theoreticalBest).filter((v) => v > 0),
      ),
    getRaw: (r) => theoreticalBest(r),
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
  {
    label: 'Avg Fuel/Lap',
    getValue: (r) => (r.avgFuelPerLap > 0 ? `${r.avgFuelPerLap.toFixed(2)} kg` : '\u2014'),
    getBest: (runs) => Math.min(...runs.filter((r) => r.avgFuelPerLap > 0).map((r) => r.avgFuelPerLap)),
    getRaw: (r) => r.avgFuelPerLap,
    lowerIsBetter: true,
  },
  {
    label: 'Max Fuel/Lap',
    getValue: (r) => (r.maxFuelPerLap > 0 ? `${r.maxFuelPerLap.toFixed(2)} kg` : '\u2014'),
    getBest: (runs) => Math.min(...runs.filter((r) => r.maxFuelPerLap > 0).map((r) => r.maxFuelPerLap)),
    getRaw: (r) => r.maxFuelPerLap,
    lowerIsBetter: true,
  },
  {
    label: 'Avg Degradation',
    getValue: (r) => (r.avgDegradationMs !== 0 ? `${(r.avgDegradationMs / 1000).toFixed(3)}s` : '\u2014'),
    getBest: (runs) => Math.min(...runs.filter((r) => r.avgDegradationMs > 0).map((r) => r.avgDegradationMs)),
    getRaw: (r) => r.avgDegradationMs,
    lowerIsBetter: true,
  },
  {
    label: 'Avg Tyre Wear',
    getValue: (r) => (r.avgTyreWear > 0 ? `${r.avgTyreWear.toFixed(1)}%` : '\u2014'),
    getBest: (runs) => Math.min(...runs.filter((r) => r.avgTyreWear > 0).map((r) => r.avgTyreWear)),
    getRaw: (r) => r.avgTyreWear,
    lowerIsBetter: true,
  },
  {
    label: 'Max Tyre Wear',
    getValue: (r) => (r.maxTyreWear > 0 ? `${r.maxTyreWear.toFixed(1)}%` : '\u2014'),
    getBest: (runs) => Math.min(...runs.filter((r) => r.maxTyreWear > 0).map((r) => r.maxTyreWear)),
    getRaw: (r) => r.maxTyreWear,
    lowerIsBetter: true,
  },
  {
    label: 'Avg Engine Temp',
    getValue: (r) => (r.avgEngineTemp > 0 ? `${r.avgEngineTemp}\u00B0C` : '\u2014'),
    getBest: (runs) => Math.min(...runs.filter((r) => r.avgEngineTemp > 0).map((r) => r.avgEngineTemp)),
    getRaw: (r) => r.avgEngineTemp,
    lowerIsBetter: true,
  },
  {
    label: 'Max Engine Temp',
    getValue: (r) => (r.maxEngineTemp > 0 ? `${r.maxEngineTemp}\u00B0C` : '\u2014'),
    getBest: (runs) => Math.min(...runs.filter((r) => r.maxEngineTemp > 0).map((r) => r.maxEngineTemp)),
    getRaw: (r) => r.maxEngineTemp,
    lowerIsBetter: true,
  },
];

function fmtWheelArr(arr: [number, number, number, number]): string {
  if (!arr || arr.every((v) => v === 0)) return '\u2014';
  return arr.map((v) => v.toFixed(1)).join(' / ');
}

// Per-wheel metric sections (tyre wear, surface temp, inner temp)
interface WheelSection {
  title: string;
  getValues: (r: PracticeRun) => [number, number, number, number];
  suffix: string;
  lowerIsBetter: boolean;
  // When set, cell values are classified against the compound's optimal
  // inner-temperature window and tinted accordingly.
  compoundWindow?: boolean;
}

const WHEEL_SECTIONS: WheelSection[] = [
  {
    title: 'Tyre Wear (end)',
    getValues: (r) => r.tyreWearEnd || [0, 0, 0, 0],
    suffix: '%',
    lowerIsBetter: true,
  },
  {
    title: 'Avg Surface Temp',
    getValues: (r) => r.avgTyreSurfaceTemp || [0, 0, 0, 0],
    suffix: '\u00B0C',
    lowerIsBetter: true,
  },
  {
    title: 'Max Surface Temp',
    getValues: (r) => r.maxTyreSurfaceTemp || [0, 0, 0, 0],
    suffix: '\u00B0C',
    lowerIsBetter: true,
  },
  {
    title: 'Avg Inner Temp',
    getValues: (r) => r.avgTyreInnerTemp || [0, 0, 0, 0],
    suffix: '\u00B0C',
    lowerIsBetter: true,
    compoundWindow: true,
  },
  {
    title: 'Max Inner Temp',
    getValues: (r) => r.maxTyreInnerTemp || [0, 0, 0, 0],
    suffix: '\u00B0C',
    lowerIsBetter: true,
    compoundWindow: true,
  },
];

export default function StintComparison({ runs }: StintComparisonProps) {
  const gridCols = `140px repeat(${runs.length}, minmax(100px, 1fr))`;
  const hasWheelData = runs.some((r) =>
    (r.tyreWearEnd && r.tyreWearEnd.some((v) => v > 0)) ||
    (r.avgTyreSurfaceTemp && r.avgTyreSurfaceTemp.some((v) => v > 0)),
  );

  return (
    <div>
      <div className={styles.sectionTitle}>STINT COMPARISON</div>
      <div
        className={styles.comparisonGrid}
        style={{ gridTemplateColumns: gridCols }}
      >
        {/* Header row */}
        <div className={styles.comparisonLabel}>Metric</div>
        {runs.map((r) => (
          <div key={r.id} className={styles.comparisonLabel} style={{ textAlign: 'center' }}>
            {r.label || r.compound}
          </div>
        ))}

        {/* Standard metrics */}
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

      {/* Per-wheel data sections */}
      {hasWheelData && (
        <>
          {WHEEL_SECTIONS.map((section) => {
            const hasData = runs.some((r) => {
              const vals = section.getValues(r);
              return vals && vals.some((v) => v > 0);
            });
            if (!hasData) return null;

            return (
              <div key={section.title} style={{ marginTop: '0.6rem' }}>
                <div className={styles.sectionTitle}>{section.title.toUpperCase()}</div>
                <div
                  className={styles.comparisonGrid}
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <div className={styles.comparisonLabel}>Wheel</div>
                  {runs.map((r) => (
                    <div key={r.id} className={styles.comparisonLabel} style={{ textAlign: 'center' }}>
                      {r.label || r.compound}
                    </div>
                  ))}

                  {WHEEL_LABELS.map((wl, wi) => {
                    const values = runs.map((r) => section.getValues(r)[wi]);
                    const validVals = values.filter((v) => v > 0);
                    const best = validVals.length > 0
                      ? (section.lowerIsBetter ? Math.min(...validVals) : Math.max(...validVals))
                      : 0;

                    return (
                      <React.Fragment key={wl}>
                        <div className={styles.comparisonLabel}>{wl}</div>
                        {runs.map((r, ri) => {
                          const val = values[ri];
                          const isBest = val > 0 && isFinite(best) &&
                            (section.lowerIsBetter ? val <= best : val >= best);
                          const status = section.compoundWindow
                            ? tyreTempStatus(val, r.compound)
                            : 'unknown';
                          const tint = status !== 'unknown' && status !== 'optimal'
                            ? tempStatusColor(status)
                            : undefined;
                          const win = section.compoundWindow ? getTempWindow(r.compound) : null;
                          const title = win
                            ? `Optimal ${win.min}–${win.max}°C (target ${win.optimal}°C)`
                            : undefined;
                          return (
                            <div
                              key={r.id}
                              className={`${styles.comparisonValue} ${isBest ? styles.comparisonBest : ''}`}
                              style={tint ? { color: tint } : undefined}
                              title={title}
                            >
                              {val > 0 ? `${val.toFixed(1)}${section.suffix}` : '\u2014'}
                              {section.compoundWindow && status === 'cold' && ' ↓'}
                              {section.compoundWindow && status === 'hot' && ' ↑'}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
