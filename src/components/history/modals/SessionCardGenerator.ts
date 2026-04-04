import type { SessionDetail } from '@shared/types';
import { fmtTime, fmtSector } from '@/lib/formatters';

/**
 * Generates a canvas-based PNG session summary card and triggers download.
 * Port of generateSessionCard() from app.js lines 3614-3752.
 */
export function generateSessionCard(session: SessionDetail): void {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 450;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#07070e';
  ctx.fillRect(0, 0, 800, 450);

  // Red accent line
  ctx.fillStyle = '#e8002d';
  ctx.fillRect(0, 0, 800, 4);

  // Track name
  ctx.font = '900 36px Orbitron, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(session.track || '\u2014', 40, 60);

  // Session type + date
  ctx.font = '600 16px Rajdhani, sans-serif';
  ctx.fillStyle = '#888';
  const dateStr = session.startTime
    ? new Date(session.startTime).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '\u2014';
  ctx.fillText(`${session.sessionType || '\u2014'} \u00B7 ${dateStr}`, 40, 90);

  // Best lap
  const validLaps = (session.laps || []).filter(
    (l) => l.valid && l.lapTimeMs > 0,
  );
  const bestMs = validLaps.length
    ? Math.min(...validLaps.map((l) => l.lapTimeMs))
    : 0;
  const bestLap = validLaps.find((l) => l.lapTimeMs === bestMs);

  ctx.font = '900 56px Orbitron, sans-serif';
  ctx.fillStyle = '#39d353';
  ctx.fillText(bestMs ? fmtTime(bestMs) : '\u2014', 40, 170);

  ctx.font = '600 14px Rajdhani, sans-serif';
  ctx.fillStyle = '#555';
  ctx.fillText('BEST LAP', 40, 190);

  // Sectors
  if (bestLap) {
    const sectors: [string, number][] = [
      ['S1', bestLap.s1Ms],
      ['S2', bestLap.s2Ms],
      [
        'S3',
        bestLap.s1Ms && bestLap.s2Ms && bestLap.lapTimeMs
          ? bestLap.lapTimeMs - bestLap.s1Ms - bestLap.s2Ms
          : 0,
      ],
    ];
    sectors.forEach(([label, ms], i) => {
      const x = 40 + i * 160;
      ctx.font = '600 12px Rajdhani, sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText(label, x, 230);
      ctx.font = '700 20px Rajdhani, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(ms ? fmtSector(ms) : '\u2014', x, 252);
    });
  }

  // Stats column
  const stats: [string, string | number][] = [
    [
      'Laps',
      session.laps ? session.laps.filter((l) => !l.deleted).length : 0,
    ],
    ['Valid', validLaps.length],
    [
      'Top Speed',
      validLaps.length
        ? Math.max(...validLaps.map((l) => l.maxSpeed || 0)) + ' km/h'
        : '\u2014',
    ],
    ['Compound', bestLap?.compound || '\u2014'],
  ];

  stats.forEach(([label, val], i) => {
    const x = 540;
    const y = 60 + i * 45;
    ctx.font = '600 12px Rajdhani, sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText(String(label).toUpperCase(), x, y);
    ctx.font = '700 22px Rajdhani, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(String(val), x, y + 24);
  });

  // Consistency score
  const times = validLaps.map((l) => l.lapTimeMs);
  if (times.length > 1) {
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const stdDev = Math.sqrt(
      times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length,
    );
    const cv = (stdDev / mean) * 100;
    const score = Math.max(0, Math.min(100, 100 - cv * 10));
    ctx.font = '600 12px Rajdhani, sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('CONSISTENCY', 540, 240);
    ctx.font = '900 28px Orbitron, sans-serif';
    ctx.fillStyle =
      score >= 80 ? '#39d353' : score >= 50 ? '#f5c518' : '#e8002d';
    ctx.fillText(score.toFixed(0) + '%', 540, 272);
  }

  // Mini lap time bar chart at bottom
  if (validLaps.length > 1) {
    const barY = 330;
    const barH = 80;
    const barW = 700 / validLaps.length;
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const tRange = tMax - tMin || 1;

    validLaps.forEach((l, i) => {
      const norm = (l.lapTimeMs - tMin) / tRange;
      const h = 20 + norm * (barH - 20);
      const color =
        l.lapTimeMs === bestMs
          ? '#39d353'
          : `hsl(${(1 - norm) * 120}, 70%, 50%)`;
      ctx.fillStyle = color;
      ctx.fillRect(
        50 + i * barW,
        barY + barH - h,
        Math.max(2, barW - 1),
        h,
      );
    });

    ctx.font = '600 10px Rajdhani, sans-serif';
    ctx.fillStyle = '#555';
    ctx.fillText('LAP TIMES', 50, barY - 5);
  }

  // Watermark
  ctx.font = '600 11px Rajdhani, sans-serif';
  ctx.fillStyle = '#333';
  ctx.fillText('F1 25 Telemetry Dashboard', 40, 440);
  ctx.fillText(new Date().toLocaleDateString(), 700, 440);

  // Download
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(session.track || 'session').replace(/\s+/g, '_')}_${session.sessionType || 'session'}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
