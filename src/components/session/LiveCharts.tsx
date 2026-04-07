import React, { useMemo, useCallback } from 'react';
import type { SessionDetail } from '@shared/types';
import UPlotChart from '@/components/common/UPlotChart';
import MiniSectors from '@/components/shared/MiniSectors';
import CoachingHints from '@/components/shared/CoachingHints';
import { findBestLapIndex, getFramesForLap } from '@/lib/lapUtils';
import { findSectorBoundariesByTime, sectorOverlayPluginTime, normaliseTimes, resampleByPosition } from '@/lib/chartUtils';
import uPlot from 'uplot';
import styles from './LiveCharts.module.css';

interface LiveChartsProps {
  session: SessionDetail;
  selectedLap: number | null;
  compareLap: number | null;
  onLapChange: (lapIdx: number) => void;
  onCompareChange: (lapIdx: number | null) => void;
  onClose: () => void;
}

function LiveCharts({
  session,
  selectedLap,
  compareLap,
  onLapChange,
  onCompareChange,
  onClose,
}: LiveChartsProps) {
  const laps = session.laps || [];

  // Find best lap index for select labels
  const bestIdx = useMemo(() => findBestLapIndex(laps), [laps]);

  const chartData = useMemo(() => {
    if (selectedLap === null) return null;
    const lap = laps[selectedLap];
    if (!lap) return null;

    const frames = getFramesForLap(session, selectedLap);
    if (frames.length < 2) return null;

    const xData = frames.map((f) => f.t);
    const sectorTimes = findSectorBoundariesByTime(frames, lap);

    let cmpFrames: typeof frames | null = null;
    if (compareLap !== null && laps[compareLap]) {
      const rawCmp = getFramesForLap(session, compareLap);
      if (rawCmp.length >= 2) cmpFrames = rawCmp;
    }

    return { frames, xData, sectorTimes, cmpFrames };
  }, [session, selectedLap, compareLap, laps]);

  const handleLapSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onLapChange(parseInt(e.target.value, 10));
    },
    [onLapChange],
  );

  const handleCompareSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      onCompareChange(v === '' ? null : parseInt(v, 10));
    },
    [onCompareChange],
  );

  if (selectedLap === null || !chartData) return null;

  const { frames, xData, sectorTimes, cmpFrames } = chartData;
  const cTimes = cmpFrames?.map((f) => f.t) ?? [];
  const pNorm = normaliseTimes(xData);
  const cNorm = normaliseTimes(cTimes);
  const sectorPlugin = sectorOverlayPluginTime(sectorTimes, {
    lineWidth: 1,
    lineDash: [4, 4],
  });

  const hasCmp = cmpFrames && cmpFrames.length > 1;

  // Format ms as M:SS.mmm for axis and legend
  const fmtLapTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const milli = Math.floor(ms % 1000);
    return `${m}:${String(sec).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
  };

  // X-series: shows time in legend
  const xSer: uPlot.Series = {
    value: (_u: uPlot, v: number) => v != null ? fmtLapTime(v) : '--',
  };

  // Shared chart config: time x-axis + synced cursor
  const sharedAxes: uPlot.Axis[] = [
    {
      stroke: '#555575',
      grid: { stroke: '#1c1c2e' },
      values: (_u: uPlot, vals: number[]) => vals.map(fmtLapTime),
    },
    { stroke: '#555575', grid: { stroke: '#1c1c2e' } },
  ];
  const sharedCursor: uPlot.Cursor = {
    show: true,
    sync: { key: 'session-charts', setSeries: true },
  };

  // Speed chart
  const speedOpts: Partial<uPlot.Options> = {
    series: [
      xSer,
      { label: 'Speed', stroke: '#f0f0f0', width: 2, value: (_u: uPlot, v: number) => v != null ? Math.round(v) + ' km/h' : '--' },
      ...(hasCmp ? [{ label: 'Compare', stroke: '#3b82f6', width: 1.5, value: (_u: uPlot, v: number) => v != null ? Math.round(v) + ' km/h' : '--' } as uPlot.Series] : []),
    ],
    axes: sharedAxes,
    scales: { x: { time: false } },
    cursor: sharedCursor,
  };
  const speedData: uPlot.AlignedData = [
    xData,
    frames.map((f) => f.s),
    ...(hasCmp ? [resampleByPosition(pNorm, cNorm, cmpFrames!.map((f) => f.s))] : []),
  ];

  // Throttle/Brake chart
  const inputOpts: Partial<uPlot.Options> = {
    series: [
      xSer,
      { label: 'Throttle', stroke: '#39d353', width: 2, value: (_u: uPlot, v: number) => v != null ? Math.round(v) + '%' : '--' },
      { label: 'Brake', stroke: '#e8002d', width: 2, value: (_u: uPlot, v: number) => v != null ? Math.round(v) + '%' : '--' },
      ...(hasCmp
        ? [
            { label: 'Throttle (cmp)', stroke: 'rgba(57,211,83,0.4)', width: 1, value: (_u: uPlot, v: number) => v != null ? Math.round(v) + '%' : '--' } as uPlot.Series,
            { label: 'Brake (cmp)', stroke: 'rgba(232,0,45,0.4)', width: 1, value: (_u: uPlot, v: number) => v != null ? Math.round(v) + '%' : '--' } as uPlot.Series,
          ]
        : []),
    ],
    axes: sharedAxes,
    scales: { x: { time: false } },
    cursor: sharedCursor,
  };
  const inputData: uPlot.AlignedData = [
    xData,
    frames.map((f) => f.th),
    frames.map((f) => f.br),
    ...(hasCmp
      ? [
          resampleByPosition(pNorm, cNorm, cmpFrames!.map((f) => f.th)),
          resampleByPosition(pNorm, cNorm, cmpFrames!.map((f) => f.br)),
        ]
      : []),
  ];

  // Gear chart
  const gearOpts: Partial<uPlot.Options> = {
    series: [
      xSer,
      { label: 'Gear', stroke: '#f5c518', width: 2, value: (_u: uPlot, v: number) => v != null ? String(Math.round(v)) : '--' },
      ...(hasCmp ? [{ label: 'Compare', stroke: '#3b82f6', width: 1.5, value: (_u: uPlot, v: number) => v != null ? String(Math.round(v)) : '--' } as uPlot.Series] : []),
    ],
    axes: sharedAxes,
    scales: { x: { time: false } },
    cursor: sharedCursor,
  };
  const gearData: uPlot.AlignedData = [
    xData,
    frames.map((f) => f.g),
    ...(hasCmp ? [resampleByPosition(pNorm, cNorm, cmpFrames!.map((f) => f.g))] : []),
  ];

  // ERS / DRS chart
  const ersModeFmt = ['None', 'Medium', 'Hotlap', 'Overtake'];
  const ersOpts: Partial<uPlot.Options> = {
    series: [
      xSer,
      {
        label: 'ERS Battery %',
        stroke: '#3b82f6',
        width: 2,
        fill: 'rgba(59,130,246,0.15)',
        value: (_u: uPlot, v: number) => v != null ? Math.round(v) + '%' : '--',
      },
      {
        label: 'ERS Mode',
        stroke: '#f5c518',
        width: 2,
        paths: uPlot.paths!.stepped!({ align: 1 }) as uPlot.Series.PathBuilder,
        value: (_u: uPlot, v: number) => v != null ? ersModeFmt[Math.round(v)] || '--' : '--',
      },
      {
        label: 'DRS Active',
        stroke: '#39d353',
        width: 2,
        paths: uPlot.paths!.stepped!({ align: 1 }) as uPlot.Series.PathBuilder,
        value: (_u: uPlot, v: number) => v != null ? (v > 50 ? 'Active' : 'Off') : '--',
      },
      {
        label: 'DRS Available',
        stroke: '#facc15',
        width: 1,
        paths: uPlot.paths!.stepped!({ align: 1 }) as uPlot.Series.PathBuilder,
        fill: 'rgba(250,204,21,0.1)',
        value: (_u: uPlot, v: number) => v != null ? (v > 50 ? 'Available' : 'Off') : '--',
      },
      ...(hasCmp ? [{
        label: 'ERS Battery (cmp)',
        stroke: 'rgba(59,130,246,0.4)',
        width: 1,
        value: (_u: uPlot, v: number) => v != null ? Math.round(v) + '%' : '--',
      } as uPlot.Series] : []),
    ],
    axes: sharedAxes,
    scales: { x: { time: false } },
    cursor: sharedCursor,
  };
  const ersData: uPlot.AlignedData = [
    xData,
    frames.map((f) => f.er),
    frames.map((f) => (f.em ?? 0) * 33),
    frames.map((f) => f.d === 1 ? 100 : 0),
    frames.map((f) => (f.da ?? 0) === 1 && f.d !== 1 ? 100 : 0),
    ...(hasCmp ? [resampleByPosition(pNorm, cNorm, cmpFrames!.map((f) => f.er))] : []),
  ];

  // Delta chart (time difference)
  const deltaOpts: Partial<uPlot.Options> | null = hasCmp
    ? {
        series: [
          xSer,
          {
            label: 'Delta',
            stroke: '#f0f0f0',
            width: 2,
            value: (_u: uPlot, v: number) => v != null ? (v >= 0 ? '+' : '') + v.toFixed(3) + 's' : '--',
            fill: (u: uPlot, idx: number) => {
              const v = u.data[idx] as number[];
              const last = v[v.length - 1];
              return last > 0 ? 'rgba(232,0,45,0.15)' : 'rgba(57,211,83,0.15)';
            },
          },
        ],
        axes: sharedAxes,
        scales: { x: { time: false } },
        cursor: sharedCursor,
      }
    : null;
  const deltaData: uPlot.AlignedData | null = hasCmp
    ? (() => {
        const cmpResampled = resampleByPosition(pNorm, cNorm, cTimes);
        const pStart = xData[0];
        const cStart = cTimes[0];
        const delta = xData.map(
          (t, i) => ((t - pStart) - (cmpResampled[i] - cStart)) / 1000,
        );
        return [xData, delta] as uPlot.AlignedData;
      })()
    : null;

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className="section-label">TELEMETRY CHARTS</span>
        <select
          className={styles.select}
          value={selectedLap ?? ''}
          onChange={handleLapSelect}
        >
          {laps.map((l, i) =>
            l.deleted ? null : (
              <option value={i} key={i}>
                Lap {l.lapNum}
                {i === bestIdx ? ' (best)' : ''}
                {l.valid === false ? ' (invalid)' : ''}
                {l.isOutLap ? ' (out lap)' : ''}
                {l.isPitLap ? ' (pit lap)' : ''}
              </option>
            ),
          )}
        </select>
        <select
          className={styles.select}
          value={compareLap ?? ''}
          onChange={handleCompareSelect}
        >
          <option value="">Compare with...</option>
          {laps.map((l, i) =>
            l.deleted ? null : (
              <option value={i} key={i}>
                Lap {l.lapNum}
                {i === bestIdx ? ' (best)' : ''}
                {l.valid === false ? ' (invalid)' : ''}
                {l.isOutLap ? ' (out lap)' : ''}
                {l.isPitLap ? ' (pit lap)' : ''}
              </option>
            ),
          )}
        </select>
        <button className="btn-secondary" onClick={onClose}>
          Close Charts
        </button>
      </div>

      <div className={styles.chartWrap}>
        <UPlotChart
          options={speedOpts}
          data={speedData}
          height={180}
          plugins={[sectorPlugin]}
        />
      </div>
      <div className={styles.chartWrap}>
        <UPlotChart
          options={inputOpts}
          data={inputData}
          height={180}
          plugins={[sectorPlugin]}
        />
      </div>
      <div className={styles.chartWrap}>
        <UPlotChart
          options={gearOpts}
          data={gearData}
          height={140}
          plugins={[sectorPlugin]}
        />
      </div>
      <div className={styles.chartWrap}>
        <UPlotChart
          options={ersOpts}
          data={ersData}
          height={160}
          plugins={[sectorPlugin]}
        />
      </div>
      {deltaData && deltaOpts && (
        <div className={styles.chartWrap}>
          <UPlotChart
            options={deltaOpts}
            data={deltaData}
            height={140}
          />
        </div>
      )}

      <MiniSectors
        session={session}
        lapIdx={selectedLap}
        compareLapIdx={compareLap}
      />
      <CoachingHints session={session} lapIdx={selectedLap} />
    </div>
  );
}

export default React.memo(LiveCharts);
