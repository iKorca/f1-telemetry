import React, { useEffect, useState, useCallback } from 'react';
import { useHistoryStore } from '@/store/historyStore';
import * as api from '@/lib/api';
import type { SessionDetail as SessionDetailType } from '@shared/types';
import SessionHeaderBar from './SessionHeaderBar';
import SetupDisplay from './SetupDisplay';
import LapTable from './LapTable';
import ConsistencyStats from '@/components/shared/ConsistencyStats';
import StintCharts from '@/components/shared/StintCharts';
import ChartSection from '../charts/ChartSection';
import RaceAnalysis from '../analysis/RaceAnalysis';
import TrackMapHistory from '../analysis/TrackMapHistory';
import DriverComparison from '../analysis/DriverComparison';
import QualifyingLeaderboard from '../analysis/QualifyingLeaderboard';
import LapContextMenu from '../modals/LapContextMenu';
import EmptyState from '@/components/common/EmptyState';
import styles from './SessionDetail.module.css';

function SessionDetail() {
  const currentSessionId = useHistoryStore((s) => s.currentSessionId);
  const currentSession = useHistoryStore((s) => s.currentSession);
  const setCurrentSession = useHistoryStore((s) => s.setCurrentSession);

  const [selectedLapIdx, setSelectedLapIdx] = useState<number | null>(null);
  const [compareLapIdx, setCompareLapIdx] = useState<number | null>(null);
  const [showCharts, setShowCharts] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    lapIdx: number;
  } | null>(null);

  // Load session detail when ID changes
  useEffect(() => {
    if (!currentSessionId) {
      setCurrentSession(null);
      setSelectedLapIdx(null);
      setShowCharts(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const session = await api.getSession(currentSessionId);
        if (!cancelled) {
          setCurrentSession(session);
          setSelectedLapIdx(null);
          setCompareLapIdx(null);
          setShowCharts(false);
        }
      } catch (err) {
        console.error('loadSessionDetail error:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentSessionId, setCurrentSession]);

  const handleLapSelect = useCallback((lapIdx: number) => {
    setSelectedLapIdx(lapIdx);
    setCompareLapIdx(null);
    setShowCharts(true);
  }, []);

  const handleLapChange = useCallback((lapIdx: number) => {
    setSelectedLapIdx(lapIdx);
  }, []);

  const handleCompareChange = useCallback((lapIdx: number | null) => {
    setCompareLapIdx(lapIdx);
  }, []);

  const handleCloseCharts = useCallback(() => {
    setShowCharts(false);
    setSelectedLapIdx(null);
    setCompareLapIdx(null);
  }, []);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, lapIdx: number) => {
      setContextMenu({ x: e.clientX, y: e.clientY, lapIdx });
    },
    [],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const reloadSession = useCallback(async () => {
    if (!currentSessionId) return;
    try {
      const session = await api.getSession(currentSessionId);
      setCurrentSession(session);
    } catch (err) {
      console.error('reloadSession error:', err);
    }
  }, [currentSessionId, setCurrentSession]);

  if (!currentSessionId || !currentSession) {
    return <EmptyState message="Select a session to view details" />;
  }

  const isRace = /^(Race|Race 2|Race 3|Sprint)$/i.test(currentSession.sessionType || '');
  // Practice / qualifying / shootout / time-trial — anything where per-driver
  // best laps are the primary metric. Sprint-shootout sessions (Sprint SO*)
  // also qualify here: they're lap-time-ranked, not race-ordered.
  const isQualifyingLike =
    !isRace &&
    !!currentSession.raceData &&
    Object.keys(currentSession.raceData.carLaps || {}).length > 0;

  return (
    <div className={styles.container}>
      <SessionHeaderBar session={currentSession} />
      <SetupDisplay
        setup={currentSession.setup}
        lapSetups={currentSession.lapSetups}
      />
      <ConsistencyStats session={currentSession} />
      <LapTable
        session={currentSession}
        selectedLapIdx={selectedLapIdx}
        onLapSelect={handleLapSelect}
        onContextMenu={handleContextMenu}
      />

      {showCharts && selectedLapIdx !== null && (
        <ChartSection
          session={currentSession}
          selectedLapIdx={selectedLapIdx}
          compareLapIdx={compareLapIdx}
          onLapChange={handleLapChange}
          onCompareChange={handleCompareChange}
          onClose={handleCloseCharts}
        />
      )}

      {isRace && currentSession.raceData && (
        <div className={styles.analysisSection}>
          <RaceAnalysis session={currentSession} />
        </div>
      )}

      {isQualifyingLike && (
        <div className={styles.analysisSection}>
          <QualifyingLeaderboard
            session={currentSession}
            onOpenTelemetry={(a, b) => {
              setSelectedLapIdx(a);
              setCompareLapIdx(b);
              setShowCharts(true);
              // Scroll into view so the user sees the new ChartSection.
              setTimeout(() => {
                document.querySelector('[data-chart-section]')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                });
              }, 50);
            }}
          />
        </div>
      )}

      <div className={styles.analysisSection}>
        <StintCharts session={currentSession} />
      </div>

      {selectedLapIdx !== null && (
        <div className={styles.analysisSection}>
          <TrackMapHistory
            session={currentSession}
            lapIdx={selectedLapIdx}
          />
        </div>
      )}

      {isRace && currentSession.raceData && (
        <div className={styles.analysisSection}>
          <DriverComparison session={currentSession} />
        </div>
      )}

      {contextMenu && (
        <LapContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          session={currentSession}
          lapIdx={contextMenu.lapIdx}
          onClose={handleCloseContextMenu}
          onReload={reloadSession}
          onShowCharts={handleLapSelect}
        />
      )}
    </div>
  );
}

export default React.memo(SessionDetail);
