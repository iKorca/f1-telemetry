import React, { useCallback } from 'react';
import type { SessionDetail } from '@shared/types';
import { fmtTime, fmtDate, fmtDateFile, fmtSector } from '@/lib/formatters';
import * as api from '@/lib/api';
import { useHistoryStore } from '@/store/historyStore';
import { generateSessionCard } from '../modals/SessionCardGenerator';
import styles from './SessionHeaderBar.module.css';

interface SessionHeaderBarProps {
  session: SessionDetail;
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SessionHeaderBar({ session }: SessionHeaderBarProps) {
  const setSessions = useHistoryStore((s) => s.setSessions);
  const setCurrentSessionId = useHistoryStore((s) => s.setCurrentSessionId);
  const setCurrentSession = useHistoryStore((s) => s.setCurrentSession);

  const validLaps = (session.laps || []).filter(
    (l) => l.valid && l.lapTimeMs > 0,
  );
  const bestMs = validLaps.length
    ? Math.min(...validLaps.map((l) => l.lapTimeMs))
    : null;

  const handleExportLaps = useCallback(() => {
    const laps = (session.laps || []).filter((l) => !l.deleted);
    const headers = [
      'Lap',
      'Time',
      'S1',
      'S2',
      'S3',
      'Compound',
      'TyreAge',
      'MaxSpeed',
      'Valid',
    ];
    const rows = laps.map((l) =>
      [
        l.lapNum,
        l.lapTimeMs ? fmtTime(l.lapTimeMs) : '',
        l.s1Ms ? fmtSector(l.s1Ms) : '',
        l.s2Ms ? fmtSector(l.s2Ms) : '',
        l.s3Ms ? fmtSector(l.s3Ms) : '',
        l.compound || '',
        l.tyreAge ?? '',
        l.maxSpeed || '',
        l.valid ? 'Y' : 'N',
      ].join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    downloadCSV(
      csv,
      `${session.track}_laps_${fmtDateFile(session.startTime)}.csv`,
    );
  }, [session]);

  const handleExportTelemetry = useCallback(() => {
    if (!session.frames || session.frames.length === 0) return;
    const headers = [
      'Frame',
      'LapTime',
      'Speed',
      'Throttle',
      'Brake',
      'Gear',
      'RPM',
      'DRS',
      'Steer',
    ];
    const rows = session.frames.map((f, i) =>
      [i, f.t, f.s, f.th, f.br, f.g, f.r, f.d, f.st].join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    downloadCSV(
      csv,
      `${session.track}_telemetry_${fmtDateFile(session.startTime)}.csv`,
    );
  }, [session]);

  const handleShareCard = useCallback(() => {
    generateSessionCard(session);
  }, [session]);

  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this session?')) return;
    try {
      await api.deleteSession(session.id);
      setCurrentSessionId(null);
      setCurrentSession(null);
      const list = await api.getSessions();
      setSessions(list);
    } catch (err) {
      console.error('deleteSession error:', err);
    }
  }, [session.id, setCurrentSessionId, setCurrentSession, setSessions]);

  return (
    <div className={styles.bar}>
      <span className={`${styles.val} ${styles.big}`}>{session.track}</span>
      <span className={`${styles.val} ${styles.muted}`}>
        {session.sessionType}
      </span>
      <span className={`${styles.val} ${styles.muted}`}>
        {fmtDate(session.startTime)}
      </span>
      <span className={`${styles.val} ${styles.green}`}>
        {bestMs ? 'Best: ' + fmtTime(bestMs) : 'No valid laps'}
      </span>
      <span className={`${styles.val} ${styles.muted}`}>
        {(session.laps || []).filter((l) => !l.deleted).length} laps
      </span>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={handleExportLaps}>
          Export Laps
        </button>
        <button className={styles.btn} onClick={handleExportTelemetry}>
          Export Telemetry
        </button>
        <button className={styles.btn} onClick={handleShareCard}>
          Share Card
        </button>
        <button className={styles.btnDanger} onClick={handleDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}

export default React.memo(SessionHeaderBar);
