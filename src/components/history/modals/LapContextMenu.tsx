import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { SessionDetail } from '@shared/types';
import { fmtTime, fmtDateFile } from '@/lib/formatters';
import * as api from '@/lib/api';
import styles from './LapContextMenu.module.css';

interface LapContextMenuProps {
  x: number;
  y: number;
  session: SessionDetail;
  lapIdx: number;
  onClose: () => void;
  onReload: () => void;
  onShowCharts: (lapIdx: number) => void;
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

function LapContextMenu({
  x,
  y,
  session,
  lapIdx,
  onClose,
  onReload,
  onShowCharts,
}: LapContextMenuProps) {
  // Close on any click outside
  useEffect(() => {
    const handler = () => onClose();
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [onClose]);

  const lap = session.laps[lapIdx];

  const handleDelete = useCallback(async () => {
    if (confirm('Delete this lap from the recording?')) {
      await api.deleteLap(session.id, lapIdx);
      onReload();
    }
    onClose();
  }, [session.id, lapIdx, onReload, onClose]);

  const handleToggleValid = useCallback(async () => {
    if (!lap) return;
    await api.updateLap(session.id, lapIdx, { valid: !lap.valid });
    onReload();
    onClose();
  }, [session.id, lapIdx, lap, onReload, onClose]);

  const handleAddNote = useCallback(async () => {
    if (!lap) return;
    const note = prompt('Add note for this lap:', lap.notes || '');
    if (note !== null) {
      await api.updateLap(session.id, lapIdx, { notes: note });
      onReload();
    }
    onClose();
  }, [session.id, lapIdx, lap, onReload, onClose]);

  const handleCompare = useCallback(() => {
    onShowCharts(lapIdx);
    onClose();
  }, [lapIdx, onShowCharts, onClose]);

  const handleExportLap = useCallback(() => {
    if (!lap) return;
    const frames = session.frames.slice(
      lap.startFrameIdx ?? 0,
      (lap.endFrameIdx ?? session.frames.length - 1) + 1,
    );
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
    const rows = frames.map((f, i) =>
      [i, f.t, f.s, f.th, f.br, f.g, f.r, f.d, f.st].join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    downloadCSV(
      csv,
      `${session.track}_lap${lap.lapNum}_${fmtDateFile(session.startTime)}.csv`,
    );
    onClose();
  }, [session, lap, lapIdx, onClose]);

  if (!lap) return null;

  const menu = (
    <div
      className={styles.menu}
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.item} onClick={handleDelete}>
        Delete Lap
      </div>
      <div className={styles.item} onClick={handleToggleValid}>
        {lap.valid ? 'Mark Invalid' : 'Mark Valid'}
      </div>
      <div className={styles.item} onClick={handleAddNote}>
        Add Note
      </div>
      <div className={styles.item} onClick={handleCompare}>
        Compare With...
      </div>
      <div className={styles.item} onClick={handleExportLap}>
        Export Lap CSV
      </div>
    </div>
  );

  return createPortal(menu, document.body);
}

export default React.memo(LapContextMenu);
