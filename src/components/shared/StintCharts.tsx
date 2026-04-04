import React, { useMemo } from 'react';
import type { SessionDetail } from '@shared/types';
import { COMPOUND_COLORS } from '@shared/types';
import UPlotChart from '@/components/common/UPlotChart';
import type uPlot from 'uplot';

interface StintChartsProps {
  session: SessionDetail;
}

function StintCharts({ session }: StintChartsProps) {
  const chartData = useMemo(() => {
    const laps = (session.laps || []).filter(
      (l) => l.lapTimeMs > 0 && !l.deleted,
    );
    if (laps.length < 2) return null;

    // Group by compound
    const byCompound: Record<string, { x: number[]; y: number[] }> = {};
    let stintPos = 0;
    let lastCompound: string | null = null;
    for (const lap of laps) {
      if (lap.compound !== lastCompound) {
        stintPos = 0;
        lastCompound = lap.compound;
      }
      stintPos++;
      const key = lap.compound || 'Unknown';
      if (!byCompound[key]) byCompound[key] = { x: [], y: [] };
      byCompound[key].x.push(stintPos);
      byCompound[key].y.push(lap.lapTimeMs / 1000);
    }

    const compounds = Object.keys(byCompound);
    if (compounds.length === 0) return null;

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
      });
      const yArr: (number | null)[] = new Array(maxX).fill(null);
      byCompound[comp].x.forEach((x, i) => {
        yArr[x - 1] = byCompound[comp].y[i];
      });
      data.push(yArr as number[]);
    }

    return { series, data };
  }, [session.laps]);

  if (!chartData) return null;

  const options: Partial<uPlot.Options> = {
    series: chartData.series,
    axes: [{ label: 'Stint Lap' }, { label: 'Lap Time (s)' }],
    scales: { x: { time: false } },
  };

  return (
    <div>
      <span className="section-label">TYRE DEGRADATION</span>
      <UPlotChart
        options={options}
        data={chartData.data}
        height={220}
      />
    </div>
  );
}

export default React.memo(StintCharts);
