import React, { useMemo } from 'react';
import type { SessionDetail } from '@shared/types';
import UPlotChart from '@/components/common/UPlotChart';
import { resampleToLength } from '@/lib/chartUtils';
import type uPlot from 'uplot';

interface VarianceOverlayProps {
  session: SessionDetail;
}

function VarianceOverlay({ session }: VarianceOverlayProps) {
  const chartData = useMemo(() => {
    const validLaps = (session.laps || []).filter(
      (l) => !l.deleted && l.lapTimeMs > 0,
    );
    if (validLaps.length < 2) return null;

    // Find best lap
    const bestMs = Math.min(...validLaps.map((l) => l.lapTimeMs));
    const bestLap = validLaps.find((l) => l.lapTimeMs === bestMs);
    if (!bestLap) return null;

    const bestFrames = session.frames.slice(
      bestLap.startFrameIdx,
      (bestLap.endFrameIdx || session.frames.length) + 1,
    );
    const targetLen = bestFrames.length;
    if (targetLen < 2) return null;

    const xData = bestFrames.map((_, i) => i);
    const series: uPlot.Series[] = [{}];
    const data: uPlot.AlignedData = [xData];

    for (const lap of validLaps) {
      const frames = session.frames.slice(
        lap.startFrameIdx,
        (lap.endFrameIdx || session.frames.length) + 1,
      );
      if (frames.length < 2) continue;
      const speeds = frames.map((f) => f.s || 0);
      const resampled = resampleToLength(speeds, targetLen);
      const isBest = lap === bestLap;
      series.push({
        label: `Lap ${lap.lapNum}`,
        stroke: isBest ? '#e8002d' : 'rgba(100,100,200,0.15)',
        width: isBest ? 2 : 1,
      });
      data.push(resampled);
    }

    return { series, data };
  }, [session]);

  if (!chartData) return null;

  const options: Partial<uPlot.Options> = {
    scales: { x: { time: false } },
    axes: [{ show: false }, { stroke: '#555575', grid: { stroke: '#1c1c2e' } }],
    series: chartData.series,
    cursor: { show: true },
    legend: { show: false },
  };

  return (
    <div
      style={{
        marginBottom: '0.8rem',
        background: '#10101e',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        overflow: 'hidden',
      }}
    >
      <UPlotChart options={options} data={chartData.data} height={200} />
    </div>
  );
}

export default React.memo(VarianceOverlay);
