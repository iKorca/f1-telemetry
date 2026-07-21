import React, { useMemo, useState, useCallback } from 'react';
import type { SessionDetail } from '@shared/types';
import { TEAM_COLORS } from '@shared/types';
import UPlotChart from '@/components/common/UPlotChart';
import type uPlot from 'uplot';
import styles from './DriverComparison.module.css';

interface DriverComparisonProps {
  session: SessionDetail;
}

function DriverComparison({ session }: DriverComparisonProps) {
  const rd = session.raceData;
  const isRace = /race|sprint/i.test(session.sessionType || '');

  const drivers = useMemo(() => {
    if (!rd?.carLaps) return [];
    const participants = rd.participants || [];
    return Object.keys(rd.carLaps).map((idx) => {
      const n = +idx;
      const p = participants[n] || {};
      return {
        idx: n,
        name: p.name || `Car ${n}`,
        teamId: p.teamId ?? 255,
      };
    });
  }, [rd]);

  const [driverA, setDriverA] = useState<number>(() =>
    drivers.length > 0 ? drivers[0].idx : 0,
  );
  const [driverB, setDriverB] = useState<number>(() =>
    drivers.length > 1 ? drivers[1].idx : 0,
  );

  const chartData = useMemo(() => {
    if (!rd?.carLaps) return null;
    const lapsA = rd.carLaps[driverA] || [];
    const lapsB = rd.carLaps[driverB] || [];
    const participants = rd.participants || [];
    const pA = participants[driverA] || {};
    const pB = participants[driverB] || {};

    const maxLap = Math.max(lapsA.length, lapsB.length);
    if (maxLap < 1 || lapsA.length === 0 || lapsB.length === 0) return null;

    const xData = Array.from({ length: maxLap }, (_, i) => i + 1);
    let cumA = 0;
    let cumB = 0;
    const deltaData: (number | null)[] = new Array(maxLap).fill(null);
    for (let i = 0; i < maxLap; i++) {
      const tA = lapsA[i]?.lapTimeMs || 0;
      const tB = lapsB[i]?.lapTimeMs || 0;
      if (tA > 0) cumA += tA;
      if (tB > 0) cumB += tB;
      if (cumA > 0 && cumB > 0)
        deltaData[i] = +((cumA - cumB) / 1000).toFixed(2);
    }

    return {
      title: `${pA.name || 'A'} vs ${pB.name || 'B'} (cumulative delta)`,
      data: [xData, deltaData] as uPlot.AlignedData,
      aName: pA.name || 'A',
      bName: pB.name || 'B',
    };
  }, [rd, driverA, driverB]);

  const handleDriverAChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setDriverA(parseInt(e.target.value, 10));
    },
    [],
  );

  const handleDriverBChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setDriverB(parseInt(e.target.value, 10));
    },
    [],
  );

  if (!isRace || !rd?.carLaps || Object.keys(rd.carLaps).length < 2) {
    return null;
  }

  // Title is rendered as a React heading (below) instead of as a uPlot
  // option, because uPlot's title is baked in at chart creation — setData()
  // can't hot-swap it. Series label includes the driver names so the
  // uPlot legend reflects the current selection.
  const seriesLabel = chartData
    ? `${chartData.aName} − ${chartData.bName}`
    : 'Delta';
  const options: Partial<uPlot.Options> = {
    scales: { x: { time: false } },
    axes: [
      { label: 'Lap', stroke: '#888', grid: { stroke: '#333' } },
      {
        label: 'Delta (s)',
        stroke: '#888',
        grid: { stroke: '#222' },
        values: (_, vs) =>
          vs.map((v) =>
            v != null ? (v > 0 ? '+' : '') + Number(v).toFixed(1) : '',
          ),
      },
    ],
    series: [{}, { label: seriesLabel, stroke: '#f0f0f0', width: 2 }],
  };

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className="section-label">DRIVER COMPARISON</span>
        <select
          className="settings-select"
          value={driverA}
          onChange={handleDriverAChange}
        >
          {drivers.map((d) => (
            <option key={d.idx} value={d.idx}>
              {d.name}
            </option>
          ))}
        </select>
        <span className={styles.vsLabel}>vs</span>
        <select
          className="settings-select"
          value={driverB}
          onChange={handleDriverBChange}
        >
          {drivers.map((d) => (
            <option key={d.idx} value={d.idx}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      {chartData && (
        <div className={styles.chartBox}>
          <div
            style={{
              fontFamily: 'var(--font-d)',
              fontSize: '0.6rem',
              letterSpacing: '0.05em',
              color: 'var(--white)',
              textAlign: 'center',
              marginBottom: '0.3rem',
            }}
          >
            {chartData.title}
          </div>
          <UPlotChart
            options={options}
            data={chartData.data}
            height={200}
          />
        </div>
      )}
    </div>
  );
}

export default React.memo(DriverComparison);
