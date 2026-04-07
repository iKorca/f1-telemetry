import React, { useMemo, useState, useCallback } from 'react';
import type { SessionDetail } from '@shared/types';
import { TEAM_COLORS } from '@shared/types';
import UPlotChart from '@/components/common/UPlotChart';
import type uPlot from 'uplot';
import styles from './RaceAnalysis.module.css';

interface RaceAnalysisProps {
  session: SessionDetail;
}

type Metric = 'lapTime' | 'position' | 'gap' | 'tyreAge';

function RaceAnalysis({ session }: RaceAnalysisProps) {
  const rd = session.raceData;
  const isRace = /race|sprint/i.test(session.sessionType || '');

  const driverIndices = useMemo(() => {
    if (!rd?.carLaps) return [];
    return Object.keys(rd.carLaps).map(Number);
  }, [rd]);

  const [metric, setMetric] = useState<Metric>('lapTime');
  const [checkedDrivers, setCheckedDrivers] = useState<Set<number>>(() => {
    return new Set(driverIndices.slice(0, 10));
  });

  const handleDriverToggle = useCallback((idx: number) => {
    setCheckedDrivers((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const chartData = useMemo(() => {
    if (!rd?.carLaps || checkedDrivers.size === 0) return null;
    const participants = rd.participants || [];
    const selected = Array.from(checkedDrivers);

    const maxLap = Math.max(
      ...selected.map((idx) => (rd.carLaps[idx] || []).length),
    );
    if (maxLap < 1) return null;

    const xData = Array.from({ length: maxLap }, (_, i) => i + 1);
    const series: uPlot.Series[] = [{ label: 'Lap' }];
    let data: (number | null)[][] = [xData as (number | null)[]];

    for (const idx of selected) {
      const laps = rd.carLaps[idx] || [];
      const p = participants[idx] || {};
      const color =
        TEAM_COLORS[p.teamId as keyof typeof TEAM_COLORS] || '#888';
      const name = p.name || `Car ${idx}`;

      series.push({ label: name, stroke: color, width: 1.5 });

      const values: (number | null)[] = new Array(maxLap).fill(null);
      for (const lap of laps) {
        const i = lap.lapNum - 1;
        if (i < 0 || i >= maxLap) continue;
        switch (metric) {
          case 'lapTime':
            values[i] = lap.lapTimeMs > 0 ? lap.lapTimeMs / 1000 : null;
            break;
          case 'position':
            values[i] = lap.position || null;
            break;
          case 'gap':
            values[i] = lap.lapTimeMs > 0 ? lap.lapTimeMs / 1000 : null;
            break;
          case 'tyreAge':
            values[i] = lap.tyreAge ?? null;
            break;
        }
      }
      data.push(values);
    }

    // Gap metric: convert to cumulative gap vs leader (needs 2+ drivers)
    if (metric === 'gap' && selected.length >= 2) {
      const cumSums = data.slice(1).map((vals) => {
        let sum = 0;
        return vals.map((v) => {
          if (v != null) sum += v;
          return v != null ? sum : null;
        });
      });
      const finalTimes = cumSums.map(
        (c) => c.filter((v) => v != null).pop() ?? Infinity,
      );
      const leaderIdx = finalTimes.indexOf(Math.min(...(finalTimes as number[])));
      const leaderCum = cumSums[leaderIdx];
      for (let d = 0; d < cumSums.length; d++) {
        data[d + 1] = cumSums[d].map((v, i) => {
          if (v == null || leaderCum[i] == null) return null;
          return +((v as number) - (leaderCum[i] as number)).toFixed(2);
        });
      }
    }

    return { series, data: data as uPlot.AlignedData };
  }, [rd, metric, checkedDrivers]);

  if (!isRace || !rd?.carLaps || Object.keys(rd.carLaps).length < 2) {
    return null;
  }

  const axisLabel =
    metric === 'lapTime'
      ? 'Time (s)'
      : metric === 'position'
        ? 'Position'
        : metric === 'gap'
          ? 'Gap to Leader (s)'
          : 'Tyre Age (laps)';

  const options: Partial<uPlot.Options> = {
    scales: {
      x: { time: false },
      y: metric === 'position' ? { dir: -1 as const } : {},
    },
    axes: [
      { label: 'Lap', stroke: '#888', grid: { stroke: '#333' } },
      { label: axisLabel, stroke: '#888', grid: { stroke: '#222' } },
    ],
    series: chartData?.series || [{}],
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className="section-label">RACE ANALYSIS</span>
        <select
          className="settings-select"
          value={metric}
          onChange={(e) => setMetric(e.target.value as Metric)}
        >
          <option value="lapTime">Lap Time</option>
          <option value="position">Position</option>
          <option value="gap">Gap to Leader</option>
          <option value="tyreAge">Tyre Age</option>
        </select>
      </div>

      <div className={styles.driverChecks}>
        {driverIndices.map((idx) => {
          const p = (rd.participants || [])[idx] || {};
          const name = p.name || `Car ${idx}`;
          const color =
            TEAM_COLORS[p.teamId as keyof typeof TEAM_COLORS] || '#888';
          return (
            <label
              key={idx}
              className={styles.driverLabel}
              style={{ borderLeft: `3px solid ${color}` }}
            >
              <input
                type="checkbox"
                checked={checkedDrivers.has(idx)}
                onChange={() => handleDriverToggle(idx)}
              />
              {name}
            </label>
          );
        })}
      </div>

      {chartData && (
        <div className={styles.chartBox}>
          <UPlotChart
            options={options}
            data={chartData.data}
            height={350}
          />
        </div>
      )}
    </div>
  );
}

export default React.memo(RaceAnalysis);
