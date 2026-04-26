import React, { useMemo } from 'react';
import type { SessionDetail, TelemetryFrame } from '@shared/types';
import { COMPOUND_COLORS } from '@shared/types';
import UPlotChart from '@/components/common/UPlotChart';
import ChartEmpty from '@/components/common/ChartEmpty';
import type uPlot from 'uplot';

interface StintChartsProps {
  session: SessionDetail;
}

/**
 * Tyre wear % per stint-lap (averaged over 4 wheels at lap end).
 *
 * Previous implementation silently returned zero when `endFrameIdx` pointed
 * at a frame that happened to carry zero-wear readings — a single missed
 * telemetry tick at the exact lap boundary turned the whole chart into a
 * flat line. We now walk backward from `endFrameIdx` until a frame with a
 * non-zero `tw` is found, and if the lap carries no frames at all (frame
 * buffer trimmed, or no telemetry captured) we render a dashed empty
 * state instead of misleading zeros.
 */
function StintCharts({ session }: StintChartsProps) {
  const chartData = useMemo(() => {
    const laps = (session.laps || []).filter(
      (l) => l.lapTimeMs > 0 && !l.deleted,
    );
    if (laps.length < 2) return null;
    const frames = session.frames || [];

    // Walk backward from the lap's end frame until a non-zero wear sample
    // appears. Returns null if the lap has no viable frames at all.
    const wearAtLap = (endIdx: number | null | undefined, startIdx: number | null | undefined): number | null => {
      if (frames.length === 0) return null;
      if (endIdx == null) return null;
      const lo = Math.max(0, startIdx ?? 0);
      const hi = Math.min(frames.length - 1, endIdx);
      if (hi < lo) return null;
      for (let i = hi; i >= lo; i--) {
        const f = frames[i] as TelemetryFrame | undefined;
        const tw = f?.tw;
        if (!tw) continue;
        const vals = tw.filter((v) => v > 0);
        if (vals.length === 0) continue;
        return +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
      }
      return null;
    };

    // Group by compound, reset stintPos whenever compound changes.
    const byCompound: Record<string, { x: number[]; y: number[] }> = {};
    let stintPos = 0;
    let lastCompound: string | null = null;
    let samplesFound = 0;

    for (const lap of laps) {
      if (lap.compound !== lastCompound) {
        stintPos = 0;
        lastCompound = lap.compound;
      }
      stintPos++;
      const wear = wearAtLap(lap.endFrameIdx, lap.startFrameIdx);
      if (wear == null) continue;
      samplesFound++;
      const key = lap.compound || 'Unknown';
      if (!byCompound[key]) byCompound[key] = { x: [], y: [] };
      byCompound[key].x.push(stintPos);
      byCompound[key].y.push(wear);
    }

    if (samplesFound === 0) return null;

    const compounds = Object.keys(byCompound);
    const maxX = Math.max(...compounds.flatMap((c) => byCompound[c].x));
    const xData = Array.from({ length: maxX }, (_, i) => i + 1);
    const series: uPlot.Series[] = [{}];
    const data: uPlot.AlignedData = [xData];

    for (const comp of compounds) {
      const colorKey = comp.toUpperCase() as keyof typeof COMPOUND_COLORS;
      series.push({
        label: comp,
        stroke: COMPOUND_COLORS[colorKey] || '#888',
        width: 2,
        points: { show: true, size: 4 },
        value: (_u, v) => (v == null ? '\u2014' : `${v.toFixed(1)}%`),
      });
      const yArr: (number | null)[] = new Array(maxX).fill(null);
      byCompound[comp].x.forEach((x, i) => {
        yArr[x - 1] = byCompound[comp].y[i];
      });
      data.push(yArr as number[]);
    }

    return { series, data };
  }, [session.laps, session.frames]);

  if (!chartData) {
    return (
      <div>
        <span className="section-label">TYRE WEAR</span>
        <ChartEmpty
          message="No per-frame tyre-wear recorded this session"
          hint="Wear is captured only when `Capture frame data` is enabled during recording"
        />
      </div>
    );
  }

  const options: Partial<uPlot.Options> = {
    series: chartData.series,
    axes: [
      { label: 'Stint Lap' },
      {
        label: 'Tyre Wear (%)',
        values: (_u, ticks) => ticks.map((t) => (t == null ? null : `${Math.round(t)}%`)),
      },
    ],
    scales: {
      x: { time: false },
      y: { range: (_u, _min, max) => [0, Math.max(max ?? 0, 10)] },
    },
    legend: { live: true },
  };

  return (
    <div>
      <span className="section-label">TYRE WEAR</span>
      <UPlotChart
        options={options}
        data={chartData.data}
        height={220}
      />
    </div>
  );
}

export default React.memo(StintCharts);
