import React, { useMemo } from 'react';
import type { PracticeRun } from '@shared/types';
import UPlotChart from '@/components/common/UPlotChart';
import type uPlot from 'uplot';
import { usePracticeStore } from '@/store/practiceStore';
import { useLapFrames } from '@/hooks/useLapFrames';
import styles from './PracticeTab.module.css';

interface FrictionCircleProps {
  runs: PracticeRun[];
}

/**
 * Classic g-g plot — lateral G on X, longitudinal G on Y. Each dot is one
 * telemetry frame. Reveals whether the driver is using the full grip
 * envelope of the car (ideal = cloud fills the ~2.5-3.0 g circle).
 *
 * We render for the pinned reference lap when set, otherwise the best lap
 * of the first selected run. Keeps the fetch cost bounded to one lap.
 */
function FrictionCircle({ runs }: FrictionCircleProps) {
  const refRunId = usePracticeStore((s) => s.referenceRunId);
  const refLapNum = usePracticeStore((s) => s.referenceLapNum);

  // Resolve which lap to fetch
  const target = useMemo(() => {
    if (refRunId && refLapNum != null) {
      const run = runs.find((r) => r.id === refRunId);
      if (run?.laps) {
        const idx = run.laps.findIndex((l) => l.lapNum === refLapNum);
        if (idx >= 0) return { run, lapIdx: idx, source: 'ref' as const };
      }
    }
    // Fallback: first run's best valid lap
    for (const run of runs) {
      if (!run.laps) continue;
      const idx = run.laps.findIndex((l) => l.valid && l.lapTimeMs === run.bestLapMs);
      if (idx >= 0) return { run, lapIdx: idx, source: 'best' as const };
    }
    return null;
  }, [runs, refRunId, refLapNum]);

  const { frames, loading, error } = useLapFrames(target?.run ?? null, target?.lapIdx ?? null);

  const chartData = useMemo(() => {
    if (!frames || frames.length === 0) return null;
    const gx: number[] = [];
    const gy: number[] = [];
    for (const f of frames) {
      if (f.gL == null || f.gN == null) continue;
      // Reject NaN / Infinity defensively — a corrupted frame would otherwise
      // produce an invisible plot because uPlot's auto range blows up.
      if (!Number.isFinite(f.gL) || !Number.isFinite(f.gN)) continue;
      gx.push(f.gL);
      gy.push(f.gN);
    }
    if (gx.length < 10) return null;
    return { gx, gy };
  }, [frames]);

  if (!target) {
    return (
      <div>
        <div className={styles.sectionTitle}>FRICTION CIRCLE</div>
        <div style={{ color: 'var(--grey)', fontFamily: 'var(--font-d)', fontSize: '0.55rem' }}>
          Pin a reference lap (REF button in Runs table) to render the g-g plot.
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <div className={styles.sectionTitle}>FRICTION CIRCLE</div>
        <div style={{ color: 'var(--grey)', fontFamily: 'var(--font-d)', fontSize: '0.55rem' }}>
          Loading lap frames…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className={styles.sectionTitle}>FRICTION CIRCLE</div>
        <div style={{ color: 'var(--red)', fontFamily: 'var(--font-d)', fontSize: '0.55rem' }}>
          {error}
        </div>
      </div>
    );
  }

  if (!chartData) return null;

  const opts: Partial<uPlot.Options> = {
    series: [
      {},
      {
        label: 'Frames',
        stroke: '#3b82f6',
        width: 0,
        points: { show: true, size: 3, fill: 'rgba(59,130,246,0.6)' },
      },
    ],
    axes: [
      { label: 'Lateral g (negative = left)' },
      { label: 'Longitudinal g (accel = +, brake = −)', stroke: '#555575', grid: { stroke: '#1c1c2e' } },
    ],
    scales: {
      x: { time: false, range: (_u, min, max) => {
        const abs = Math.max(Math.abs(min ?? 0), Math.abs(max ?? 0), 3);
        return [-abs, abs];
      }},
      y: { range: (_u, min, max) => {
        const abs = Math.max(Math.abs(min ?? 0), Math.abs(max ?? 0), 3);
        return [-abs, abs];
      }},
    },
    legend: { live: false },
  };

  return (
    <div>
      <div className={styles.sectionTitle}>
        FRICTION CIRCLE
        <span style={{ color: 'var(--grey-light)', fontWeight: 400, marginLeft: '0.5rem', fontSize: '0.5rem' }}>
          {target.run.label || target.run.compound} · lap {target.run.laps![target.lapIdx].lapNum}
          {target.source === 'ref' ? ' (pinned)' : ' (best)'}
        </span>
      </div>
      <div className={styles.chartContainer}>
        <UPlotChart options={opts} data={[chartData.gx, chartData.gy] as uPlot.AlignedData} height={260} />
      </div>
    </div>
  );
}

export default React.memo(FrictionCircle);
