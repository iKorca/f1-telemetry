import React, { useMemo, useState, useCallback } from 'react';
import type { SessionDetail, TelemetryFrame } from '@shared/types';
import UPlotChart from '@/components/common/UPlotChart';
import MiniSectors from '@/components/shared/MiniSectors';
import CoachingHints from '@/components/shared/CoachingHints';
import VarianceOverlay from '../analysis/VarianceOverlay';
import { getFramesForLap } from '@/lib/lapUtils';
import { findSectorBoundaries, sectorOverlayPlugin, resampleToLength } from '@/lib/chartUtils';
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
      .map((l, i) => ({ label: `Lap ${l.lapNum}`, idx: i, deleted: l.deleted }))
      .filter((o) => !o.deleted);
  }, [session.laps]);

  const { frames, cmpFrames, sectorPlugin } = useMemo(() => {
    const lap = session.laps[selectedLapIdx];
    if (!lap)
      return { frames: [], cmpFrames: null, sectorPlugin: {} as uPlot.Plugin };
    const f = getFramesForLap(session, selectedLapIdx);
    const si = findSectorBoundaries(f, lap);
    const sp = sectorOverlayPlugin(si, {
      colors: ['rgba(160, 32, 240, 0.4)', 'rgba(255, 215, 0, 0.4)'],
    });

    let cf: TelemetryFrame[] | null = null;
    if (
      compareLapIdx !== null &&
      session.laps[compareLapIdx]
    ) {
      cf = getFramesForLap(session, compareLapIdx);
    }
    return { frames: f, cmpFrames: cf, sectorPlugin: sp };
  }, [session, selectedLapIdx, compareLapIdx]);

  // Speed chart
  const speedData = useMemo(() => {
    if (frames.length < 2) return null;
    const x = frames.map((_, i) => i);
    const y = frames.map((f) => f.s);
    const series: uPlot.Series[] = [
      {},
      { label: 'Speed', stroke: '#f0f0f0', width: 1.5 },
    ];
    const data: uPlot.AlignedData = [x, y];
    if (cmpFrames && cmpFrames.length > 1) {
      const cmpY = resampleToLength(
        cmpFrames.map((f) => f.s),
        x.length,
      );
      series.push({ label: 'Compare', stroke: '#3b82f6', width: 1.5 });
      data.push(cmpY);
    }
    return { series, data };
  }, [frames, cmpFrames]);

  // Throttle/Brake chart
  const inputsData = useMemo(() => {
    if (frames.length < 2) return null;
    const x = frames.map((_, i) => i);
    const series: uPlot.Series[] = [
      {},
      { label: 'Throttle', stroke: '#39d353', width: 1.5 },
      { label: 'Brake', stroke: '#e8002d', width: 1.5 },
    ];
    const data: uPlot.AlignedData = [
      x,
      frames.map((f) => f.th),
      frames.map((f) => f.br),
    ];
    if (cmpFrames && cmpFrames.length > 1) {
      const cmpTh = resampleToLength(
        cmpFrames.map((f) => f.th),
        x.length,
      );
      const cmpBr = resampleToLength(
        cmpFrames.map((f) => f.br),
        x.length,
      );
      series.push(
        {
          label: 'Throttle (cmp)',
          stroke: 'rgba(57,211,83,0.4)',
          width: 1,
        },
        { label: 'Brake (cmp)', stroke: 'rgba(232,0,45,0.4)', width: 1 },
      );
      data.push(cmpTh, cmpBr);
    }
    return { series, data };
  }, [frames, cmpFrames]);

  // Gear chart
  const gearData = useMemo(() => {
    if (frames.length < 2) return null;
    const x = frames.map((_, i) => i);
    const series: uPlot.Series[] = [
      {},
      { label: 'Gear', stroke: '#f5c518', width: 1.5 },
    ];
    const data: uPlot.AlignedData = [x, frames.map((f) => f.g)];
    if (cmpFrames && cmpFrames.length > 1) {
      const cmpG = resampleToLength(
        cmpFrames.map((f) => f.g),
        x.length,
      );
      series.push({ label: 'Gear (cmp)', stroke: '#3b82f6', width: 1.5 });
      data.push(cmpG);
    }
    return { series, data };
  }, [frames, cmpFrames]);

  // Delta chart
  const deltaData = useMemo(() => {
    if (frames.length < 2 || !cmpFrames || cmpFrames.length < 2)
      return null;
    const resampled = resampleToLength(
      cmpFrames.map((f) => f.t),
      frames.length,
    );
    const x = frames.map((_, i) => i);
    const baseTimes = frames.map((f) => f.t);
    const delta = baseTimes.map(
      (t, i) => ((t - baseTimes[0]) - (resampled[i] - resampled[0])) / 1000,
    );
    return {
      series: [
        {},
        {
          label: 'Delta',
          stroke: '#f0f0f0',
          width: 1.5,
          fill: (u: uPlot, _si: number) => {
            const grad = u.ctx.createLinearGradient(0, u.bbox.top, 0, u.bbox.top + u.bbox.height);
            grad.addColorStop(0, 'rgba(232,0,45,0.2)');
            grad.addColorStop(0.5, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(57,211,83,0.2)');
            return grad;
          },
        },
      ] as uPlot.Series[],
      data: [x, delta] as uPlot.AlignedData,
    };
  }, [frames, cmpFrames]);

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
      { show: false },
      { stroke: '#555575', grid: { stroke: '#1c1c2e' } },
    ],
    cursor: { show: true },
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
