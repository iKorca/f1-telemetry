import React, { useMemo, useCallback } from 'react';
import type { SessionDetail } from '@shared/types';
import UPlotChart from '@/components/common/UPlotChart';
import MiniSectors from '@/components/shared/MiniSectors';
import CoachingHints from '@/components/shared/CoachingHints';
import { findBestLapIndex, getFramesForLap } from '@/lib/lapUtils';
import { findSectorBoundaries, sectorOverlayPlugin } from '@/lib/chartUtils';
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

    const xData = frames.map((_, i) => i);
    const sectorIndices = findSectorBoundaries(frames, lap);

    let cmpFrames: typeof frames | null = null;
    let cmpX: number[] | null = null;
    if (compareLap !== null && laps[compareLap]) {
      const rawCmp = getFramesForLap(session, compareLap);
      if (rawCmp.length >= 2) {
        cmpFrames = rawCmp;
        cmpX = rawCmp.map((_, i) => i);
      }
    }

    return { frames, xData, sectorIndices, cmpFrames, cmpX };
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

  const { frames, xData, sectorIndices, cmpFrames, cmpX } = chartData;
  const sectorPlugin = sectorOverlayPlugin(sectorIndices, {
    lineWidth: 1,
    lineDash: [4, 4],
  });

  // Speed chart
  const speedOpts: Partial<uPlot.Options> = {
    series: [
      {},
      { label: 'Speed', stroke: '#f0f0f0', width: 2 },
      ...(cmpX ? [{ label: 'Compare', stroke: '#3b82f6', width: 1.5 }] : []),
    ],
    axes: [{ show: false }, { label: 'km/h' }],
    scales: { x: { time: false } },
  };
  const speedData: uPlot.AlignedData = [
    xData,
    frames.map((f) => f.s),
    ...(cmpFrames ? [cmpFrames.map((f) => f.s)] : []),
  ];

  // Throttle/Brake chart
  const inputOpts: Partial<uPlot.Options> = {
    series: [
      {},
      { label: 'Throttle', stroke: '#39d353', width: 2 },
      { label: 'Brake', stroke: '#e8002d', width: 2 },
      ...(cmpX
        ? [
            { label: 'Throttle (cmp)', stroke: 'rgba(57,211,83,0.4)', width: 1 },
            { label: 'Brake (cmp)', stroke: 'rgba(232,0,45,0.4)', width: 1 },
          ]
        : []),
    ],
    axes: [{ show: false }, { label: '%' }],
    scales: { x: { time: false } },
  };
  const inputData: uPlot.AlignedData = (() => {
    const base: (number | null | undefined)[][] = [
      xData,
      frames.map((f) => f.th),
      frames.map((f) => f.br),
    ];
    if (cmpFrames && cmpX) {
      // Pad compare series to same length as primary x-axis
      const padded = (arr: number[]) => {
        const out: (number | null)[] = new Array(xData.length).fill(null);
        arr.forEach((v, i) => {
          if (i < out.length) out[i] = v;
        });
        return out;
      };
      base.push(padded(cmpFrames.map((f) => f.th)));
      base.push(padded(cmpFrames.map((f) => f.br)));
    }
    return base as uPlot.AlignedData;
  })();

  // Gear chart
  const gearOpts: Partial<uPlot.Options> = {
    series: [
      {},
      { label: 'Gear', stroke: '#f5c518', width: 2 },
      ...(cmpX ? [{ label: 'Compare', stroke: '#3b82f6', width: 1.5 }] : []),
    ],
    axes: [{ show: false }, { label: 'Gear' }],
    scales: { x: { time: false } },
  };
  const gearData: uPlot.AlignedData = (() => {
    const base: (number | null | undefined)[][] = [
      xData,
      frames.map((f) => f.g),
    ];
    if (cmpFrames) {
      const padded: (number | null)[] = new Array(xData.length).fill(null);
      cmpFrames.forEach((f, i) => {
        if (i < padded.length) padded[i] = f.g;
      });
      base.push(padded);
    }
    return base as uPlot.AlignedData;
  })();

  // Delta chart (time difference)
  const deltaResult = useMemo(() => {
    if (!cmpFrames || cmpFrames.length < 2) return null;
    const len = Math.min(frames.length, cmpFrames.length);
    const dx = Array.from({ length: len }, (_, i) => i);
    const deltaY = dx.map((i) => (frames[i].t - frames[0].t - (cmpFrames![i].t - cmpFrames![0].t)) / 1000);
    return { dx, deltaY };
  }, [frames, cmpFrames]);

  const deltaOpts: Partial<uPlot.Options> | null = deltaResult
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
      {deltaResult && deltaOpts && (
        <div className={styles.chartWrap}>
          <UPlotChart
            options={deltaOpts}
            data={[deltaResult.dx, deltaResult.deltaY]}
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
