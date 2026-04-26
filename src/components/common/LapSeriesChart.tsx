import React, { useMemo, useState } from 'react';
import type { PracticeRun, PracticeRunLap } from '@shared/types';
import type uPlot from 'uplot';
import UPlotChart, { withSync } from '@/components/common/UPlotChart';
import ChartEmpty from '@/components/common/ChartEmpty';
import { buildXData, buildYArray, xAxisLabel, percentileRange } from '@/lib/chartAxis';
import { runColor, WHEEL_LABELS, WHEEL_COLORS, avgWheels } from '@/lib/chartPalette';
import { usePracticeStore } from '@/store/practiceStore';
import styles from '@/components/practice/PracticeTab.module.css';

export type YGetter = (lap: PracticeRunLap, index: number) => number | null;
export type WheelGetter = (lap: PracticeRunLap) => number[] | undefined;

export interface LapSeriesChartProps {
  title: string;
  runs: PracticeRun[];
  /** Per-lap scalar Y value (avg across wheels if applicable). Required. */
  getY: YGetter;
  /** Optional per-wheel getter — enables the "PER WHEEL" sub-mode. */
  getWheelY?: WheelGetter;
  yLabel: string;
  yDeltaLabel?: string;
  valueFormatter?: (u: unknown, v: number | null) => string;
  axisTickFormatter?: (u: unknown, ticks: number[]) => Array<string | null>;
  /** Extract a single scalar for the reference lap (used in Δ mode). */
  refValueOfLap?: (lap: PracticeRunLap) => number | null;
  /** uPlot cursor sync key; matching charts share hover + zoom. */
  syncKey?: string;
  /** Clamp Y at 95th percentile so outliers don't compress the plot. */
  percentileClamp?: boolean;
  /** Floor the Y axis at zero (for counts / wear / fuel). */
  floorZero?: boolean;
  height?: number;
  /** Render trailing annotation / legend under the chart. */
  renderLegend?: React.ReactNode;
}

/**
 * Shared per-lap line chart. Consumes a `getY` that maps each lap to a number
 * and (optionally) a `getWheelY` for the per-wheel view. Six existing charts
 * (LapTime / Fuel / TyreWear / BrakeTemp / TyrePressure / ERS-battery) can
 * funnel through this primitive instead of re-declaring boilerplate.
 *
 * Supports: X-axis mode (stint lap / tyre age), Δ-vs-ref mode, per-wheel vs
 * average toggle, cursor sync, outlier-safe Y range, and invalid-lap include.
 */
function LapSeriesChart({
  title,
  runs,
  getY,
  getWheelY,
  yLabel,
  yDeltaLabel,
  valueFormatter,
  axisTickFormatter,
  refValueOfLap,
  syncKey,
  percentileClamp = true,
  floorZero = false,
  height = 220,
  renderLegend,
}: LapSeriesChartProps) {
  const xMode = usePracticeStore((s) => s.xAxisMode);
  const includeInvalid = usePracticeStore((s) => s.includeInvalidLaps);
  const palette = usePracticeStore((s) => s.chartPalette);
  const refRunId = usePracticeStore((s) => s.referenceRunId);
  const refLapNum = usePracticeStore((s) => s.referenceLapNum);
  const workbook = usePracticeStore((s) => s.workbook);

  const [mode, setMode] = useState<'avg' | 'perWheel'>('avg');

  const refValue = useMemo<number | null>(() => {
    if (!refRunId || refLapNum == null || !refValueOfLap) return null;
    const run = workbook?.runs.find((r) => r.id === refRunId);
    const lap = run?.laps?.find((l) => l.lapNum === refLapNum);
    return lap ? refValueOfLap(lap) : null;
  }, [refRunId, refLapNum, workbook, refValueOfLap]);

  const chartData = useMemo(() => {
    // Respect global "include invalid" toggle — invalid/out/pit/traffic laps
    // stay in the runs list but their Y value is dropped unless the user
    // opted in.
    const passesValidity = (lap: PracticeRunLap) =>
      includeInvalid || (lap.valid && !lap.isOutLap && !lap.isPitLap && !lap.trafficLap);

    const runsWithData = runs.filter(
      (r) => r.laps && r.laps.some((lap) => {
        if (!passesValidity(lap)) return false;
        return getY(lap, 0) != null;
      }),
    );
    if (runsWithData.length === 0) return null;

    const xData = buildXData(runsWithData, xMode);
    if (xData.length < 1) return null;

    const series: uPlot.Series[] = [{}];
    const data: uPlot.AlignedData = [xData];
    const allYValues: number[] = [];

    const wheelMode = mode === 'perWheel' && runsWithData.length === 1 && getWheelY;

    if (wheelMode) {
      const run = runsWithData[0];
      for (let w = 0; w < 4; w++) {
        series.push({
          label: WHEEL_LABELS[w],
          stroke: WHEEL_COLORS[w],
          width: 2,
          points: { show: true, size: 4 },
          value: valueFormatter,
        });
        const yArr = buildYArray(run, xData, xMode, (lap) => {
          if (!passesValidity(lap)) return null;
          const arr = getWheelY!(lap);
          const v = arr?.[w];
          if (v == null || v <= 0) return null;
          allYValues.push(v);
          return +v.toFixed(2);
        });
        data.push(yArr as number[]);
      }
    } else {
      for (let ri = 0; ri < runsWithData.length; ri++) {
        const run = runsWithData[ri];
        series.push({
          label: run.label || run.compound,
          stroke: runColor(ri, palette),
          width: 2,
          points: { show: true, size: 4 },
          value: valueFormatter,
        });
        const yArr = buildYArray(run, xData, xMode, (lap, li) => {
          if (!passesValidity(lap)) return null;
          const v = getY(lap, li);
          if (v == null) return null;
          const out = refValue != null ? v - refValue : v;
          allYValues.push(out);
          return +out.toFixed(3);
        });
        data.push(yArr as number[]);
      }
    }

    return { series, data, allYValues };
  }, [runs, mode, xMode, refValue, includeInvalid, palette, getY, getWheelY, valueFormatter]);

  if (!chartData) {
    return (
      <div>
        <div className={styles.sectionTitle}>{title}</div>
        <ChartEmpty
          message="No valid laps yet"
          hint={includeInvalid ? undefined : 'Toggle "invalid laps" on to include warmup / traffic / out laps'}
        />
      </div>
    );
  }

  const singleRun = runs.filter((r) => r.laps && r.laps.length > 0).length === 1;

  const effectiveYLabel = refValue != null && yDeltaLabel ? yDeltaLabel : yLabel;

  const options: Partial<uPlot.Options> = {
    series: chartData.series,
    axes: [
      { label: xAxisLabel(xMode) },
      {
        label: effectiveYLabel,
        stroke: '#555575',
        grid: { stroke: '#1c1c2e' },
        ...(axisTickFormatter ? { values: axisTickFormatter } : {}),
      },
    ],
    scales: {
      x: { time: false },
      y: percentileClamp
        ? { range: percentileRange(chartData.allYValues, { floorZero: floorZero && refValue == null }) }
        : (floorZero && refValue == null
            ? { range: (_u, _min, max) => [0, Math.max(max ?? 0, 1)] as [number, number] }
            : { auto: true }),
    },
    legend: { live: true },
    cursor: syncKey ? { sync: withSync(syncKey) } : undefined,
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className={styles.sectionTitle}>
          {title}
          {refValue != null && (
            <span style={{ color: 'var(--blue)', marginLeft: '0.4rem', fontWeight: 400 }}>(Δ mode)</span>
          )}
        </div>
        {getWheelY && singleRun && (
          <div className={styles.filterGroup} style={{ marginBottom: '0.4rem' }}>
            <button className={mode === 'avg' ? styles.filterBtnActive : styles.filterBtn} onClick={() => setMode('avg')}>AVG</button>
            <button className={mode === 'perWheel' ? styles.filterBtnActive : styles.filterBtn} onClick={() => setMode('perWheel')}>PER WHEEL</button>
          </div>
        )}
      </div>
      <div className={styles.chartContainer} data-updating={false}>
        <UPlotChart options={options} data={chartData.data} height={height} />
      </div>
      {renderLegend}
    </div>
  );
}

// Re-export for convenience
export { avgWheels };
export default React.memo(LapSeriesChart);
