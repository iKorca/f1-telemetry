import React, { useMemo, useCallback } from 'react';
import type { SessionDetail } from '@shared/types';
import UPlotChart from '@/components/common/UPlotChart';
import MiniSectors from '@/components/shared/MiniSectors';
import CoachingHints from '@/components/shared/CoachingHints';
import { findBestLapIndex, getFramesForLap } from '@/lib/lapUtils';
import { findSectorBoundariesByTime, sectorOverlayPluginTime, resampleByTime } from '@/lib/chartUtils';
import type uPlot from 'uplot';
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
  const sectorPlugin = sectorOverlayPluginTime(sectorTimes, {
    lineWidth: 1,
    lineDash: [4, 4],
  });

  const hasCmp = cmpFrames && cmpFrames.length > 1;

  // Speed chart
  const speedOpts: Partial<uPlot.Options> = {
    series: [
      {},
      { label: 'Speed', stroke: '#f0f0f0', width: 2 },
      ...(hasCmp ? [{ label: 'Compare', stroke: '#3b82f6', width: 1.5 } as uPlot.Series] : []),
    ],
    axes: [{ show: false }, { label: 'km/h' }],
    scales: { x: { time: false } },
  };
  const speedData: uPlot.AlignedData = [
    xData,
    frames.map((f) => f.s),
    ...(hasCmp ? [resampleByTime(xData, cTimes, cmpFrames!.map((f) => f.s))] : []),
  ];

  // Throttle/Brake chart
  const inputOpts: Partial<uPlot.Options> = {
    series: [
      {},
      { label: 'Throttle', stroke: '#39d353', width: 2 },
      { label: 'Brake', stroke: '#e8002d', width: 2 },
      ...(hasCmp
        ? [
            { label: 'Throttle (cmp)', stroke: 'rgba(57,211,83,0.4)', width: 1 } as uPlot.Series,
            { label: 'Brake (cmp)', stroke: 'rgba(232,0,45,0.4)', width: 1 } as uPlot.Series,
          ]
        : []),
    ],
    axes: [{ show: false }, { label: '%' }],
    scales: { x: { time: false } },
  };
  const inputData: uPlot.AlignedData = [
    xData,
    frames.map((f) => f.th),
    frames.map((f) => f.br),
    ...(hasCmp
      ? [
          resampleByTime(xData, cTimes, cmpFrames!.map((f) => f.th)),
          resampleByTime(xData, cTimes, cmpFrames!.map((f) => f.br)),
        ]
      : []),
  ];

  // Gear chart
  const gearOpts: Partial<uPlot.Options> = {
    series: [
      {},
      { label: 'Gear', stroke: '#f5c518', width: 2 },
      ...(hasCmp ? [{ label: 'Compare', stroke: '#3b82f6', width: 1.5 } as uPlot.Series] : []),
    ],
    axes: [{ show: false }, { label: 'Gear' }],
    scales: { x: { time: false } },
  };
  const gearData: uPlot.AlignedData = [
    xData,
    frames.map((f) => f.g),
    ...(hasCmp ? [resampleByTime(xData, cTimes, cmpFrames!.map((f) => f.g))] : []),
  ];

  // Delta chart (time difference)
  const deltaOpts: Partial<uPlot.Options> | null = hasCmp
    ? {
        series: [
          {},
          {
            label: 'Delta',
            stroke: '#f0f0f0',
            width: 2,
            fill: (u: uPlot, idx: number) => {
              const v = u.data[idx] as number[];
              const last = v[v.length - 1];
              return last > 0 ? 'rgba(232,0,45,0.15)' : 'rgba(57,211,83,0.15)';
            },
          },
        ],
        axes: [{ show: false }, { label: 'Delta (s)' }],
        scales: { x: { time: false } },
      }
    : null;
  const deltaData: uPlot.AlignedData | null = hasCmp
    ? (() => {
        const cmpResampled = resampleByTime(xData, cTimes, cTimes);
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
