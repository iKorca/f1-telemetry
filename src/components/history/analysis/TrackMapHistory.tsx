import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { SessionDetail } from '@shared/types';
import * as api from '@/lib/api';
import styles from './TrackMapHistory.module.css';

interface TrackMapHistoryProps {
  session: SessionDetail;
  lapIdx: number;
}

type Channel = 'speed' | 'throttle' | 'brake' | 'gear' | 'ers';

function TrackMapHistory({ session, lapIdx }: TrackMapHistoryProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [channel, setChannel] = useState<Channel>('speed');
  const [trackPts, setTrackPts] = useState<
    Array<{ x: number; z: number }> | null
  >(null);
  const [visible, setVisible] = useState(false);

  // Load track outline
  useEffect(() => {
    if (!session.track || session.track === 'Unknown') {
      setVisible(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Try trackId first, fall back to track name
        const trackId = (session as any).trackId;
        if (trackId != null) {
          const data = await api.getTrackOutline(trackId);
          if (!cancelled && data.points && data.points.length >= 20) {
            setTrackPts(data.points);
            setVisible(true);
          } else {
            setVisible(false);
          }
        } else {
          setVisible(false);
        }
      } catch {
        setVisible(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.track, session]);

  // Draw colored track
  useEffect(() => {
    if (!visible || !trackPts || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const lap = session.laps[lapIdx];
    if (!lap) return;
    const frames = session.frames.slice(
      lap.startFrameIdx,
      (lap.endFrameIdx || session.frames.length) + 1,
    );
    if (frames.length < 2) return;

    // Extract channel values
    const values = frames.map((f) => {
      switch (channel) {
        case 'speed':
          return f.s || 0;
        case 'throttle':
          return f.th || 0;
        case 'brake':
          return f.br || 0;
        case 'gear':
          return f.g || 0;
        case 'ers':
          return f.er || 0;
        default:
          return f.s || 0;
      }
    });
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const range = maxV - minV || 1;

    // Compute track bounds
    let bMinX = Infinity,
      bMaxX = -Infinity,
      bMinZ = Infinity,
      bMaxZ = -Infinity;
    for (const p of trackPts) {
      if (p.x < bMinX) bMinX = p.x;
      if (p.x > bMaxX) bMaxX = p.x;
      if (p.z < bMinZ) bMinZ = p.z;
      if (p.z > bMaxZ) bMaxZ = p.z;
    }
    const pad = Math.max(bMaxX - bMinX, bMaxZ - bMinZ) * 0.08;
    bMinX -= pad;
    bMaxX += pad;
    bMinZ -= pad;
    bMaxZ += pad;

    const scaleX = W / (bMaxX - bMinX);
    const scaleZ = H / (bMaxZ - bMinZ);
    const scale = Math.min(scaleX, scaleZ);
    const offX = (W - (bMaxX - bMinX) * scale) / 2;
    const offZ = (H - (bMaxZ - bMinZ) * scale) / 2;
    const toScreen = (x: number, z: number): [number, number] => [
      (x - bMinX) * scale + offX,
      (z - bMinZ) * scale + offZ,
    ];

    const numSegs = trackPts.length - 1;

    for (let i = 0; i < numSegs; i++) {
      const fi = Math.floor((i / numSegs) * (values.length - 1));
      const norm = (values[fi] - minV) / range;
      const color =
        channel === 'brake'
          ? `rgba(232,0,45,${0.2 + norm * 0.8})`
          : channel === 'ers'
            ? `hsl(${120 * norm}, 80%, 50%)`
            : `hsl(${(1 - norm) * 240}, 80%, 50%)`;

      const [x1, z1] = toScreen(trackPts[i].x, trackPts[i].z);
      const [x2, z2] = toScreen(trackPts[i + 1].x, trackPts[i + 1].z);

      ctx.beginPath();
      ctx.moveTo(x1, z1);
      ctx.lineTo(x2, z2);
      ctx.strokeStyle = color;
      ctx.lineWidth =
        channel === 'brake' && norm > 0.1 ? 4 + norm * 3 : 3;
      ctx.stroke();
    }

    // Legend
    ctx.fillStyle = '#888';
    ctx.font = '10px sans-serif';
    const lbl: Record<Channel, string> = {
      speed: 'km/h',
      throttle: '%',
      brake: '%',
      gear: '',
      ers: '%',
    };
    ctx.fillText(`${Math.round(minV)}${lbl[channel]}`, 5, H - 5);
    ctx.fillText(`${Math.round(maxV)}${lbl[channel]}`, W - 50, H - 5);
  }, [visible, trackPts, session, lapIdx, channel]);

  const handleChannelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setChannel(e.target.value as Channel);
    },
    [],
  );

  if (!visible) return null;

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className="section-label">TRACK MAP</span>
        <select
          className="settings-select"
          value={channel}
          onChange={handleChannelChange}
        >
          <option value="speed">Speed</option>
          <option value="throttle">Throttle</option>
          <option value="brake">Brake</option>
          <option value="gear">Gear</option>
          <option value="ers">ERS</option>
        </select>
      </div>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={500}
        height={300}
      />
    </div>
  );
}

export default React.memo(TrackMapHistory);
