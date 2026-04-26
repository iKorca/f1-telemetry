import React, { useMemo } from 'react';
import type { PracticeRun, PracticeRunLap } from '@shared/types';
import { usePracticeStore } from '@/store/practiceStore';
import { fmtTime } from '@/lib/formatters';
import ChartEmpty from '@/components/common/ChartEmpty';
import styles from './PracticeTab.module.css';

interface LapCompareProps {
  runs: PracticeRun[];
}

const REF_COLOR = '#3b82f6';
const CMP_COLOR = '#f59e0b';

/**
 * Side-by-side scalar comparison of the two pinned laps — pair with the
 * DeltaTelemetry chart which shows per-frame traces. This shows the *per-lap*
 * aggregates: lap time, sectors, max speed, fuel, avg throttle/brake, tyre
 * wear, brake temp, pressures, ERS battery.
 *
 * Accepts any lap from any run, not just within the same stint.
 */
export default function LapCompare({ runs }: LapCompareProps) {
  const refRunId = usePracticeStore((s) => s.referenceRunId);
  const refLapNum = usePracticeStore((s) => s.referenceLapNum);
  const cmpRunId = usePracticeStore((s) => s.comparisonRunId);
  const cmpLapNum = usePracticeStore((s) => s.comparisonLapNum);
  const workbook = usePracticeStore((s) => s.workbook);

  const refPair = useMemo(() => {
    if (!refRunId || refLapNum == null) return null;
    // Try selected runs first, fall back to the full workbook so the compare
    // panel works even when the source run is unchecked in the sidebar.
    const run = runs.find((r) => r.id === refRunId)
      ?? workbook?.runs.find((r) => r.id === refRunId) ?? null;
    if (!run?.laps) return null;
    const lap = run.laps.find((l) => l.lapNum === refLapNum);
    return lap ? { run, lap } : null;
  }, [refRunId, refLapNum, runs, workbook]);

  const cmpPair = useMemo(() => {
    if (!cmpRunId || cmpLapNum == null) return null;
    const run = runs.find((r) => r.id === cmpRunId)
      ?? workbook?.runs.find((r) => r.id === cmpRunId) ?? null;
    if (!run?.laps) return null;
    const lap = run.laps.find((l) => l.lapNum === cmpLapNum);
    return lap ? { run, lap } : null;
  }, [cmpRunId, cmpLapNum, runs, workbook]);

  if (!refPair || !cmpPair) {
    return (
      <div>
        <div className={styles.sectionTitle}>LAP COMPARE</div>
        <ChartEmpty
          message="Pin one REF lap and one CMP lap to compare"
          hint="REF and CMP can be any lap from any run"
        />
      </div>
    );
  }

  const rows: Array<{
    label: string;
    get: (l: PracticeRunLap) => number | null;
    fmt: (v: number) => string;
    lowerIsBetter: boolean;
  }> = [
    { label: 'Lap time', get: (l) => l.lapTimeMs, fmt: fmtTime, lowerIsBetter: true },
    { label: 'S1', get: (l) => l.s1Ms, fmt: fmtTime, lowerIsBetter: true },
    { label: 'S2', get: (l) => l.s2Ms, fmt: fmtTime, lowerIsBetter: true },
    { label: 'S3', get: (l) => l.s3Ms, fmt: fmtTime, lowerIsBetter: true },
    { label: 'Max speed', get: (l) => l.maxSpeed, fmt: (v) => `${Math.round(v)} km/h`, lowerIsBetter: false },
    { label: 'Avg throttle', get: (l) => l.avgThrottle, fmt: (v) => `${Math.round(v * 100)}%`, lowerIsBetter: false },
    { label: 'Avg brake', get: (l) => l.avgBrake, fmt: (v) => `${Math.round(v * 100)}%`, lowerIsBetter: true },
    { label: 'Fuel burned', get: (l) => l.fuel, fmt: (v) => `${v.toFixed(2)} kg`, lowerIsBetter: true },
    { label: 'Tyre age', get: (l) => l.tyreAge, fmt: (v) => `${Math.round(v)}`, lowerIsBetter: true },
    {
      label: 'Avg wear (end)',
      get: (l) => {
        const w = (l.tyreWear || []).filter((v) => v > 0);
        return w.length > 0 ? w.reduce((a, b) => a + b, 0) / w.length : null;
      },
      fmt: (v) => `${v.toFixed(1)}%`,
      lowerIsBetter: true,
    },
    {
      label: 'Avg brake temp',
      get: (l) => {
        const w = (l.avgBrakeTemp || []).filter((v) => v > 0);
        return w.length > 0 ? w.reduce((a, b) => a + b, 0) / w.length : null;
      },
      fmt: (v) => `${Math.round(v)}°C`,
      lowerIsBetter: true,
    },
    {
      label: 'Avg tyre inner',
      get: (l) => {
        const w = (l.avgInnerTemp || []).filter((v) => v > 0);
        return w.length > 0 ? w.reduce((a, b) => a + b, 0) / w.length : null;
      },
      fmt: (v) => `${Math.round(v)}°C`,
      lowerIsBetter: false,
    },
    {
      label: 'Avg pressure',
      get: (l) => {
        const w = (l.avgPressure || []).filter((v) => v > 0);
        return w.length > 0 ? w.reduce((a, b) => a + b, 0) / w.length : null;
      },
      fmt: (v) => `${v.toFixed(2)} psi`,
      lowerIsBetter: true,
    },
    { label: 'Battery %', get: (l) => l.avgBatteryPct ?? null, fmt: (v) => `${Math.round(v)}%`, lowerIsBetter: false },
    { label: 'ERS deployed', get: (l) => l.ersDeployedMJ ?? null, fmt: (v) => `${v.toFixed(2)} MJ`, lowerIsBetter: false },
    { label: 'ERS harvested', get: (l) => l.ersHarvestedMJ ?? null, fmt: (v) => `${v.toFixed(2)} MJ`, lowerIsBetter: false },
    { label: 'Track temp', get: (l) => (l.trackTemp ?? null), fmt: (v) => `${Math.round(v)}°C`, lowerIsBetter: false },
    { label: 'Air temp', get: (l) => (l.airTemp ?? null), fmt: (v) => `${Math.round(v)}°C`, lowerIsBetter: false },
  ];

  const deltaLabel = `L${refLapNum} - L${cmpLapNum}`;

  return (
    <div>
      <div className={styles.sectionTitle}>
        LAP COMPARE
        <span style={{ marginLeft: '0.5rem', fontWeight: 400, fontSize: '0.5rem', color: 'var(--grey-light)' }}>
          <span style={{ color: REF_COLOR }}>
            {refPair.run.label || refPair.run.compound} L{refLapNum}
          </span>
          {' vs '}
          <span style={{ color: CMP_COLOR }}>
            {cmpPair.run.label || cmpPair.run.compound} L{cmpLapNum}
          </span>
        </span>
      </div>
      <div
        className={styles.comparisonGrid}
        style={{ gridTemplateColumns: '160px minmax(110px, 1fr) minmax(110px, 1fr) minmax(100px, 1fr)' }}
      >
        <div className={styles.comparisonLabel}>Metric</div>
        <div className={styles.comparisonLabel} style={{ textAlign: 'center', color: REF_COLOR }}>REF</div>
        <div className={styles.comparisonLabel} style={{ textAlign: 'center', color: CMP_COLOR }}>CMP</div>
        <div className={styles.comparisonLabel} style={{ textAlign: 'center' }} title={deltaLabel}>Δ</div>

        {rows.map((row) => {
          const r = row.get(refPair.lap);
          const c = row.get(cmpPair.lap);
          const rStr = r == null ? '\u2014' : row.fmt(r);
          const cStr = c == null ? '\u2014' : row.fmt(c);
          let dStr = '\u2014';
          let dColor: string | undefined;
          if (r != null && c != null && r !== 0 && c !== 0) {
            const diff = c - r;
            // For sector / lap times, show as ms with sign; else raw diff.
            const isTime = row.label === 'Lap time' || row.label.startsWith('S');
            if (isTime) {
              dStr = `${diff >= 0 ? '+' : ''}${(diff / 1000).toFixed(3)} s`;
            } else {
              dStr = `${diff >= 0 ? '+' : ''}${typeof diff === 'number' ? diff.toFixed(2) : diff}`;
            }
            if (Math.abs(diff) > 0.0001) {
              const cmpBetter = row.lowerIsBetter ? diff < 0 : diff > 0;
              dColor = cmpBetter ? 'var(--green)' : 'var(--red)';
            }
          }
          return (
            <React.Fragment key={row.label}>
              <div className={styles.comparisonLabel}>{row.label}</div>
              <div className={styles.comparisonValue}>{rStr}</div>
              <div className={styles.comparisonValue}>{cStr}</div>
              <div className={styles.comparisonValue} style={{ color: dColor, fontWeight: dColor ? 700 : undefined }}>
                {dStr}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
