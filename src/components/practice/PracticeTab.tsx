import { useEffect, useCallback, useMemo } from 'react';
import { usePracticeStore } from '@/store/practiceStore';
import { useSessionInfoStore } from '@/store/sessionInfoStore';
import { useUIStore } from '@/store/uiStore';
import * as api from '@/lib/api';
import { getF125TrackNames } from '@/lib/trackDatabase';
import RunsSidebar from './RunsSidebar';
import StintComparison from './StintComparison';
import SetupDelta from './SetupDelta';
import RaceFuelCalculator from './RaceFuelCalculator';
import LapTimeChart from './LapTimeChart';
import FuelChart from './FuelChart';
import TyreWearChart from './TyreWearChart';
import FuelVsPaceChart from './FuelVsPaceChart';
import BrakeTempChart from './BrakeTempChart';
import TyrePressureChart from './TyrePressureChart';
import ChartControls from './ChartControls';
import ConsistencyPanel from './ConsistencyPanel';
import LapCompare from './LapCompare';
import ERSChart from './ERSChart';
import FrictionCircle from './FrictionCircle';
import DeltaTelemetry from './DeltaTelemetry';
import EmptyState from '@/components/common/EmptyState';
import styles from './PracticeTab.module.css';

export default function PracticeTab() {
  const tracks = usePracticeStore((s) => s.tracks);
  const selectedTrack = usePracticeStore((s) => s.selectedTrack);
  const workbook = usePracticeStore((s) => s.workbook);
  const conditionFilter = usePracticeStore((s) => s.conditionFilter);
  const selectedRunIds = usePracticeStore((s) => s.selectedRunIds);
  const setTracks = usePracticeStore((s) => s.setTracks);
  const setSelectedTrack = usePracticeStore((s) => s.setSelectedTrack);
  const setWorkbook = usePracticeStore((s) => s.setWorkbook);
  const setConditionFilter = usePracticeStore((s) => s.setConditionFilter);

  const liveTrack = useSessionInfoStore((s) => s.trackName);
  const connectionStatus = useUIStore((s) => s.connectionStatus);

  // Auto-select live track if connected and nothing selected
  useEffect(() => {
    if (connectionStatus === 'live' && liveTrack && !selectedTrack) {
      setSelectedTrack(liveTrack);
    }
  }, [liveTrack, connectionStatus, selectedTrack, setSelectedTrack]);

  // Load track list on mount
  useEffect(() => {
    api.getPracticeTracks().then(setTracks).catch(console.error);
  }, [setTracks]);

  // Load workbook when track changes
  useEffect(() => {
    if (!selectedTrack) {
      setWorkbook(null);
      return;
    }
    api.getPracticeWorkbook(selectedTrack).then(setWorkbook).catch(console.error);
  }, [selectedTrack, setWorkbook]);

  const handleTrackChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedTrack(e.target.value || null);
    },
    [setSelectedTrack],
  );

  const handleImportFromHistory = useCallback(async () => {
    try {
      const sessions = await api.getSessions();
      const practiceSessions = sessions.filter(
        (s) =>
          s.track === selectedTrack &&
          /^P\d|^Short P|Time Trial/i.test(s.sessionType),
      );
      for (const s of practiceSessions) {
        await api.extractPracticeRuns(s.id);
      }
      if (selectedTrack) {
        const wb = await api.getPracticeWorkbook(selectedTrack);
        setWorkbook(wb);
        const trackList = await api.getPracticeTracks();
        setTracks(trackList);
      }
    } catch (err) {
      console.error('Import error:', err);
    }
  }, [selectedTrack, setWorkbook, setTracks]);

  const trackOptions = useMemo(() => {
    return getF125TrackNames().map((name) => {
      const summary = tracks.find((t) => t.trackName === name);
      return { name, runCount: summary?.runCount || 0 };
    });
  }, [tracks]);

  // Filter runs by condition
  const filteredRuns =
    workbook?.runs.filter((r) => {
      if (conditionFilter === 'all') return true;
      return r.condition === conditionFilter;
    }) ?? [];

  const selectedRuns = filteredRuns.filter((r) => selectedRunIds.has(r.id));
  const hasRuns = filteredRuns.length > 0;

  return (
    <div className={styles.container}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <span className={styles.toolbarLabel}>PRACTICE LAB</span>

        <select
          className="settings-select"
          value={selectedTrack ?? ''}
          onChange={handleTrackChange}
        >
          <option value="">Select track...</option>
          {trackOptions.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name} {t.runCount > 0 ? `(${t.runCount} runs)` : ''}
            </option>
          ))}
        </select>

        <div className={styles.filterGroup}>
          {(['all', 'dry', 'wet'] as const).map((f) => (
            <button
              key={f}
              className={
                conditionFilter === f
                  ? styles.filterBtnActive
                  : styles.filterBtn
              }
              onClick={() => setConditionFilter(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        {selectedTrack && (
          <button className="btn" onClick={handleImportFromHistory}>
            Import from History
          </button>
        )}
      </div>

      {/* ── Content ── */}
      {!selectedTrack ? (
        <div className={styles.content}>
          <EmptyState message="Select a track to open your practice workbook" />
        </div>
      ) : !hasRuns ? (
        <div className={styles.content}>
          <div className={styles.empty}>
            <div>No practice runs for {selectedTrack}</div>
            <div style={{ fontSize: '0.6rem' }}>
              Record a practice session or import from History
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.columns}>
          {/* ── Column 1: Runs Sidebar ── */}
          <RunsSidebar runs={filteredRuns} />

          {/* ── Column 2: Comparison Data ── */}
          <div className={styles.colComparison}>
            <RaceFuelCalculator runs={selectedRuns} trackName={selectedTrack!} />

            <LapCompare runs={selectedRuns} />
            {selectedRuns.length >= 2 ? (
              <>
                <StintComparison runs={selectedRuns} />
                <ConsistencyPanel runs={selectedRuns} />
                <SetupDelta runs={selectedRuns} />
              </>
            ) : selectedRuns.length === 1 ? (
              <>
                <StintComparison runs={selectedRuns} />
                <ConsistencyPanel runs={selectedRuns} />
                <SetupDelta runs={selectedRuns} />
              </>
            ) : (
              <div className={styles.colPlaceholder}>
                Select runs to compare
              </div>
            )}
          </div>

          {/* ── Column 3: Charts ── */}
          <div className={styles.colCharts}>
            {selectedRuns.length >= 1 ? (
              <>
                <ChartControls />
                <DeltaTelemetry runs={selectedRuns} />
                <LapTimeChart runs={selectedRuns} />
                <FuelChart runs={selectedRuns} />
                <TyreWearChart runs={selectedRuns} />
                <BrakeTempChart runs={selectedRuns} />
                <TyrePressureChart runs={selectedRuns} />
                <ERSChart runs={selectedRuns} />
                <FuelVsPaceChart runs={selectedRuns} />
                <FrictionCircle runs={selectedRuns} />
              </>
            ) : (
              <div className={styles.colPlaceholder}>
                Select runs to view charts
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
