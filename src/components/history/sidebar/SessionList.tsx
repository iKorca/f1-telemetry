import React, { useEffect, useCallback, useMemo, useState } from 'react';
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

  const [trackFilter, setTrackFilter] = useState('');

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

  const uniqueTracks = useMemo(() => {
    const trackSet = new Set<string>();
    for (const s of sessions) {
      if (s.track) trackSet.add(s.track);
    }
    return Array.from(trackSet).sort();
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (!trackFilter) return sessions;
    return sessions.filter((s) => s.track === trackFilter);
  }, [sessions, trackFilter]);

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

  const handleTrackChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setTrackFilter(e.target.value);
    },
    [],
  );

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>RECORDED SESSIONS</div>
      {uniqueTracks.length > 1 && (
        <div className={styles.filterRow}>
          <select
            className={styles.trackSelect}
            value={trackFilter}
            onChange={handleTrackChange}
          >
            <option value="">All Tracks</option>
            {uniqueTracks.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}
      <div className={styles.list}>
        {filteredSessions.length === 0 ? (
          <EmptyState message={trackFilter ? 'No sessions for this track.' : 'No sessions recorded yet.'} />
        ) : (
          filteredSessions.map((s) => (
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
