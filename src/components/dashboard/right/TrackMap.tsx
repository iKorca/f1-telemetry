import React, { useCallback } from 'react';
import { useSessionInfoStore } from '@/store/sessionInfoStore';
import { useTelemetryStore } from '@/store/telemetryStore';
import { useTimingStore } from '@/store/timingStore';
import { getTeamColor } from '@/lib/colors';
import CanvasRenderer from '@/components/common/CanvasRenderer';
import styles from './TrackMap.module.css';

const MAP_SIZE = 230;

function TrackMap() {
  const trackPoints = useSessionInfoStore((s) => s.trackPoints);
  const trackBounds = useSessionInfoStore((s) => s.trackBounds);
  const allCarPositions = useTelemetryStore((s) => s.allCarPositions);
  const playerCarIndex = useTimingStore((s) => s.playerCarIndex);
  const allParticipants = useTimingStore((s) => s.allParticipants);

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const W = MAP_SIZE;
      const H = MAP_SIZE;
      ctx.clearRect(0, 0, W, H);

      if (!trackBounds) return;
      const b = trackBounds;

      const scaleX = W / (b.maxX - b.minX);
      const scaleZ = H / (b.maxZ - b.minZ);
      const scale = Math.min(scaleX, scaleZ);
      const offX = (W - (b.maxX - b.minX) * scale) / 2;
      const offZ = (H - (b.maxZ - b.minZ) * scale) / 2;

      function toScreen(x: number, z: number): [number, number] {
        return [(x - b.minX) * scale + offX, (z - b.minZ) * scale + offZ];
      }

      // Draw track outline
      if (trackPoints.length > 1) {
        ctx.beginPath();
        const [sx, sz] = toScreen(trackPoints[0].x, trackPoints[0].z);
        ctx.moveTo(sx, sz);
        for (let i = 1; i < trackPoints.length; i++) {
          const [px, pz] = toScreen(trackPoints[i].x, trackPoints[i].z);
          ctx.lineTo(px, pz);
        }
        ctx.strokeStyle = '#2a2a40';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Draw all car positions
      const participants = allParticipants?.participants || [];
      for (let i = 0; i < allCarPositions.length; i++) {
        const car = allCarPositions[i];
        if (!car || (car.x === 0 && car.z === 0)) continue;
        const [cx, cz] = toScreen(car.x, car.z);
        const isPlayer = i === playerCarIndex;
        const r = isPlayer ? 5 : 3;

        ctx.beginPath();
        ctx.arc(cx, cz, r, 0, Math.PI * 2);
        if (isPlayer) {
          ctx.fillStyle = '#e8002d';
          ctx.fill();
          ctx.strokeStyle = '#e8002d';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#e8002d';
          ctx.shadowBlur = 6;
          ctx.stroke();
          ctx.shadowBlur = 0;
        } else {
          const teamId = participants[i]?.teamId ?? 255;
          ctx.fillStyle = getTeamColor(teamId);
          ctx.fill();
        }
      }
    },
    [trackPoints, trackBounds, allCarPositions, playerCarIndex, allParticipants]
  );

  return (
    <div className={styles.section}>
      <span className="section-label">TRACK MAP</span>
      <CanvasRenderer
        width={MAP_SIZE}
        height={MAP_SIZE}
        draw={draw}
        className={styles.canvas}
      />
    </div>
  );
}

export default React.memo(TrackMap);
