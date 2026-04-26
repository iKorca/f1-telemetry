import React, { useMemo } from 'react';
import type { PracticeRun } from '@shared/types';
import LapSeriesChart, { avgWheels } from '@/components/common/LapSeriesChart';
import { runColor, WHEEL_LABELS } from '@/lib/chartPalette';
import { fmtPctTick, valPct } from '@/lib/formatters';
import { usePracticeStore } from '@/store/practiceStore';

/**
 * Linear extrapolation of wear-per-lap towards 100%. Returns the wheel with
 * the steepest positive slope and how many laps remain until it tops out.
 */
function extrapolateWear(run: PracticeRun): { worstSlope: number; lapsRemaining: number; worstWheel: number } | null {
  if (!run.laps || run.laps.length < 2) return null;
  let worstSlope = -Infinity;
  let worstWheel = -1;
  let worstLatest = 0;
  for (let w = 0; w < 4; w++) {
    const pts = run.laps
      .map((l, i) => ({ x: l.tyreAge ?? i + 1, y: l.tyreWear?.[w] ?? 0 }))
      .filter((p) => p.y > 0);
    if (pts.length < 2) continue;
    const n = pts.length;
    const sumX = pts.reduce((s, p) => s + p.x, 0);
    const sumY = pts.reduce((s, p) => s + p.y, 0);
    const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
    const sumXX = pts.reduce((s, p) => s + p.x * p.x, 0);
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) continue;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const latest = pts[pts.length - 1].y;
    if (slope > worstSlope) {
      worstSlope = slope;
      worstWheel = w;
      worstLatest = latest;
    }
  }
  if (worstSlope <= 0 || worstWheel < 0) return null;
  const lapsRemaining = (100 - worstLatest) / worstSlope;
  return { worstSlope, lapsRemaining: Math.max(0, Math.round(lapsRemaining)), worstWheel };
}

function TyreWearChart({ runs }: { runs: PracticeRun[] }) {
  const palette = usePracticeStore((s) => s.chartPalette);
  const refRunId = usePracticeStore((s) => s.referenceRunId);

  const extrapolations = useMemo(() => {
    if (refRunId) return [];
    return runs
      .filter((r) => r.laps && r.laps.length >= 2)
      .map((r, i) => {
        const e = extrapolateWear(r);
        if (!e) return null;
        return {
          color: runColor(i, palette),
          label: r.label || r.compound,
          worstWheel: WHEEL_LABELS[e.worstWheel],
          lapsRemaining: e.lapsRemaining,
          slope: e.worstSlope,
        };
      })
      .filter(Boolean) as Array<{ color: string; label: string; worstWheel: string; lapsRemaining: number; slope: number }>;
  }, [runs, refRunId, palette]);

  const legend = extrapolations.length > 0 ? (
    <div style={{
      fontFamily: 'var(--font-d)', fontSize: '0.5rem', color: 'var(--grey)',
      marginTop: '0.3rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap',
    }}>
      {extrapolations.map((e, i) => (
        <span key={i}>
          <span style={{ color: e.color, fontWeight: 700 }}>{e.label}</span>
          {' — worst '}
          <span style={{ color: 'var(--white)' }}>{e.worstWheel}</span>
          {', '}
          <span style={{ color: e.slope > 3 ? 'var(--red)' : e.slope > 1.5 ? 'var(--orange)' : 'var(--green)' }}>
            {e.slope.toFixed(2)} %/lap
          </span>
          {' → '}
          <span style={{ color: e.lapsRemaining < 5 ? 'var(--red)' : e.lapsRemaining < 10 ? 'var(--orange)' : 'var(--white)' }}>
            {e.lapsRemaining} laps to 100%
          </span>
        </span>
      ))}
    </div>
  ) : null;

  return (
    <LapSeriesChart
      title="TYRE WEAR"
      runs={runs}
      yLabel="Tyre Wear (%)"
      yDeltaLabel="Δ Tyre Wear (%)"
      syncKey="practice-laps"
      floorZero
      percentileClamp={false}
      getY={(lap) => {
        const v = avgWheels(lap.tyreWear);
        return v == null ? null : +v.toFixed(1);
      }}
      getWheelY={(lap) => lap.tyreWear}
      refValueOfLap={(lap) => avgWheels(lap.tyreWear)}
      axisTickFormatter={fmtPctTick}
      valueFormatter={valPct}
      renderLegend={legend}
    />
  );
}

export default React.memo(TyreWearChart);
