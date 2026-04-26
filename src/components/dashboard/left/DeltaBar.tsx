import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTimingStore } from '@/store/timingStore';
import { useSessionInfoStore } from '@/store/sessionInfoStore';
import { fmtDeltaSigned } from '@/lib/formatters';
import { deltaMsAtDistance } from '@/lib/lapUtils';
import styles from './DeltaBar.module.css';

/**
 * Delta to PB bar. Uses distance-based interpolation into the stored PB
 * lap trace (same source as the glance dashboard's big delta tile) so the
 * number matches F1 25's on-screen delta — linear "currentTime vs
 * bestTime × lapFraction" is massively wrong on any real circuit.
 *
 * Three display states:
 *  - LIVE — live distance-based delta available; bar + signed delta animate
 *  - LAST — no live trace yet (trace still accumulating, no PB set on this
 *           session, or just past S/F); shows last-lap-vs-PB explicitly
 *           tagged "(LAST)" so the driver doesn't read it as live
 *  - empty — no usable data at all; shows "—"
 */
function DeltaBar() {
  const { currentLapTimeMs, currentLapDistance, bestLapMs, lastLapMs, pbLapTrace, pbTotalMs } =
    useTimingStore(
      useShallow((s) => ({
        currentLapTimeMs: s.currentLapTimeMs,
        currentLapDistance: s.currentLapDistance,
        bestLapMs: s.bestLapMs,
        lastLapMs: s.lastLapMs,
        pbLapTrace: s.pbLapTrace,
        pbTotalMs: s.pbTotalMs,
      })),
    );
  const trackLength = useSessionInfoStore((s) => s.trackLength);

  const { deltaMs, source, pct, isFaster } = useMemo(() => {
    const live = deltaMsAtDistance(pbLapTrace, pbTotalMs, currentLapTimeMs, currentLapDistance, trackLength);
    // Last-lap fallback. Suppress when `lastLapMs < bestLapMs` — that
    // happens when the just-finished lap was faster but its trace was
    // too short for the store to atomically lock it in as a new PB
    // (recordPB = false). In that window the headline best is the
    // *previous* PB, but lastLapMs is the new (faster) lap, so
    // `lastLapMs - bestLapMs` would be negative and falsely tell the
    // driver they're faster than their own PB. Wait for the next clean
    // lap to either re-snapshot or update the headline best.
    const fallbackUsable =
      bestLapMs > 0 && lastLapMs > 0 && lastLapMs >= bestLapMs;
    const fallback = fallbackUsable ? lastLapMs - bestLapMs : null;
    const delta = live ?? fallback;
    const src: 'live' | 'last' | 'none' =
      live != null ? 'live' : fallback != null ? 'last' : 'none';

    const maxDelta = 5000; // 5 seconds max
    const percent = delta == null ? 0 : Math.min(50, (Math.abs(delta) / maxDelta) * 50);

    return {
      deltaMs: delta ?? 0,
      source: src,
      pct: percent,
      isFaster: (delta ?? 0) < 0,
    };
  }, [pbLapTrace, pbTotalMs, currentLapTimeMs, currentLapDistance, trackLength, bestLapMs, lastLapMs]);

  const hasData = source !== 'none';
  const negWidth = hasData && isFaster ? `${pct}%` : '0%';
  const posWidth = hasData && !isFaster && deltaMs > 0 ? `${pct}%` : '0%';

  const valueClass = [
    styles.deltaValue,
    hasData && deltaMs !== 0 ? (isFaster ? styles.deltaFaster : styles.deltaSlower) : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Tag the value when it's last-lap rather than live — ms readout looks
  // identical otherwise, and the driver could mistake a stale delta for a
  // current one and chase the wrong line.
  const valueText = !hasData
    ? '—'
    : source === 'last'
      ? `${fmtDeltaSigned(deltaMs)} (LAST)`
      : fmtDeltaSigned(deltaMs);

  return (
    <div className={styles.section}>
      <span className="section-label">DELTA TO BEST</span>
      <div className={styles.barWrap}>
        <div
          className={`${styles.deltaHalf} ${styles.neg}`}
          style={{ width: negWidth }}
        />
        <div className={styles.center} />
        <div
          className={`${styles.deltaHalf} ${styles.pos}`}
          style={{ width: posWidth }}
        />
      </div>
      <div className={valueClass}>{valueText}</div>
    </div>
  );
}

export default React.memo(DeltaBar);
