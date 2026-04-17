import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useHistoryStore } from '@/store/historyStore';
import * as api from '@/lib/api';
import styles from './BatchToolbar.module.css';

function BatchToolbar() {
  const selectedSessions = useHistoryStore((s) => s.selectedSessions);
  const sessions = useHistoryStore((s) => s.sessions);
  const selectAll = useHistoryStore((s) => s.selectAll);
  const clearSelection = useHistoryStore((s) => s.clearSelection);
  const setSessions = useHistoryStore((s) => s.setSessions);
  const setCurrentSessionId = useHistoryStore((s) => s.setCurrentSessionId);
  const setCurrentSession = useHistoryStore((s) => s.setCurrentSession);

  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-cancel confirmation after 3 seconds
  useEffect(() => {
    if (confirming) {
      confirmTimer.current = setTimeout(() => setConfirming(false), 3000);
      return () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); };
    }
  }, [confirming]);

  // Reset confirmation when selection changes
  useEffect(() => {
    setConfirming(false);
  }, [selectedSessions]);

  const allChecked =
    sessions.length > 0 && selectedSessions.size === sessions.length;

  const handleSelectAll = useCallback(() => {
    if (allChecked) {
      clearSelection();
    } else {
      selectAll();
    }
  }, [allChecked, clearSelection, selectAll]);

  const handleDeleteClick = useCallback(() => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    // Second click — actually delete
    setConfirming(false);
    const ids = Array.from(selectedSessions);
    if (ids.length === 0) return;
    api.batchDeleteSessions(ids).then(async () => {
      clearSelection();
      setCurrentSessionId(null);
      setCurrentSession(null);
      const list = await api.getSessions();
      setSessions(list);
    }).catch((err) => {
      console.error('batchDelete error:', err);
    });
  }, [
    confirming,
    selectedSessions,
    clearSelection,
    setCurrentSessionId,
    setCurrentSession,
    setSessions,
  ]);

  if (sessions.length === 0) return null;

  return (
    <div className={styles.toolbar}>
      <button className="btn btn-small" onClick={handleSelectAll}>
        {allChecked ? 'Deselect All' : 'Select All'}
      </button>
      {selectedSessions.size > 0 && (
        <button
          className="btn btn-small btn-danger"
          onClick={handleDeleteClick}
          style={confirming ? { background: 'rgba(232,0,45,0.25)', borderColor: 'var(--red)', color: '#fff' } : undefined}
        >
          {confirming
            ? `Confirm Delete (${selectedSessions.size})?`
            : `Delete Selected (${selectedSessions.size})`}
        </button>
      )}
    </div>
  );
}

export default React.memo(BatchToolbar);
