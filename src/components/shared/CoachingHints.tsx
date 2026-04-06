import React, { useMemo } from 'react';
import type { SessionDetail } from '@shared/types';
import { findBestLapIndex, getFramesForLap } from '@/lib/lapUtils';
import styles from './CoachingHints.module.css';

interface CoachingHintsProps {
  session: SessionDetail;
  lapIdx: number;
}

interface Tip {
  seg: number;
  type: 'brake' | 'speed' | 'throttle';
  msg: string;
  priority: number;
}

const SEGS = 12;

function CoachingHints({ session, lapIdx }: CoachingHintsProps) {
  const tips = useMemo((): Tip[] | null => {
    const lap = session.laps[lapIdx];
    if (!lap) return null;
    const frames = getFramesForLap(session, lapIdx);
    if (frames.length < 24) return null;

    // Find best lap
    const bestIdx = findBestLapIndex(session.laps);
    if (bestIdx === -1 || bestIdx === lapIdx) return null;

    const bestFrames = getFramesForLap(session, bestIdx);
    if (bestFrames.length < 24) return null;

    const result: Tip[] = [];

    for (let i = 0; i < SEGS; i++) {
      const s1 = Math.floor((i * frames.length) / SEGS);
      const e1 = Math.floor(((i + 1) * frames.length) / SEGS);
      const s2 = Math.floor((i * bestFrames.length) / SEGS);
      const e2 = Math.floor(((i + 1) * bestFrames.length) / SEGS);

      const seg = frames.slice(s1, e1);
      const bestSeg = bestFrames.slice(s2, e2);

      const avgBrake =
        seg.reduce((sum, f) => sum + f.br, 0) / seg.length;
      const bestAvgBrake =
        bestSeg.reduce((sum, f) => sum + f.br, 0) / bestSeg.length;
      const minSpeed = Math.min(...seg.map((f) => f.s));
      const bestMinSpeed = Math.min(...bestSeg.map((f) => f.s));
      const avgThrottle =
        seg.reduce((sum, f) => sum + f.th, 0) / seg.length;
      const bestAvgThrottle =
        bestSeg.reduce((sum, f) => sum + f.th, 0) / bestSeg.length;

      if (avgBrake > bestAvgBrake + 10) {
        result.push({
          seg: i + 1,
          type: 'brake',
          msg: `Segment ${i + 1}: braking harder than best lap (${avgBrake.toFixed(0)}% vs ${bestAvgBrake.toFixed(0)}%)`,
          priority: avgBrake - bestAvgBrake,
        });
      }
      if (minSpeed < bestMinSpeed - 5) {
        result.push({
          seg: i + 1,
          type: 'speed',
          msg: `Segment ${i + 1}: lower corner speed (${minSpeed.toFixed(0)} vs ${bestMinSpeed.toFixed(0)} km/h)`,
          priority: bestMinSpeed - minSpeed,
        });
      }
      if (avgThrottle < bestAvgThrottle - 8) {
        result.push({
          seg: i + 1,
          type: 'throttle',
          msg: `Segment ${i + 1}: less throttle application (${avgThrottle.toFixed(0)}% vs ${bestAvgThrottle.toFixed(0)}%)`,
          priority: bestAvgThrottle - avgThrottle,
        });
      }
    }

    result.sort((a, b) => b.priority - a.priority);
    return result;
  }, [session, lapIdx]);

  if (tips === null) return null;

  return (
    <div className={styles.container}>
      <span className="section-label">COACHING HINTS</span>
      <div className={styles.content}>
        {tips.length === 0 ? (
          <div className={`${styles.item} ${styles.tipGood}`}>
            This lap is close to your best — great consistency!
          </div>
        ) : (
          tips.slice(0, 6).map((t, i) => {
            const icon =
              t.type === 'brake'
                ? '\uD83D\uDD34'
                : t.type === 'speed'
                  ? '\uD83D\uDFE1'
                  : '\uD83D\uDFE2';
            return (
              <div
                className={`${styles.item} ${styles[`tip${capitalize(t.type)}`]}`}
                key={i}
              >
                {icon} {t.msg}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default React.memo(CoachingHints);
