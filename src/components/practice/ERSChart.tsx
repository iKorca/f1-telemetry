import React, { useMemo } from 'react';
import type { PracticeRun } from '@shared/types';
import UPlotChart, { withSync } from '@/components/common/UPlotChart';
import ChartEmpty from '@/components/common/ChartEmpty';
import type uPlot from 'uplot';
import { usePracticeStore } from '@/store/practiceStore';
import { buildXData, buildYArray, xAxisLabel } from '@/lib/chartAxis';
import { runColor } from '@/lib/chartPalette';
import { valPct, valEnergy } from '@/lib/formatters';
import styles from './PracticeTab.module.css';

function ERSChart({ runs }: { runs: PracticeRun[] }) {
  const xMode = usePracticeStore((s) => s.xAxisMode);
  const includeInvalid = usePracticeStore((s) => s.includeInvalidLaps);
  const palette = usePracticeStore((s) => s.chartPalette);

  const chartData = useMemo(() => {
    const validFilter = (lap: { valid: boolean; isOutLap?: boolean; isPitLap?: boolean; trafficLap?: boolean }) =>
      includeInvalid || (lap.valid && !lap.isOutLap && !lap.isPitLap && !lap.trafficLap);

    const runsWithERS = runs.filter(
      (r) => r.laps && r.laps.some((l) => validFilter(l) && (
        (l.avgBatteryPct != null && l.avgBatteryPct > 0)
          || (l.ersDeployedMJ != null && l.ersDeployedMJ > 0)
          || (l.ersHarvestedMJ != null && l.ersHarvestedMJ > 0))),
    );
    if (runsWithERS.length === 0) return null;

    const xData = buildXData(runsWithERS, xMode);
    if (xData.length < 1) return null;

    const series: uPlot.Series[] = [{}];
    const data: uPlot.AlignedData = [xData];

    for (let ri = 0; ri < runsWithERS.length; ri++) {
      const run = runsWithERS[ri];
      const color = runColor(ri, palette);
      const label = run.label || run.compound;

      series.push({
        label: `${label} battery`,
        stroke: color, width: 2, points: { show: true, size: 4 }, value: valPct,
      });
      data.push(buildYArray(run, xData, xMode, (lap) =>
        validFilter(lap) && lap.avgBatteryPct != null && lap.avgBatteryPct > 0 ? lap.avgBatteryPct : null,
      ) as number[]);

      series.push({
        label: `${label} deployed`,
        stroke: color, width: 1.2, dash: [4, 3], points: { show: false }, scale: 'mj', value: valEnergy,
      });
      data.push(buildYArray(run, xData, xMode, (lap) =>
        validFilter(lap) && lap.ersDeployedMJ != null && lap.ersDeployedMJ > 0 ? lap.ersDeployedMJ : null,
      ) as number[]);

      series.push({
        label: `${label} harvested`,
        stroke: color, width: 1.2, dash: [1, 3], points: { show: false }, scale: 'mj', value: valEnergy,
      });
      data.push(buildYArray(run, xData, xMode, (lap) =>
        validFilter(lap) && lap.ersHarvestedMJ != null && lap.ersHarvestedMJ > 0 ? lap.ersHarvestedMJ : null,
      ) as number[]);
    }

    return { series, data };
  }, [runs, xMode, includeInvalid, palette]);

  if (!chartData) {
    return (
      <div>
        <div className={styles.sectionTitle}>ERS USAGE</div>
        <ChartEmpty
          message="No ERS data captured yet"
          hint="ERS values only record once the player completes a timed lap"
        />
      </div>
    );
  }

  const opts: Partial<uPlot.Options> = {
    series: chartData.series,
    axes: [
      { label: xAxisLabel(xMode) },
      { label: 'Battery (%)', stroke: '#555575', grid: { stroke: '#1c1c2e' } },
      { side: 1, scale: 'mj', label: 'Energy (MJ)', stroke: '#7a6a3e', grid: { show: false } },
    ],
    scales: { x: { time: false }, y: { range: [0, 100] }, mj: { auto: true } },
    legend: { live: true },
    cursor: { sync: withSync('practice-laps') },
  };

  return (
    <div>
      <div className={styles.sectionTitle}>ERS USAGE</div>
      <div className={styles.chartContainer}>
        <UPlotChart options={opts} data={chartData.data} height={220} />
      </div>
    </div>
  );
}

export default React.memo(ERSChart);
