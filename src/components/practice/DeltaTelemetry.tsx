import React, { useMemo } from 'react';
import type { PracticeRun } from '@shared/types';
import UPlotChart from '@/components/common/UPlotChart';
import type uPlot from 'uplot';
import { usePracticeStore } from '@/store/practiceStore';
import { useLapFrames } from '@/hooks/useLapFrames';
import styles from './PracticeTab.module.css';

interface DeltaTelemetryProps {
  runs: PracticeRun[];
}

const REF_COLOR = '#3b82f6';   // blue  — reference lap
const CMP_COLOR = '#f59e0b';   // orange — compare lap
const DELTA_COLOR = '#a855f7'; // purple — Δt bar

/**
 * Resample a sparse (pLap, value) pair array onto a uniform grid.
 * Assumes `pts` is roughly sorted by pLap (frames are recorded in time
 * order, so pLap mostly increases modulo the lap wrap).
 */
function resample(
  pts: { x: number; y: number }[],
  grid: number[],
): (number | null)[] {
  if (pts.length === 0) return grid.map(() => null);
  // Sort defensively (flashbacks, sampling jitter can reorder slightly).
  const sorted = [...pts].sort((a, b) => a.x - b.x);
  const out: (number | null)[] = [];
  let j = 0;
  for (const gx of grid) {
    while (j < sorted.length - 1 && sorted[j + 1].x < gx) j++;
    const a = sorted[j];
    const b = sorted[j + 1];
    if (!a) { out.push(null); continue; }
    if (!b || b.x === a.x) { out.push(a.y); continue; }
    const t = (gx - a.x) / (b.x - a.x);
    if (t < 0 || t > 1.1) { out.push(a.y); continue; }
    out.push(a.y + t * (b.y - a.y));
  }
  return out;
}

/** Build {x,y} arrays from frames for one field. Skips null/zero frames. */
function framePairs(frames: any[], key: string, filter?: (f: any) => boolean): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const f of frames) {
    if (filter && !filter(f)) continue;
    const x = f.pLap;
    const y = f[key];
    if (x == null || y == null) continue;
    out.push({ x, y });
  }
  return out;
}

function DeltaTelemetry({ runs }: DeltaTelemetryProps) {
  const refRunId = usePracticeStore((s) => s.referenceRunId);
  const refLapNum = usePracticeStore((s) => s.referenceLapNum);
  const cmpRunId = usePracticeStore((s) => s.comparisonRunId);
  const cmpLapNum = usePracticeStore((s) => s.comparisonLapNum);

  const refTarget = useMemo(() => {
    if (!refRunId || refLapNum == null) return null;
    const run = runs.find((r) => r.id === refRunId);
    if (!run?.laps) return null;
    const idx = run.laps.findIndex((l) => l.lapNum === refLapNum);
    return idx >= 0 ? { run, lapIdx: idx } : null;
  }, [runs, refRunId, refLapNum]);

  const cmpTarget = useMemo(() => {
    if (!cmpRunId || cmpLapNum == null) return null;
    const run = runs.find((r) => r.id === cmpRunId);
    if (!run?.laps) return null;
    const idx = run.laps.findIndex((l) => l.lapNum === cmpLapNum);
    return idx >= 0 ? { run, lapIdx: idx } : null;
  }, [runs, cmpRunId, cmpLapNum]);

  const refFrames = useLapFrames(refTarget?.run ?? null, refTarget?.lapIdx ?? null);
  const cmpFrames = useLapFrames(cmpTarget?.run ?? null, cmpTarget?.lapIdx ?? null);

  const plotData = useMemo(() => {
    const rf = refFrames.frames;
    const cf = cmpFrames.frames;
    if (!rf?.length || !cf?.length) return null;

    // Determine the max lap distance across both — use that as the grid end.
    const maxDist = Math.max(
      ...rf.map((f) => f.pLap || 0),
      ...cf.map((f) => f.pLap || 0),
    );
    if (maxDist <= 0) return null;
    // Adaptive grid: aim for ~10 m between samples; clamp between 200 (short
    // laps / test tracks) and 600 (long laps). 400 was the old hardcoded
    // constant — this gives short laps finer resolution without bloating the
    // render cost on long ones.
    const N = Math.min(600, Math.max(200, Math.ceil(maxDist / 10)));
    const grid: number[] = [];
    for (let i = 0; i < N; i++) grid.push((i / (N - 1)) * maxDist);

    // Speed (km/h)
    const rSpeed = resample(framePairs(rf, 's'), grid);
    const cSpeed = resample(framePairs(cf, 's'), grid);
    // Throttle (0-100)
    const rThr = resample(framePairs(rf, 'th'), grid);
    const cThr = resample(framePairs(cf, 'th'), grid);
    // Brake (0-100)
    const rBr = resample(framePairs(rf, 'br'), grid);
    const cBr = resample(framePairs(cf, 'br'), grid);
    // Lap time elapsed (ms) — used to compute Δt at each grid point.
    const rT = resample(framePairs(rf, 't'), grid);
    const cT = resample(framePairs(cf, 't'), grid);
    const delta: (number | null)[] = grid.map((_, i) => {
      if (rT[i] == null || cT[i] == null) return null;
      // Δt in ms. Positive = cmp is slower (further behind reference).
      return cT[i]! - rT[i]!;
    });

    return { grid, rSpeed, cSpeed, rThr, cThr, rBr, cBr, delta };
  }, [refFrames, cmpFrames]);

  // Bail-out messaging
  if (!refTarget || !cmpTarget) {
    return (
      <div>
        <div className={styles.sectionTitle}>DELTA TELEMETRY</div>
        <div style={{ color: 'var(--grey)', fontFamily: 'var(--font-d)', fontSize: '0.55rem' }}>
          Pin a <span style={{ color: REF_COLOR }}>REF</span> lap and a{' '}
          <span style={{ color: CMP_COLOR }}>CMP</span> lap in the Runs table to overlay
          their speed / throttle / brake traces and Δt.
        </div>
      </div>
    );
  }

  if (refFrames.loading || cmpFrames.loading) {
    return (
      <div>
        <div className={styles.sectionTitle}>DELTA TELEMETRY</div>
        <div style={{ color: 'var(--grey)', fontSize: '0.55rem' }}>Loading lap frames…</div>
      </div>
    );
  }

  if (refFrames.error || cmpFrames.error) {
    return (
      <div>
        <div className={styles.sectionTitle}>DELTA TELEMETRY</div>
        <div style={{ color: 'var(--red)', fontSize: '0.55rem' }}>{refFrames.error || cmpFrames.error}</div>
      </div>
    );
  }

  if (!plotData) return null;

  const finalDelta = [...plotData.delta].reverse().find((d) => d != null) ?? null;

  // Speed + inputs chart (main, dual secondary axis)
  const speedOpts: Partial<uPlot.Options> = {
    series: [
      {},
      { label: 'REF speed', stroke: REF_COLOR, width: 2, points: { show: false } },
      { label: 'CMP speed', stroke: CMP_COLOR, width: 2, points: { show: false } },
      { label: 'REF throttle', stroke: REF_COLOR, width: 1, dash: [4, 3], points: { show: false }, scale: 'in' },
      { label: 'CMP throttle', stroke: CMP_COLOR, width: 1, dash: [4, 3], points: { show: false }, scale: 'in' },
      { label: 'REF brake', stroke: REF_COLOR, width: 1, dash: [1, 3], points: { show: false }, scale: 'in' },
      { label: 'CMP brake', stroke: CMP_COLOR, width: 1, dash: [1, 3], points: { show: false }, scale: 'in' },
    ],
    axes: [
      { label: 'Lap distance (m)' },
      { label: 'Speed (km/h)', stroke: '#555575', grid: { stroke: '#1c1c2e' } },
      { side: 1, scale: 'in', label: 'Throttle / Brake (%)', stroke: '#7a6a3e', grid: { show: false } },
    ],
    scales: { x: { time: false }, in: { range: [0, 105] } },
    legend: { live: true },
  };

  // Delta-T bar
  const deltaOpts: Partial<uPlot.Options> = {
    series: [
      {},
      {
        label: 'Δt (cmp − ref, ms)',
        stroke: DELTA_COLOR,
        fill: 'rgba(168,85,247,0.22)',
        width: 1.5,
        points: { show: false },
      },
    ],
    axes: [
      { label: 'Lap distance (m)' },
      { label: 'Δt (ms)', stroke: '#555575', grid: { stroke: '#1c1c2e' } },
    ],
    scales: { x: { time: false } },
    legend: { live: true },
  };

  const refLabel = `${refTarget.run.label || refTarget.run.compound} L${refLapNum}`;
  const cmpLabel = `${cmpTarget.run.label || cmpTarget.run.compound} L${cmpLapNum}`;

  return (
    <div>
      <div className={styles.sectionTitle}>
        DELTA TELEMETRY
        <span style={{ color: 'var(--grey-light)', fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.5rem' }}>
          <span style={{ color: REF_COLOR }}>{refLabel}</span>
          {' vs '}
          <span style={{ color: CMP_COLOR }}>{cmpLabel}</span>
          {finalDelta != null && (
            <>
              {'  ·  final Δt '}
              <span style={{ color: finalDelta > 0 ? 'var(--red)' : 'var(--green)' }}>
                {finalDelta > 0 ? '+' : ''}{(finalDelta / 1000).toFixed(3)}s
              </span>
            </>
          )}
        </span>
      </div>
      <div className={styles.chartContainer}>
        <UPlotChart
          options={speedOpts}
          data={[
            plotData.grid,
            plotData.rSpeed as number[],
            plotData.cSpeed as number[],
            plotData.rThr as number[],
            plotData.cThr as number[],
            plotData.rBr as number[],
            plotData.cBr as number[],
          ] as uPlot.AlignedData}
          height={240}
        />
      </div>
      <div className={styles.chartContainer} style={{ marginTop: '0.4rem' }}>
        <UPlotChart
          options={deltaOpts}
          data={[plotData.grid, plotData.delta as number[]] as uPlot.AlignedData}
          height={140}
        />
      </div>
    </div>
  );
}

export default React.memo(DeltaTelemetry);
