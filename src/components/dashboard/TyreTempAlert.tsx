import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTelemetryStore } from '@/store/telemetryStore';
import { useTimingStore } from '@/store/timingStore';
import { getTempWindow, tyreTempStatus } from '@/lib/tyreTemps';
import styles from './TyreTempAlert.module.css';

// F1 tyre array order: [RL=0, RR=1, FL=2, FR=3]
const WHEEL_LABELS = ['RL', 'RR', 'FL', 'FR'] as const;

/**
 * Sticky alert at the bottom of the dashboard for tyre-temp window breaches.
 *
 * Uses the same `tyreTempStatus` helper that the live TyreGrid uses, against
 * the current compound's carcass-temp window. We debounce briefly (≈1.5 s) to
 * avoid flashing the banner on a single frame of spike / dip — real thermal
 * drift happens over seconds, so debouncing kills noise without hiding
 * genuine warnings.
 */
export default function TyreTempAlert() {
  const innerTemps = useTelemetryStore(
    useShallow((s) => s.tyresInnerTemperature),
  );
  const compound = useTimingStore(
    (s) => s.allCarStatus?.playerData?.tyreCompoundName ?? '',
  );
  const window = useMemo(() => getTempWindow(compound), [compound]);

  // Instantaneous status per wheel
  const currentStatus = useMemo(() => {
    if (!window || !innerTemps) return null;
    return WHEEL_LABELS.map((label, idx) => {
      const temp = innerTemps[idx] ?? 0;
      return { label, temp: Math.round(temp), status: tyreTempStatus(temp, compound), window };
    });
  }, [innerTemps, compound, window]);

  // Debounced view — only flip the banner state when a status has held
  // steady for `HOLD_MS`. Every instantaneous change restarts the timer
  // for that wheel.
  const HOLD_MS = 1500;
  const [stableStatus, setStableStatus] = useState<typeof currentStatus>(null);
  const pendingRef = useRef<
    | { at: number; snapshot: NonNullable<typeof currentStatus> }
    | null
  >(null);

  useEffect(() => {
    if (!currentStatus) {
      setStableStatus(null);
      pendingRef.current = null;
      return;
    }
    const snapshot = currentStatus;
    const signature = snapshot.map((s) => s.status).join('|');
    const prevSignature = pendingRef.current
      ? pendingRef.current.snapshot.map((s) => s.status).join('|')
      : null;

    // Already-stable signature that matches the live one: accept immediately.
    if (stableStatus && stableStatus.map((s) => s.status).join('|') === signature) {
      return;
    }
    // New pending signature — start / restart the hold timer.
    if (prevSignature !== signature) {
      pendingRef.current = { at: Date.now(), snapshot };
    }
    const timer = setTimeout(() => {
      if (pendingRef.current && pendingRef.current.snapshot.map((s) => s.status).join('|') === signature) {
        setStableStatus(snapshot);
      }
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [currentStatus, stableStatus]);

  if (!stableStatus) return null;

  const hotWheels = stableStatus.filter((w) => w.status === 'hot');
  const coldWheels = stableStatus.filter((w) => w.status === 'cold');
  if (hotWheels.length === 0 && coldWheels.length === 0) return null;

  return (
    <div className={styles.stack}>
      {hotWheels.length > 0 && (
        <AlertBanner
          kind="hot"
          wheels={hotWheels.map((w) => `${w.label} ${w.temp}°C`).join('  ·  ')}
          window={stableStatus[0].window}
          deltaText={describeHotDelta(hotWheels, stableStatus[0].window.max)}
        />
      )}
      {coldWheels.length > 0 && (
        <AlertBanner
          kind="cold"
          wheels={coldWheels.map((w) => `${w.label} ${w.temp}°C`).join('  ·  ')}
          window={stableStatus[0].window}
          deltaText={describeColdDelta(coldWheels, stableStatus[0].window.min)}
        />
      )}
    </div>
  );
}

function describeHotDelta(
  wheels: Array<{ label: string; temp: number }>,
  maxAllowed: number,
): string {
  const worst = wheels.reduce((a, b) => (b.temp > a.temp ? b : a));
  const over = worst.temp - maxAllowed;
  return `${worst.label} +${over}°C above optimal (max ${maxAllowed}°C)`;
}

function describeColdDelta(
  wheels: Array<{ label: string; temp: number }>,
  minAllowed: number,
): string {
  const worst = wheels.reduce((a, b) => (b.temp < a.temp ? b : a));
  const under = minAllowed - worst.temp;
  return `${worst.label} ${under}°C below optimal (min ${minAllowed}°C)`;
}

interface AlertBannerProps {
  kind: 'hot' | 'cold';
  wheels: string;
  window: { min: number; optimal: number; max: number };
  deltaText: string;
}

function AlertBanner({ kind, wheels, window, deltaText }: AlertBannerProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`${styles.banner} ${kind === 'hot' ? styles.hot : styles.cold}`}
    >
      <div className={styles.iconCol}>{kind === 'hot' ? '🔥' : '❄'}</div>
      <div className={styles.textCol}>
        <div className={styles.headline}>
          {kind === 'hot' ? 'TYRE OVERHEATING' : 'TYRE TOO COLD'}
        </div>
        <div className={styles.wheels}>{wheels}</div>
        <div className={styles.sub}>
          {deltaText} · compound window {window.min}–{window.max}°C (target {window.optimal})
        </div>
      </div>
    </div>
  );
}
