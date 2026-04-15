import { useEffect, useCallback } from 'react';
import { usePracticeStore } from '@/store/practiceStore';
import * as api from '@/lib/api';
import RunsTable from './RunsTable';
import StintComparison from './StintComparison';
import SetupDelta from './SetupDelta';
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
    // Import all practice sessions for the current track
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

  // Filter runs by condition
  const filteredRuns =
    workbook?.runs.filter((r) => {
      if (conditionFilter === 'all') return true;
      return r.condition === conditionFilter;
    }) ?? [];

  const selectedRuns = filteredRuns.filter((r) => selectedRunIds.has(r.id));

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarLabel}>PRACTICE LAB</span>

        <select
          className="settings-select"
          value={selectedTrack ?? ''}
          onChange={handleTrackChange}
        >
          <option value="">Select track...</option>
          {tracks.map((t) => (
            <option key={t.trackName} value={t.trackName}>
              {t.trackName} ({t.runCount} runs)
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

      <div className={styles.content}>
        {!selectedTrack ? (
          <EmptyState message="Select a track to open your practice workbook" />
        ) : filteredRuns.length === 0 ? (
          <div className={styles.empty}>
            <div>No practice runs for {selectedTrack}</div>
            <div style={{ fontSize: '0.6rem' }}>
              Record a practice session or import from History
            </div>
          </div>
        ) : (
          <>
            <RunsTable runs={filteredRuns} />

            {selectedRuns.length >= 2 && (
              <>
                <StintComparison runs={selectedRuns} />
                <SetupDelta runs={selectedRuns} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
