import React, { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTimingStore } from '@/store/timingStore';
import { useSessionInfoStore } from '@/store/sessionInfoStore';
import { fmtTime } from '@/lib/formatters';
import { deltaMsAtDistance } from '@/lib/lapUtils';
import styles from './SecondaryDashboard.module.css';

type Mode = 'live' | 'last';

/** Live-delta refresh rate — slow enough to read at speed, fast enough
 *  to catch sector-boundary corrections. The store still updates at
 *  60 Hz so other consumers (DeltaBar, race-engineer panels) get fresh
 *  values; only this big tile's display is throttled. */
const LIVE_TICK_MS = 1000;

/**
 * Delta vs the player's PB lap.
 *
 *  - LIVE — at the car's current track distance, compare `currentLapTime`
 *           against the PB lap's time at THAT SAME distance by interpolating
 *           into a stored PB trace. This matches F1 25's own on-screen delta
 *           (time-at-distance comparison, not linear extrapolation).
 *  - LAST — the most recently completed lap minus the PB.
 *
 * Before a PB is set (or until we have a usable PB trace) the LIVE panel
 * falls back to the LAST delta so the driver isn't shown misleading numbers.
 *
 * The big number throttles to 1 Hz so the digits don't flicker at racing
 * speed. Per-packet updates were too noisy to read in peripheral vision.
 */
export default function BigDeltaTile() {
  const [mode, setMode] = useState<Mode>('live');

  // Slow-moving fields stay subscribed (changes only on PB transition,
  // session reset, or lap finish). The fast-moving currentLapTimeMs /
  // currentLapDistance are read via getState() inside the 1 Hz tick to
  // avoid a per-packet rerender of this tile.
  const { bestLapMs, lastLapMs, pbLapTrace, pbTotalMs } = useTimingStore(
    useShallow((s) => ({
      bestLapMs: s.bestLapMs,
      lastLapMs: s.lastLapMs,
      pbLapTrace: s.pbLapTrace,
      pbTotalMs: s.pbTotalMs,
    })),
  );
  const trackLength = useSessionInfoStore((s) => s.trackLength);

  // 1 Hz tick — bumps state to force a recompute of the live delta.
  // Mounted unconditionally so the deps array is stable across renders.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), LIVE_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const liveDeltaMs = useMemo<number | null>(() => {
    const { currentLapTimeMs, currentLapDistance } = useTimingStore.getState();
    return deltaMsAtDistance(
      pbLapTrace,
      pbTotalMs,
      currentLapTimeMs,
      currentLapDistance,
      trackLength,
    );
    // `tick` drives the recompute cadence; the rest are dependency-tracked
    // because they change rarely and the user expects an immediate redraw
    // when (e.g.) a new PB locks in mid-lap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, pbLapTrace, pbTotalMs, trackLength]);


  // LAST delta: previous full lap minus PB. Same suppression rule as the
  // live DeltaBar — when the just-finished lap was faster but its trace was
  // too short to atomically promote into a new PB, lastLapMs sits below
  // bestLapMs and the difference would falsely read negative.
  const lastDeltaMs = useMemo<number | null>(() => {
    if (bestLapMs <= 0 || lastLapMs <= 0) return null;
    if (lastLapMs < bestLapMs) return null;
    return lastLapMs - bestLapMs;
  }, [bestLapMs, lastLapMs]);

  const liveAvailable = liveDeltaMs != null;
  const deltaMs =
    mode === 'live'
      ? (liveAvailable ? liveDeltaMs : lastDeltaMs)
      : lastDeltaMs;
  const ratingLabel =
    mode === 'live' && liveAvailable
      ? 'LIVE vs PB at distance'
      : 'LAST LAP vs PB';

  const noPB = bestLapMs <= 0;
  const tracePending = mode === 'live' && !liveAvailable && !noPB;

  const displayColor =
    deltaMs == null
      ? 'var(--grey)'
      : deltaMs < -5
        ? 'var(--green)'
        : deltaMs > 5
          ? 'var(--red)'
          : 'var(--white)';

  // Two decimal places — three was over-precise for peripheral reading at
  // racing speed and made the trailing digit flicker even on the 1 Hz
  // tick. Two digits is the F1-broadcast convention.
  const text =
    deltaMs == null
      ? noPB
        ? 'no PB yet'
        : '—'
      : `${deltaMs >= 0 ? '+' : '−'}${(Math.abs(deltaMs) / 1000).toFixed(2)}s`;

  // Dev-only diagnostic: shows the raw inputs to the interpolation so it's
  // obvious when the browser is running stale code or the PB trace is
  // mis-aligned. Reads currentLapTimeMs / currentLapDistance via
  // `getState()` so this tile doesn't subscribe to per-packet store
  // changes — the tick driver above is the only render trigger. Vite
  // strips this branch from production via dead-code elimination on
  // `import.meta.env.DEV`.
  const diag = useMemo(() => {
    if (!import.meta.env.DEV) return null;
    const { currentLapTimeMs, currentLapDistance } = useTimingStore.getState();
    if (!pbLapTrace || pbLapTrace.length === 0) {
      return `trace=0  dist=${Math.round(currentLapDistance)}m  t=${currentLapTimeMs}ms`;
    }
    const first = pbLapTrace[0];
    const last = pbLapTrace[pbLapTrace.length - 1];
    return `trace=${pbLapTrace.length}  d∈[${Math.round(first.d)}..${Math.round(last.d)}]  pbTot=${(pbTotalMs / 1000).toFixed(3)}s  here d=${Math.round(currentLapDistance)}m t=${(currentLapTimeMs / 1000).toFixed(3)}s`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, pbLapTrace, pbTotalMs]);

  return (
    <>
      <div className={styles.tileHeader}>
        DELTA TO PB
        <span className={styles.tileSub}>
          <button
            type="button"
            onClick={() => setMode('live')}
            className={`${styles.bdToggle} ${mode === 'live' ? styles.bdToggleActive : ''}`}
          >
            LIVE
          </button>
          <span className={styles.bdToggleSep}>|</span>
          <button
            type="button"
            onClick={() => setMode('last')}
            className={`${styles.bdToggle} ${mode === 'last' ? styles.bdToggleActive : ''}`}
          >
            LAST LAP
          </button>
        </span>
      </div>
      <div className={styles.tileBody}>
        <div className={styles.bdValue} style={{ color: displayColor }}>
          {text}
        </div>
      </div>
      <div className={styles.bdFooter}>
        {bestLapMs > 0 ? (
          <>
            PB {fmtTime(bestLapMs)}
            {ratingLabel && (
              <span className={styles.bdFooterRating}>{ratingLabel}</span>
            )}
            {tracePending && (
              <span className={styles.bdFooterPending}>
                · waiting for PB trace — showing LAST LAP
              </span>
            )}
          </>
        ) : (
          'SET A FLYING LAP TO LOCK IN A PERSONAL BEST'
        )}
      </div>
      {diag && <div className={styles.bdDiag}>{diag}</div>}
    </>
  );
}
