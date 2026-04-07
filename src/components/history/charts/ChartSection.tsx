import React, { useMemo, useState, useCallback } from 'react';
import type { SessionDetail, TelemetryFrame } from '@shared/types';
import UPlotChart from '@/components/common/UPlotChart';
import MiniSectors from '@/components/shared/MiniSectors';
import CoachingHints from '@/components/shared/CoachingHints';
import VarianceOverlay from '../analysis/VarianceOverlay';
import { getFramesForLap } from '@/lib/lapUtils';
import { findSectorBoundariesByTime, sectorOverlayPluginTime, normaliseTimes, resampleByPosition } from '@/lib/chartUtils';
import type uPlot from 'uplot';
import styles from './ChartSection.module.css';

interface ChartSectionProps {
  session: SessionDetail;
  selectedLapIdx: number;
  compareLapIdx: number | null;
  onLapChange: (lapIdx: number) => void;
  onCompareChange: (lapIdx: number | null) => void;
  onClose: () => void;
}

function ChartSection({
  session,
  selectedLapIdx,
  compareLapIdx,
  onLapChange,
  onCompareChange,
  onClose,
}: ChartSectionProps) {
  const [showVariance, setShowVariance] = useState(false);

  const lapOptions = useMemo(() => {
    return (session.laps || [])
      .map((l, i) => {
        let label = `Lap ${l.lapNum}`;
        if (l.valid === false) label += ' (invalid)';
        if (l.isOutLap) label += ' (out lap)';
        if (l.isPitLap) label += ' (pit lap)';
        return { label, idx: i, deleted: l.deleted };
      })
      .filter((o) => !o.deleted);
  }, [session.laps]);

  const { frames, cmpFrames, sectorPlugin } = useMemo(() => {
    const lap = session.laps[selectedLapIdx];
    if (!lap)
      return { frames: [], cmpFrames: null, sectorPlugin: {} as uPlot.Plugin };
    const f = getFramesForLap(session, selectedLapIdx);
    const si = findSectorBoundariesByTime(f, lap);
    const sp = sectorOverlayPluginTime(si, {
      colors: ['rgba(160, 32, 240, 0.4)', 'rgba(255, 215, 0, 0.4)'],
    });

    let cf: TelemetryFrame[] | null = null;
    if (
      compareLapIdx !== null &&
      session.laps[compareLapIdx]
    ) {
      const rawCf = getFramesForLap(session, compareLapIdx);
      if (rawCf.length >= 2) cf = rawCf;
    }
    return { frames: f, cmpFrames: cf, sectorPlugin: sp };
  }, [session, selectedLapIdx, compareLapIdx]);

  // Format ms as M:SS.mmm
  const fmtMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const milli = Math.floor(ms % 1000);
    return `${m}:${String(sec).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
  };

  // X-series config — shows time in legend
  const xSer: uPlot.Series = {
    value: (_u: uPlot, v: number) => v != null ? fmtMs(v) : '--',
  };

  // Normalise lap times to [0..1] for alignment, but use actual time for x-axis display
  const pTimes = useMemo(() => frames.map((f) => f.t), [frames]);
  const cTimes = useMemo(() => cmpFrames?.map((f) => f.t) ?? [], [cmpFrames]);
  const pNorm = useMemo(() => normaliseTimes(pTimes), [pTimes]);
  const cNorm = useMemo(() => normaliseTimes(cTimes), [cTimes]);

  // Speed chart
  const speedData = useMemo(() => {
    if (frames.length < 2) return null;
    const series: uPlot.Series[] = [
      xSer,
      { label: 'Speed', stroke: '#f0f0f0', width: 1.5, value: (_u: uPlot, v: number) => v != null ? Math.round(v) + ' km/h' : '--' },
    ];
    const data: uPlot.AlignedData = [pTimes, frames.map((f) => f.s)];
    if (cmpFrames && cmpFrames.length > 1) {
      const cmpY = resampleByPosition(pNorm, cNorm, cmpFrames.map((f) => f.s));
      series.push({ label: 'Compare', stroke: '#3b82f6', width: 1.5, value: (_u: uPlot, v: number) => v != null ? Math.round(v) + ' km/h' : '--' });
      data.push(cmpY);
    }
    return { series, data };
  }, [frames, cmpFrames, pTimes, cTimes]);

  // Throttle/Brake chart
  const inputsData = useMemo(() => {
    if (frames.length < 2) return null;
    const series: uPlot.Series[] = [
      xSer,
      { label: 'Throttle', stroke: '#39d353', width: 1.5, value: (_u: uPlot, v: number) => v != null ? Math.round(v) + '%' : '--' },
      { label: 'Brake', stroke: '#e8002d', width: 1.5, value: (_u: uPlot, v: number) => v != null ? Math.round(v) + '%' : '--' },
    ];
    const data: uPlot.AlignedData = [
      pTimes,
      frames.map((f) => f.th),
      frames.map((f) => f.br),
    ];
    if (cmpFrames && cmpFrames.length > 1) {
      const cmpTh = resampleByPosition(pNorm, cNorm, cmpFrames.map((f) => f.th));
      const cmpBr = resampleByPosition(pNorm, cNorm, cmpFrames.map((f) => f.br));
      series.push(
        { label: 'Throttle (cmp)', stroke: 'rgba(57,211,83,0.4)', width: 1, value: (_u: uPlot, v: number) => v != null ? Math.round(v) + '%' : '--' },
        { label: 'Brake (cmp)', stroke: 'rgba(232,0,45,0.4)', width: 1, value: (_u: uPlot, v: number) => v != null ? Math.round(v) + '%' : '--' },
      );
      data.push(cmpTh, cmpBr);
    }
    return { series, data };
  }, [frames, cmpFrames, pTimes, cTimes]);

  // Gear chart
  const gearData = useMemo(() => {
    if (frames.length < 2) return null;
    const series: uPlot.Series[] = [
      xSer,
      { label: 'Gear', stroke: '#f5c518', width: 1.5, value: (_u: uPlot, v: number) => v != null ? String(Math.round(v)) : '--' },
    ];
    const data: uPlot.AlignedData = [pTimes, frames.map((f) => f.g)];
    if (cmpFrames && cmpFrames.length > 1) {
      const cmpG = resampleByPosition(pNorm, cNorm, cmpFrames.map((f) => f.g));
      series.push({ label: 'Gear (cmp)', stroke: '#3b82f6', width: 1.5, value: (_u: uPlot, v: number) => v != null ? String(Math.round(v)) : '--' });
      data.push(cmpG);
    }
    return { series, data };
  }, [frames, cmpFrames, pTimes, cTimes]);

  // Delta chart (time difference: positive = slower, negative = faster)
  const deltaData = useMemo(() => {
    if (frames.length < 2 || !cmpFrames || cmpFrames.length < 2)
      return null;
    const cmpResampled = resampleByPosition(pNorm, cNorm, cTimes);
    const pStart = pTimes[0];
    const cStart = cTimes[0];
    const delta = pTimes.map(
      (t, i) => ((t - pStart) - (cmpResampled[i] - cStart)) / 1000,
    );
    return {
      series: [
        xSer,
        {
          label: 'Delta',
          stroke: '#f0f0f0',
          width: 1.5,
          value: (_u: uPlot, v: number) => v != null ? (v >= 0 ? '+' : '') + v.toFixed(3) + 's' : '--',
          fill: (u: uPlot, _si: number) => {
            const grad = u.ctx.createLinearGradient(0, u.bbox.top, 0, u.bbox.top + u.bbox.height);
            grad.addColorStop(0, 'rgba(232,0,45,0.2)');
            grad.addColorStop(0.5, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(57,211,83,0.2)');
            return grad;
          },
        },
      ] as uPlot.Series[],
      data: [pTimes, delta] as uPlot.AlignedData,
    };
  }, [frames, cmpFrames, pTimes, cTimes]);

  const handleLapSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onLapChange(parseInt(e.target.value, 10));
    },
    [onLapChange],
  );

  const handleCompareSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (val === '') {
        onCompareChange(null);
      } else {
        onCompareChange(parseInt(val, 10));
      }
    },
    [onCompareChange],
  );

  if (frames.length < 2) return null;

  const chartOpts: Partial<uPlot.Options> = {
    scales: { x: { time: false } },
    axes: [
      {
        stroke: '#555575',
        grid: { stroke: '#1c1c2e' },
        values: (_u: uPlot, vals: number[]) => vals.map(fmtMs),
      },
      { stroke: '#555575', grid: { stroke: '#1c1c2e' } },
    ],
    cursor: {
      show: true,
      sync: { key: 'history-charts', setSeries: true },
      focus: { prox: 30 },
    },
    legend: { live: true },
  };

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className="section-label">TELEMETRY CHARTS</span>
        <select
          className="settings-select"
          value={selectedLapIdx}
          onChange={handleLapSelect}
        >
          {lapOptions.map((o) => (
            <option key={o.idx} value={o.idx}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="settings-select"
          value={compareLapIdx ?? ''}
          onChange={handleCompareSelect}
        >
          <option value="">Compare with...</option>
          {lapOptions.map((o) => (
            <option key={o.idx} value={o.idx}>
              {o.label}
            </option>
          ))}
        </select>
        <button className="btn btn-small" onClick={onClose}>
          Close Charts
        </button>
        <button
          className="btn btn-small"
          onClick={() => setShowVariance((v) => !v)}
        >
          {showVariance ? 'Hide All Laps' : 'Show All Laps'}
        </button>
      </div>

      {showVariance ? (
        <VarianceOverlay session={session} />
      ) : (
        <>
          {speedData && (
            <div className={styles.chartBox}>
              <UPlotChart
                options={{
                  ...chartOpts,
                  series: speedData.series,
                }}
                data={speedData.data}
                height={200}
                plugins={[sectorPlugin]}
              />
            </div>
          )}
          {inputsData && (
            <div className={styles.chartBox}>
              <UPlotChart
                options={{
                  ...chartOpts,
                  series: inputsData.series,
                }}
                data={inputsData.data}
                height={180}
                plugins={[sectorPlugin]}
              />
            </div>
          )}
          {gearData && (
            <div className={styles.chartBox}>
              <UPlotChart
                options={{
                  ...chartOpts,
                  series: gearData.series,
                }}
                data={gearData.data}
                height={140}
                plugins={[sectorPlugin]}
              />
            </div>
          )}
          {deltaData && (
            <div className={styles.chartBox}>
              <UPlotChart
                options={{
                  ...chartOpts,
                  series: deltaData.series,
                }}
                data={deltaData.data}
                height={150}
              />
            </div>
          )}
        </>
      )}

      <MiniSectors
        session={session}
        lapIdx={selectedLapIdx}
        compareLapIdx={compareLapIdx}
      />
      <CoachingHints session={session} lapIdx={selectedLapIdx} />
    </div>
  );
}

export default React.memo(ChartSection);
