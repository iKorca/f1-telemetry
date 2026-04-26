import React, { useMemo, useState } from 'react';
import type { PracticeRun } from '@shared/types';
import UPlotChart, { withSync } from '@/components/common/UPlotChart';
import ChartEmpty from '@/components/common/ChartEmpty';
import type uPlot from 'uplot';
import { usePracticeStore } from '@/store/practiceStore';
import { buildXData, buildYArray, xAxisLabel, percentileRange } from '@/lib/chartAxis';
import { runColor } from '@/lib/chartPalette';
import { fmtLapTimeTick, valLapTime, valTemp } from '@/lib/formatters';
import styles from './PracticeTab.module.css';

interface LapTimeChartProps {
  runs: PracticeRun[];
}

function linearFit(xs: number[], ys: number[]): { slope: number; intercept: number } | null {
  const n = xs.length;
  if (n < 2) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i]; sumY += ys[i];
    sumXY += xs[i] * ys[i]; sumXX += xs[i] * xs[i];
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function LapTimeChart({ runs }: LapTimeChartProps) {
  const [showTrend, setShowTrend] = useState<boolean>(true);
  const [showTemp, setShowTemp] = useState<boolean>(true);
  const xMode = usePracticeStore((s) => s.xAxisMode);
  const includeInvalid = usePracticeStore((s) => s.includeInvalidLaps);
  const palette = usePracticeStore((s) => s.chartPalette);
  const refRunId = usePracticeStore((s) => s.referenceRunId);
  const refLapNum = usePracticeStore((s) => s.referenceLapNum);
  const workbook = usePracticeStore((s) => s.workbook);

  const refValue = useMemo<number | null>(() => {
    if (!refRunId || refLapNum == null) return null;
    const run = workbook?.runs.find((r) => r.id === refRunId);
    const lap = run?.laps?.find((l) => l.lapNum === refLapNum);
    return lap && lap.lapTimeMs > 0 ? lap.lapTimeMs / 1000 : null;
  }, [refRunId, refLapNum, workbook]);

  const { chartData, slopes } = useMemo(() => {
    const runsWithLaps = runs.filter((r) => r.laps && r.laps.length > 0);
    if (runsWithLaps.length === 0) return { chartData: null, slopes: [] };

    const xData = buildXData(runsWithLaps, xMode);
    const series: uPlot.Series[] = [{}];
    const data: uPlot.AlignedData = [xData];
    const allY: number[] = [];
    const slopesOut: { color: string; slopeMsPerLap: number; label: string }[] = [];

    const validFilter = (lap: { valid: boolean; isOutLap?: boolean; isPitLap?: boolean; trafficLap?: boolean }) =>
      includeInvalid || (lap.valid && !lap.isOutLap && !lap.isPitLap && !lap.trafficLap);

    for (let ri = 0; ri < runsWithLaps.length; ri++) {
      const run = runsWithLaps[ri];
      const color = runColor(ri, palette);
      series.push({
        label: run.label || run.compound,
        stroke: color,
        width: 2,
        points: { show: true, size: 4 },
        // Delta-mode values are signed seconds; absolute-mode values are laps.
        value: refValue != null
          ? (_u, v) => (v == null ? '\u2014' : `${v >= 0 ? '+' : ''}${v.toFixed(3)} s`)
          : valLapTime,
      });
      const yArr = buildYArray(run, xData, xMode, (lap) => {
        if (!validFilter(lap) || lap.lapTimeMs <= 0) return null;
        const v = lap.lapTimeMs / 1000;
        const out = refValue != null ? v - refValue : v;
        allY.push(out);
        return +out.toFixed(3);
      });
      data.push(yArr as number[]);

      if (showTrend) {
        const xs: number[] = [];
        const ys: number[] = [];
        run.laps!.forEach((lap, li) => {
          if (!validFilter(lap) || lap.lapTimeMs <= 0) return;
          const x = xMode === 'tyreAge' ? (lap.tyreAge ?? li) : li + 1;
          const v = lap.lapTimeMs / 1000;
          xs.push(x);
          ys.push(refValue != null ? v - refValue : v);
        });
        const fit = linearFit(xs, ys);
        if (fit) {
          const slopeMs = fit.slope * 1000;
          const label = `${run.label || run.compound} trend (${slopeMs >= 0 ? '+' : ''}${slopeMs.toFixed(0)} ms/lap)`;
          series.push({
            label, stroke: color, width: 1, dash: [4, 4],
            points: { show: false }, value: valLapTime,
          });
          const trendY = xData.map((x) => fit.slope * x + fit.intercept);
          data.push(trendY as number[]);
          slopesOut.push({ color, slopeMsPerLap: slopeMs, label: run.label || run.compound });
        }
      }
    }

    if (showTemp) {
      for (let ri = 0; ri < runsWithLaps.length; ri++) {
        const run = runsWithLaps[ri];
        const hasTemp = run.laps!.some((l) => l.trackTemp != null && l.trackTemp > 0);
        if (!hasTemp) continue;
        const color = runColor(ri, palette);
        series.push({
          label: `${run.label || run.compound} track °C`,
          stroke: color, width: 1, dash: [2, 3],
          points: { show: false }, scale: 'temp', value: valTemp,
        });
        const yArr = buildYArray(run, xData, xMode, (lap) =>
          lap.trackTemp != null && lap.trackTemp > 0 ? lap.trackTemp : null,
        );
        data.push(yArr as number[]);
      }
    }

    return {
      chartData: { series, data, allY },
      slopes: slopesOut,
    };
  }, [runs, showTrend, showTemp, xMode, refValue, includeInvalid, palette]);

  if (!chartData || chartData.allY.length === 0) {
    return (
      <div>
        <div className={styles.sectionTitle}>LAP TIME EVOLUTION</div>
        <ChartEmpty
          message="No valid laps yet"
          hint={includeInvalid ? 'Even with invalid laps on, no finished laps in the selected runs.' : 'Toggle "invalid laps" on to include warmup / traffic / out laps'}
        />
      </div>
    );
  }

  const yLabel = refValue != null ? 'Δ Lap Time' : 'Lap Time';
  const options: Partial<uPlot.Options> = {
    series: chartData.series,
    axes: [
      { label: xAxisLabel(xMode) },
      {
        label: yLabel,
        stroke: '#555575',
        grid: { stroke: '#1c1c2e' },
        // In delta mode the axis carries small signed seconds; everywhere
        // else the values are absolute lap times and we want the full
        // m:ss.mmm breakdown.
        values: refValue != null
          ? (_u, ticks) => ticks.map((t) => (t == null ? null : `${t >= 0 ? '+' : ''}${t.toFixed(3)} s`))
          : fmtLapTimeTick,
      },
      { side: 1, scale: 'temp', label: 'Track °C', stroke: '#7a6a3e', grid: { show: false } },
    ],
    scales: {
      x: { time: false },
      y: { range: percentileRange(chartData.allY, { lower: 1, upper: 95, pad: 0.06 }) },
      temp: { auto: true },
    },
    legend: { live: true },
    cursor: { sync: withSync('practice-laps') },
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className={styles.sectionTitle}>
          LAP TIME EVOLUTION
          {refValue != null && (
            <span style={{ color: 'var(--blue)', marginLeft: '0.4rem', fontWeight: 400 }}>(Δ mode)</span>
          )}
        </div>
        <div className={styles.filterGroup} style={{ marginBottom: '0.4rem' }}>
          <button
            className={showTrend ? styles.filterBtnActive : styles.filterBtn}
            onClick={() => setShowTrend((v) => !v)}
            aria-pressed={showTrend}
            title="Toggle linear regression (pace-drop slope) overlay"
          >
            {showTrend ? 'TREND ON' : 'TREND OFF'}
          </button>
          <button
            className={showTemp ? styles.filterBtnActive : styles.filterBtn}
            onClick={() => setShowTemp((v) => !v)}
            aria-pressed={showTemp}
            title="Toggle per-lap track-temperature overlay (dashed secondary axis)"
          >
            {showTemp ? 'TRACK°C ON' : 'TRACK°C OFF'}
          </button>
        </div>
      </div>
      <div className={styles.chartContainer}>
        <UPlotChart options={options} data={chartData.data} height={220} />
      </div>
      {showTrend && slopes.length > 0 && (
        <div style={{
          fontFamily: 'var(--font-d)', fontSize: '0.5rem', color: 'var(--grey)',
          marginTop: '0.3rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap',
        }}>
          {slopes.map((s, i) => (
            <span key={i}>
              <span style={{ color: s.color, fontWeight: 700 }}>{s.label}</span>
              {' — '}
              <span style={{ color: s.slopeMsPerLap > 50 ? 'var(--red)' : s.slopeMsPerLap > 0 ? 'var(--orange)' : 'var(--green)' }}>
                {s.slopeMsPerLap >= 0 ? '+' : ''}{s.slopeMsPerLap.toFixed(0)} ms/lap
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(LapTimeChart);
