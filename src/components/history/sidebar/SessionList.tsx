import React, { useEffect, useCallback } from 'react';
import { useHistoryStore } from '@/store/historyStore';
import * as api from '@/lib/api';
import SessionItem from './SessionItem';
import EmptyState from '@/components/common/EmptyState';
import styles from './SessionList.module.css';

function SessionList() {
  const sessions = useHistoryStore((s) => s.sessions);
  const setSessions = useHistoryStore((s) => s.setSessions);
  const currentSessionId = useHistoryStore((s) => s.currentSessionId);
  const setCurrentSessionId = useHistoryStore((s) => s.setCurrentSessionId);
  const selectedSessions = useHistoryStore((s) => s.selectedSessions);
  const toggleSessionSelect = useHistoryStore((s) => s.toggleSessionSelect);

  const loadSessions = useCallback(async () => {
    try {
      const list = await api.getSessions();
      setSessions(list);
    } catch (err) {
      console.error('loadSessions error:', err);
    }
  }, [setSessions]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleSelect = useCallback(
    (id: string) => {
      setCurrentSessionId(id);
    },
    [setCurrentSessionId],
  );

  const handleToggleCheck = useCallback(
    (id: string) => {
      toggleSessionSelect(id);
    },
    [toggleSessionSelect],
  );

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>RECORDED SESSIONS</div>
      <div className={styles.list}>
        {sessions.length === 0 ? (
          <EmptyState message="No sessions recorded yet." />
        ) : (
          sessions.map((s) => (
            <SessionItem
              key={s.id}
              session={s}
              isSelected={currentSessionId === s.id}
              isChecked={selectedSessions.has(s.id)}
              onSelect={handleSelect}
              onToggleCheck={handleToggleCheck}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default React.memo(SessionList);
