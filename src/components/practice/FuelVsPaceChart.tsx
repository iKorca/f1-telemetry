import React, { useMemo } from 'react';
import type { PracticeRun } from '@shared/types';
import UPlotChart from '@/components/common/UPlotChart';
import ChartEmpty from '@/components/common/ChartEmpty';
import type uPlot from 'uplot';
import { runColor } from '@/lib/chartPalette';
import { percentileRange } from '@/lib/chartAxis';
import { valFuel, valLapTime, fmtLapTimeTick } from '@/lib/formatters';
import { usePracticeStore } from '@/store/practiceStore';
import styles from './PracticeTab.module.css';

function FuelVsPaceChart({ runs }: { runs: PracticeRun[] }) {
  const includeInvalid = usePracticeStore((s) => s.includeInvalidLaps);
  const palette = usePracticeStore((s) => s.chartPalette);

  const chartData = useMemo(() => {
    const validFilter = (lap: { valid: boolean; isOutLap?: boolean; isPitLap?: boolean; trafficLap?: boolean }) =>
      includeInvalid || (lap.valid && !lap.isOutLap && !lap.isPitLap && !lap.trafficLap);

    const runsWithData = runs.filter((r) =>
      r.laps && r.laps.some((l) => validFilter(l) && l.lapTimeMs > 0 && l.fuel > 0),
    );
    if (runsWithData.length === 0) return null;

    const xSet = new Set<number>();
    const perRun: { color: string; label: string; points: { x: number; y: number }[] }[] = [];

    for (let ri = 0; ri < runsWithData.length; ri++) {
      const run = runsWithData[ri];
      const pts: { x: number; y: number }[] = [];
      for (const lap of run.laps!) {
        if (!validFilter(lap) || lap.lapTimeMs <= 0 || lap.fuel <= 0) continue;
        const x = +lap.fuel.toFixed(2);
        const y = lap.lapTimeMs / 1000;
        pts.push({ x, y });
        xSet.add(x);
      }
      if (pts.length === 0) continue;
      perRun.push({ color: runColor(ri, palette), label: run.label || run.compound, points: pts });
    }

    if (perRun.length === 0 || xSet.size < 2) return null;

    const xData = Array.from(xSet).sort((a, b) => a - b);
    const xIndex = new Map(xData.map((x, i) => [x, i]));
    const series: uPlot.Series[] = [{}];
    const data: uPlot.AlignedData = [xData];
    const allY: number[] = [];

    for (const r of perRun) {
      series.push({
        label: r.label, stroke: r.color, width: 0,
        points: { show: true, size: 5, fill: r.color },
        value: valLapTime,
      });
      const ys: (number | null)[] = new Array(xData.length).fill(null);
      for (const p of r.points) {
        const idx = xIndex.get(p.x);
        if (idx != null) {
          ys[idx] = ys[idx] == null ? p.y : Math.min(ys[idx]!, p.y);
        }
      }
      ys.forEach((v) => { if (v != null) allY.push(v); });
      data.push(ys as number[]);
    }

    return { series, data, allY };
  }, [runs, includeInvalid, palette]);

  if (!chartData) {
    return (
      <div>
        <div className={styles.sectionTitle}>FUEL vs PACE</div>
        <ChartEmpty message="Need 2+ laps with fuel data in selected runs" />
      </div>
    );
  }

  const options: Partial<uPlot.Options> = {
    series: chartData.series,
    axes: [
      { label: 'Fuel burned this lap (kg)', values: (_u, t) => t.map((v) => `${v.toFixed(2)} kg`) },
      { label: 'Lap Time', stroke: '#555575', grid: { stroke: '#1c1c2e' }, values: fmtLapTimeTick },
    ],
    scales: {
      x: { time: false },
      y: { range: percentileRange(chartData.allY, { pad: 0.04 }) },
    },
    legend: { live: true },
  };

  return (
    <div>
      <div className={styles.sectionTitle}>FUEL vs PACE</div>
      <div className={styles.chartContainer}>
        <UPlotChart options={options} data={chartData.data} height={220} />
      </div>
    </div>
  );
}

export default React.memo(FuelVsPaceChart);

// Ensure fmtFuelTick import is retained for lint
export { valFuel as __valFuel };
