import React, { useCallback } from 'react';
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

  const allChecked =
    sessions.length > 0 && selectedSessions.size === sessions.length;

  const handleSelectAll = useCallback(() => {
    if (allChecked) {
      clearSelection();
    } else {
      selectAll();
    }
  }, [allChecked, clearSelection, selectAll]);

  const handleDeleteSelected = useCallback(async () => {
    const ids = Array.from(selectedSessions);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} session(s)?`)) return;
    try {
      await api.batchDeleteSessions(ids);
      clearSelection();
      setCurrentSessionId(null);
      setCurrentSession(null);
      const list = await api.getSessions();
      setSessions(list);
    } catch (err) {
      console.error('batchDelete error:', err);
    }
  }, [
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
        <button className="btn btn-small btn-danger" onClick={handleDeleteSelected}>
          Delete Selected ({selectedSessions.size})
        </button>
      )}
    </div>
  );
}

export default React.memo(BatchToolbar);
