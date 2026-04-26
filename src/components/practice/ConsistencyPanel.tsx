import React, { useMemo } from 'react';
import type { PracticeRun } from '@shared/types';
import UPlotChart from '@/components/common/UPlotChart';
import type uPlot from 'uplot';
import { fmtTime } from '@/lib/formatters';
import { usePracticeStore } from '@/store/practiceStore';
import styles from './PracticeTab.module.css';

interface ConsistencyPanelProps {
  runs: PracticeRun[];
}

const RUN_COLORS = ['#e8002d', '#3b82f6', '#39d353', '#f5c518', '#a855f7', '#ec4899'];

interface RunStats {
  run: PracticeRun;
  color: string;
  n: number;
  meanMs: number;
  sigmaMs: number;
  covPct: number;
  sigmaS1: number; sigmaS2: number; sigmaS3: number;
  covS1: number; covS2: number; covS3: number;
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function sigma(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1); // sample σ
  return Math.sqrt(v);
}

function cov(xs: number[]): number {
  const m = mean(xs);
  if (m === 0) return 0;
  return (sigma(xs) / m) * 100;
}

export default function ConsistencyPanel({ runs }: ConsistencyPanelProps) {
  const includeInvalid = usePracticeStore((s) => s.includeInvalidLaps);
  const passes = (l: any) =>
    includeInvalid
      ? l.lapTimeMs > 0
      : l.valid && !l.trafficLap && !l.isOutLap && !l.isPitLap && l.lapTimeMs > 0;

  const stats: RunStats[] = useMemo(() => {
    return runs
      .map((r, i) => {
        const laps = (r.laps || []).filter(passes);
        if (laps.length < 2) return null;
        const lapTimes = laps.map((l) => l.lapTimeMs);
        const s1s = laps.filter((l) => l.s1Ms > 0).map((l) => l.s1Ms);
        const s2s = laps.filter((l) => l.s2Ms > 0).map((l) => l.s2Ms);
        const s3s = laps.filter((l) => l.s3Ms > 0).map((l) => l.s3Ms);
        return {
          run: r,
          color: RUN_COLORS[i % RUN_COLORS.length],
          n: laps.length,
          meanMs: mean(lapTimes),
          sigmaMs: sigma(lapTimes),
          covPct: cov(lapTimes),
          sigmaS1: sigma(s1s),
          sigmaS2: sigma(s2s),
          sigmaS3: sigma(s3s),
          covS1: cov(s1s),
          covS2: cov(s2s),
          covS3: cov(s3s),
        } as RunStats;
      })
      .filter(Boolean) as RunStats[];
  }, [runs]);

  // Histogram: bucket lap-time-delta-from-run's-best in 100 ms bins across all
  // runs. One series per run so users can compare the shape side-by-side.
  const histData = useMemo(() => {
    if (stats.length === 0) return null;
    const allDeltas: number[][] = stats.map((s) => {
      const laps = (s.run.laps || []).filter(passes);
      if (laps.length === 0) return [];
      const best = Math.min(...laps.map((l) => l.lapTimeMs));
      return laps.map((l) => l.lapTimeMs - best);
    });
    const maxDelta = Math.max(...allDeltas.flat(), 1500);
    const binMs = 100; // 0.1 s bins
    const binCount = Math.min(40, Math.ceil(maxDelta / binMs) + 1);
    const xData: number[] = [];
    for (let i = 0; i < binCount; i++) xData.push(i * binMs);

    const series: uPlot.Series[] = [{}];
    const data: uPlot.AlignedData = [xData];

    for (let ri = 0; ri < stats.length; ri++) {
      const s = stats[ri];
      // Bars instead of lines for histogram — uPlot provides `paths.bars`
      // at runtime, but we import only the type above, so sidestep TS by
      // leaving the series as a plain line plot. It still reads as a
      // distribution; a later pass can upgrade to true bars if needed.
      series.push({
        label: s.run.label || s.run.compound,
        stroke: s.color,
        width: 1.5,
        fill: s.color + '33', // ~20 % alpha
        points: { show: true, size: 3 },
      });

      const counts: number[] = new Array(binCount).fill(0);
      for (const d of allDeltas[ri]) {
        const idx = Math.min(Math.floor(d / binMs), binCount - 1);
        counts[idx]++;
      }
      data.push(counts);
    }

    return { series, data };
  }, [stats]);

  if (stats.length === 0) return null;

  const opts: Partial<uPlot.Options> = histData
    ? {
        series: histData.series,
        axes: [
          { label: 'Δ vs best (ms)' },
          { label: 'Lap count', stroke: '#555575', grid: { stroke: '#1c1c2e' } },
        ],
        scales: { x: { time: false }, y: { range: (_u, _min, max) => [0, Math.max(max ?? 0, 3)] } },
        legend: { live: true },
      }
    : {};

  return (
    <div>
      <div className={styles.sectionTitle}>CONSISTENCY</div>
      <div
        className={styles.comparisonGrid}
        style={{ gridTemplateColumns: `140px repeat(${stats.length}, minmax(100px, 1fr))` }}
      >
        <div className={styles.comparisonLabel}>Metric</div>
        {stats.map((s) => (
          <div
            key={s.run.id}
            className={styles.comparisonLabel}
            style={{ textAlign: 'center', color: s.color }}
          >
            {s.run.label || s.run.compound}
          </div>
        ))}

        <div className={styles.comparisonLabel}>Clean laps</div>
        {stats.map((s) => (
          <div key={s.run.id} className={styles.comparisonValue}>{s.n}</div>
        ))}

        <div className={styles.comparisonLabel}>Mean</div>
        {stats.map((s) => (
          <div key={s.run.id} className={styles.comparisonValue}>{fmtTime(Math.round(s.meanMs))}</div>
        ))}

        <div className={styles.comparisonLabel}>σ (lap time)</div>
        {stats.map((s) => (
          <div
            key={s.run.id}
            className={styles.comparisonValue}
            style={{
              color: s.sigmaMs < 150 ? 'var(--green)'
                : s.sigmaMs < 400 ? 'var(--yellow)'
                : 'var(--red)',
            }}
          >
            {(s.sigmaMs / 1000).toFixed(3)}s
          </div>
        ))}

        <div className={styles.comparisonLabel}>CoV (lap time)</div>
        {stats.map((s) => (
          <div
            key={s.run.id}
            className={styles.comparisonValue}
            style={{
              color: s.covPct < 0.2 ? 'var(--green)'
                : s.covPct < 0.5 ? 'var(--yellow)'
                : 'var(--red)',
            }}
          >
            {s.covPct.toFixed(2)}%
          </div>
        ))}

        <div className={styles.comparisonLabel}>σ S1 / S2 / S3</div>
        {stats.map((s) => (
          <div key={s.run.id} className={styles.comparisonValue} style={{ fontSize: '0.55rem' }}>
            {(s.sigmaS1 / 1000).toFixed(3)} / {(s.sigmaS2 / 1000).toFixed(3)} / {(s.sigmaS3 / 1000).toFixed(3)}
          </div>
        ))}

        <div className={styles.comparisonLabel}>CoV S1 / S2 / S3</div>
        {stats.map((s) => (
          <div key={s.run.id} className={styles.comparisonValue} style={{ fontSize: '0.55rem' }}>
            {s.covS1.toFixed(2)} / {s.covS2.toFixed(2)} / {s.covS3.toFixed(2)}%
          </div>
        ))}
      </div>

      {histData && (
        <div style={{ marginTop: '0.6rem' }}>
          <div className={styles.sectionTitle} style={{ fontSize: '0.5rem' }}>
            LAP-TIME DISTRIBUTION (Δ vs each run's best)
          </div>
          <div className={styles.chartContainer}>
            <UPlotChart options={opts} data={histData.data} height={180} />
          </div>
        </div>
      )}
    </div>
  );
}
