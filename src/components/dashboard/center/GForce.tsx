import React, { useCallback, useMemo } from 'react';
import { useTelemetryStore } from '@/store/telemetryStore';
import { MAX_G } from '@/lib/constants';
import CanvasRenderer from '@/components/common/CanvasRenderer';
import styles from './GForce.module.css';

const GMETER_SIZE = 100;

function clamp01(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

function GForce() {
  const gForceLateral = useTelemetryStore((s) => s.gForceLateral);
  const gForceLongitudinal = useTelemetryStore((s) => s.gForceLongitudinal);

  // Lateral bars: positive = right turn, negative = left turn
  const latPct = Math.min(1, Math.abs(gForceLateral) / MAX_G) * 50;
  const latLeftWidth = gForceLateral < 0 ? `${latPct}%` : '0%';
  const latRightWidth = gForceLateral >= 0 ? `${latPct}%` : '0%';

  // Longitudinal bars: positive = forward (braking), negative = backward (accel)
  const longPct = Math.min(1, Math.abs(gForceLongitudinal) / MAX_G) * 50;
  const longLeftWidth = gForceLongitudinal >= 0 ? `${longPct}%` : '0%';
  const longRightWidth = gForceLongitudinal < 0 ? `${longPct}%` : '0%';

  const drawGMeter = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const W = GMETER_SIZE;
      const H = GMETER_SIZE;
      const cx = W / 2;
      const cy = H / 2;
      const R = cx - 4;

      ctx.clearRect(0, 0, W, H);

      // Background circle
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = '#10101e';
      ctx.fill();
      ctx.strokeStyle = '#2a2a40';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Crosshair
      ctx.strokeStyle = '#2a2a40';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - R, cy);
      ctx.lineTo(cx + R, cy);
      ctx.moveTo(cx, cy - R);
      ctx.lineTo(cx, cy + R);
      ctx.stroke();

      // Inner ring at 50%
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#1e1e38';
      ctx.lineWidth = 1;
      ctx.stroke();

      // G-force dot
      const dotX = cx + clamp01(gForceLateral / MAX_G) * R;
      const dotY = cy - clamp01(gForceLongitudinal / MAX_G) * R;

      ctx.beginPath();
      ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#e8002d';
      ctx.fill();
      ctx.shadowColor = '#e8002d';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    },
    [gForceLateral, gForceLongitudinal]
  );

  return (
    <div className={styles.gforceSection}>
      <div className={styles.gforceBars}>
        {/* Lateral G */}
        <div className={styles.gbarRow}>
          <span className={styles.gbarLabel}>LAT</span>
          <div className={styles.gbarWrap}>
            <div className={styles.gbarLeft} style={{ width: latLeftWidth }} />
            <div className={styles.gbarRight} style={{ width: latRightWidth }} />
          </div>
          <span className={styles.gbarNum}>{gForceLateral.toFixed(1)}g</span>
        </div>
        {/* Longitudinal G */}
        <div className={styles.gbarRow}>
          <span className={styles.gbarLabel}>LONG</span>
          <div className={styles.gbarWrap}>
            <div className={styles.gbarLeft} style={{ width: longLeftWidth }} />
            <div className={styles.gbarRight} style={{ width: longRightWidth }} />
          </div>
          <span className={styles.gbarNum}>{gForceLongitudinal.toFixed(1)}g</span>
        </div>
      </div>
      <div className={styles.gmeterWrap}>
        <CanvasRenderer
          width={GMETER_SIZE}
          height={GMETER_SIZE}
          draw={drawGMeter}
          className={styles.gmeter}
        />
      </div>
    </div>
  );
}

export default React.memo(GForce);
