import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { SessionDetail } from '@shared/types';
import { useUIStore } from '@/store/uiStore';
import { getCurrentSession } from '@/lib/api';
import LiveSessionHeader from './LiveSessionHeader';
import LiveSetup from './LiveSetup';
import LiveLapTable from './LiveLapTable';
import LiveCharts from './LiveCharts';
import ConsistencyStats from '@/components/shared/ConsistencyStats';
import StintCharts from '@/components/shared/StintCharts';
import styles from './SessionTab.module.css';

function SessionTab() {
  const isRecording = useUIStore((s) => s.isRecording);
  const activeTab = useUIStore((s) => s.activeTab);

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [selectedLap, setSelectedLap] = useState<number | null>(null);
  const [compareLap, setCompareLap] = useState<number | null>(null);
  const prevLapCountRef = useRef(0);

  const loadSession = useCallback(async () => {
    try {
      const data = await getCurrentSession();
      if (!data) {
        setSession(null);
        prevLapCountRef.current = 0;
        return;
      }
      setSession(data);

      // Only trigger re-analysis when lap count changes
      const newLapCount = data.laps?.length || 0;
      if (newLapCount !== prevLapCountRef.current) {
        prevLapCountRef.current = newLapCount;
      }
    } catch (err) {
      console.error('loadLiveSession error:', err);
    }
  }, []);

  // Poll every 2s when recording and on the session tab
  useEffect(() => {
    if (!isRecording || activeTab !== 'session') return;

    // Immediately load
    loadSession();

    const timer = setInterval(loadSession, 2000);
    return () => clearInterval(timer);
  }, [isRecording, activeTab, loadSession]);

  // Also load once when switching to the session tab while recording
  useEffect(() => {
    if (activeTab === 'session' && isRecording) {
      loadSession();
    }
  }, [activeTab, isRecording, loadSession]);

  const handleLapClick = useCallback((lapIdx: number) => {
    setSelectedLap(lapIdx);
  }, []);

  const handleCloseCharts = useCallback(() => {
    setSelectedLap(null);
    setCompareLap(null);
  }, []);

  const handleLapChange = useCallback((lapIdx: number) => {
    setSelectedLap(lapIdx);
  }, []);

  const handleCompareChange = useCallback((lapIdx: number | null) => {
    setCompareLap(lapIdx);
  }, []);

  // Not recording or no session data: show placeholder
  if (!isRecording || !session) {
    return (
      <div className={styles.placeholder}>
        <div className={styles.placeholderIcon}>{'\u23FA'}</div>
        <div className={styles.placeholderTitle}>No Active Recording</div>
        <div className={styles.placeholderText}>
          Start recording from the header to see live session data here.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <LiveSessionHeader session={session} />
      <LiveSetup setup={session.setup} />
      <div className={styles.content}>
        <LiveLapTable
          session={session}
          selectedLap={selectedLap}
          onLapClick={handleLapClick}
        />

        {selectedLap !== null && (
          <LiveCharts
            session={session}
            selectedLap={selectedLap}
            compareLap={compareLap}
            onLapChange={handleLapChange}
            onCompareChange={handleCompareChange}
            onClose={handleCloseCharts}
          />
        )}

        <div className={styles.analysis}>
          <ConsistencyStats session={session} />
          <StintCharts session={session} />
        </div>
      </div>
    </div>
  );
}

export default React.memo(SessionTab);
