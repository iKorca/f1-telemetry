import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { SessionDetail } from '@shared/types';
import { getTeamColor } from '@/lib/colors';
import { fmtLapTimeTick, valLapTime, valDeltaSec } from '@/lib/formatters';
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

  // ── Resolve the player's carIdx ──────────────────────────────────────────
  // The saved session doesn't record an explicit player index, so we match
  // the player's RecordedLap[] times against each driver's CarLap[] and
  // pick the one with the lowest cumulative diff.
  const playerCarIdx = useMemo<number | null>(() => {
    if (!rd?.carLaps || !session.laps || session.laps.length === 0) return null;
    const playerTimes = session.laps
      .filter((l) => l.lapTimeMs > 0 && !l.deleted)
      .map((l) => ({ n: l.lapNum, ms: l.lapTimeMs }));
    if (playerTimes.length === 0) return null;

    let bestIdx: number | null = null;
    let bestScore = Infinity;
    for (const idxStr of Object.keys(rd.carLaps)) {
      const idx = Number(idxStr);
      const carLaps = rd.carLaps[idx] || [];
      let score = 0;
      let matched = 0;
      for (const p of playerTimes) {
        const c = carLaps.find((x) => x.lapNum === p.n);
        if (!c) { score += 10000; continue; }
        // Exact match for the player's own stream, tolerance for rounding
        score += Math.abs(c.lapTimeMs - p.ms);
        matched++;
      }
      if (matched === 0) continue;
      if (score < bestScore) { bestScore = score; bestIdx = idx; }
    }
    return bestIdx;
  }, [rd, session.laps]);

  // ── Default driver selection: player + 4 closest by final position ─────
  // "Closest" = 2 ahead + 2 behind; clamped at field edges. If we can't
  // resolve the player, fall back to the first five indices.
  const defaultSelection = useMemo<Set<number>>(() => {
    if (!rd?.carLaps) return new Set();
    // Rank drivers by their last known position (from final carLap entry).
    const ranked = Object.keys(rd.carLaps)
      .map(Number)
      .map((idx) => {
        const laps = rd.carLaps[idx] || [];
        const last = laps[laps.length - 1];
        return { idx, pos: last?.position ?? 99 };
      })
      .filter((r) => r.pos > 0)
      .sort((a, b) => a.pos - b.pos);

    if (ranked.length === 0) return new Set(driverIndices.slice(0, 5));

    const playerRank = playerCarIdx != null
      ? ranked.findIndex((r) => r.idx === playerCarIdx)
      : -1;

    if (playerRank < 0) {
      return new Set(ranked.slice(0, 5).map((r) => r.idx));
    }

    const lo = Math.max(0, playerRank - 2);
    const hi = Math.min(ranked.length - 1, playerRank + 2);
    // Expand one side if we bumped into the start/end of the field, so we
    // always end up with ≤ 5 selections regardless of where the player is.
    let window = ranked.slice(lo, hi + 1);
    while (window.length < 5 && (lo > 0 || hi < ranked.length - 1)) {
      if (lo > 0) window = [ranked[lo - 1], ...window];
      if (window.length >= 5) break;
      if (hi < ranked.length - 1) window = [...window, ranked[hi + 1]];
      break;
    }
    return new Set(window.map((r) => r.idx));
  }, [rd, driverIndices, playerCarIdx]);

  const [metric, setMetric] = useState<Metric>('lapTime');
  const [checkedDrivers, setCheckedDrivers] = useState<Set<number>>(defaultSelection);

  // Re-sync when the resolved default changes (e.g., session reloaded).
  useEffect(() => {
    setCheckedDrivers(defaultSelection);
  }, [defaultSelection]);

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
      const color = getTeamColor(p.teamId ?? 0);
      const name = p.name || `Car ${idx}`;

      // Per-series value formatter matches the axis — lap time and gap show
      // as `m:ss.mmm`, position as an integer, tyre age as laps.
      const seriesValue = metric === 'lapTime'
        ? valLapTime
        : metric === 'gap'
          ? valDeltaSec
          : undefined;
      series.push({
        label: name,
        stroke: color,
        width: 1.5,
        ...(seriesValue ? { value: seriesValue } : {}),
      });

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
      ? 'Lap Time'
      : metric === 'position'
        ? 'Position'
        : metric === 'gap'
          ? 'Gap to Leader'
          : 'Tyre Age (laps)';

  const axisValues =
    metric === 'lapTime'
      ? fmtLapTimeTick
      : metric === 'gap'
        ? (_u: unknown, ticks: number[]): Array<string | null> =>
            ticks.map((t) =>
              t == null ? null : `${t >= 0 ? '+' : ''}${t.toFixed(2)} s`,
            )
        : undefined;

  const options: Partial<uPlot.Options> = {
    scales: {
      x: { time: false },
      y: metric === 'position' ? { dir: -1 as const } : {},
    },
    axes: [
      { label: 'Lap', stroke: '#888', grid: { stroke: '#333' } },
      {
        label: axisLabel,
        stroke: '#888',
        grid: { stroke: '#222' },
        ...(axisValues ? { values: axisValues } : {}),
      },
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
          const color = getTeamColor(p.teamId ?? 0);
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
