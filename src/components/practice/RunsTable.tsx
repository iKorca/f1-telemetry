import React, { useCallback, useState } from 'react';
import type { PracticeRun } from '@shared/types';
import { usePracticeStore } from '@/store/practiceStore';
import { fmtTime, fmtDelta } from '@/lib/formatters';
import * as api from '@/lib/api';
import { invalidateSessionFrames } from '@/hooks/useLapFrames';
import { useToast } from '@/hooks/useToast';
import SetupGrid from '@/components/shared/SetupGrid';
import styles from './PracticeTab.module.css';

interface RunsTableProps {
  runs: PracticeRun[];
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function RunsTable({ runs }: RunsTableProps) {
  const selectedRunIds = usePracticeStore((s) => s.selectedRunIds);
  const baselineRunId = usePracticeStore((s) => s.baselineRunId);
  const toggleRunSelection = usePracticeStore((s) => s.toggleRunSelection);
  const setBaselineRunId = usePracticeStore((s) => s.setBaselineRunId);
  const updateRun = usePracticeStore((s) => s.updateRun);
  const selectedTrack = usePracticeStore((s) => s.selectedTrack);
  const setWorkbook = usePracticeStore((s) => s.setWorkbook);
  const refRunId = usePracticeStore((s) => s.referenceRunId);
  const refLapNum = usePracticeStore((s) => s.referenceLapNum);
  const setReferenceLap = usePracticeStore((s) => s.setReferenceLap);
  const cmpRunId = usePracticeStore((s) => s.comparisonRunId);
  const cmpLapNum = usePracticeStore((s) => s.comparisonLapNum);
  const setComparisonLap = usePracticeStore((s) => s.setComparisonLap);
  const toast = useToast();

  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(new Set());
  const [expandedSetupIds, setExpandedSetupIds] = useState<Set<string>>(new Set());
  // Lap-level: which rows currently have the note editor open
  const [notingLap, setNotingLap] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');

  const baselineRun = runs.find((r) => r.id === baselineRunId);
  const baselineBest = baselineRun?.bestLapMs ?? 0;

  const toggleExpand = useCallback((runId: string) => {
    setExpandedRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  }, []);

  const toggleSetup = useCallback((runId: string) => {
    setExpandedSetupIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  }, []);

  const handleLabelChange = useCallback(
    (runId: string, label: string) => {
      updateRun(runId, { label });
      if (selectedTrack) {
        api.updatePracticeRun(selectedTrack, runId, { label }).catch(console.error);
      }
    },
    [updateRun, selectedTrack],
  );

  const handleDelete = useCallback(
    async (runId: string) => {
      if (!selectedTrack) return;
      const run = runs.find((r) => r.id === runId);
      try {
        const wb = await api.deletePracticeRun(selectedTrack, runId);
        setWorkbook(wb);
        if (run?.sessionId) invalidateSessionFrames(run.sessionId);
        toast(`Deleted ${run?.label || run?.compound || 'run'}`, 'success');
      } catch (err) {
        console.error('Delete run error:', err);
        toast(`Delete failed: ${(err as Error).message}`, 'error');
      }
    },
    [selectedTrack, setWorkbook, runs, toast],
  );

  const handleSplit = useCallback(
    async (runId: string, atLap: number) => {
      if (!selectedTrack) return;
      const run = runs.find((r) => r.id === runId);
      try {
        const wb = await api.splitPracticeRun(selectedTrack, runId, atLap);
        setWorkbook(wb);
        if (run?.sessionId) invalidateSessionFrames(run.sessionId);
        toast(`Split at lap ${atLap}`, 'success');
      } catch (err) {
        console.error('Split run error:', err);
        toast(`Split failed: ${(err as Error).message}`, 'error');
      }
    },
    [selectedTrack, setWorkbook, runs, toast],
  );

  const handleMerge = useCallback(
    async (primaryRunId: string, withRunId: string) => {
      if (!selectedTrack) return;
      if (!window.confirm('Merge this run into the previous one? The label will be concatenated.')) return;
      const primary = runs.find((r) => r.id === primaryRunId);
      try {
        const wb = await api.mergePracticeRuns(selectedTrack, primaryRunId, withRunId);
        setWorkbook(wb);
        if (primary?.sessionId) invalidateSessionFrames(primary.sessionId);
        toast('Merged runs', 'success');
      } catch (err) {
        console.error('Merge runs error:', err);
        toast(`Merge failed: ${(err as Error).message}`, 'error');
      }
    },
    [selectedTrack, setWorkbook, runs, toast],
  );

  const handleBaselineClick = useCallback(
    (runId: string) => {
      setBaselineRunId(baselineRunId === runId ? null : runId);
    },
    [baselineRunId, setBaselineRunId],
  );

  // Persist a lap-level change and reflect it locally so the UI updates without
  // waiting for a workbook round-trip.
  const patchLap = useCallback(
    async (runId: string, lapNum: number, changes: { flag?: string | null; notes?: string; valid?: boolean }) => {
      if (!selectedTrack) return;
      try {
        // Optimistic local update
        const run = runs.find((r) => r.id === runId);
        if (run && run.laps) {
          const lap = run.laps.find((l) => l.lapNum === lapNum);
          if (lap) {
            if (changes.flag !== undefined) lap.flag = (changes.flag || null) as any;
            if (changes.notes !== undefined) lap.notes = changes.notes;
            if (changes.valid !== undefined) lap.valid = changes.valid;
          }
          updateRun(runId, { laps: run.laps });
        }
        await api.updatePracticeLap(selectedTrack, runId, lapNum, changes);
      } catch (err) {
        console.error('updatePracticeLap error:', err);
      }
    },
    [runs, selectedTrack, updateRun],
  );

  const cycleFlag = (current: string | null | undefined): string | null => {
    switch (current) {
      case null:
      case undefined:
        return 'traffic';
      case 'traffic':
        return 'mistake';
      case 'mistake':
        return 'clean';
      case 'clean':
        return null;
      default:
        return null;
    }
  };

  // Sort: pinned first, then by timestamp descending
  const sorted = [...runs].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.timestamp - a.timestamp;
  });

  // For each sorted run, find the previous run in the same session — that's
  // the only neighbour we let users merge backwards into (merging across
  // sessions would mix unrelated laps).
  const prevRunInSession = new Map<string, string>();
  {
    const bySession = new Map<string, typeof sorted>();
    for (const r of sorted) {
      const arr = bySession.get(r.sessionId) || [];
      arr.push(r);
      bySession.set(r.sessionId, arr);
    }
    for (const arr of bySession.values()) {
      // Sort ascending by earliest lap for intuitive "previous stint" semantics
      arr.sort((a, b) => {
        const aMin = a.laps?.length ? Math.min(...a.laps.map(l => l.lapNum)) : 0;
        const bMin = b.laps?.length ? Math.min(...b.laps.map(l => l.lapNum)) : 0;
        return aMin - bMin;
      });
      for (let i = 1; i < arr.length; i++) {
        prevRunInSession.set(arr[i].id, arr[i - 1].id);
      }
    }
  }

  // Total column count (without delta column)
  const baseColCount = 12;
  const totalCols = baselineBest > 0 ? baseColCount + 1 : baseColCount;

  return (
    <div>
      <div className={styles.sectionTitle}>RUNS</div>
      <table className={styles.runsTable}>
        <thead>
          <tr>
            <th></th>
            <th></th>
            <th>DATE</th>
            <th>LABEL</th>
            <th>TYRE</th>
            <th>COND</th>
            <th>LAPS</th>
            <th>SETUP</th>
            <th>BEST LAP</th>
            {baselineBest > 0 && <th>DELTA</th>}
            <th>AVG</th>
            <th>MAX SPD</th>
            <th>CONSIST.</th>
            <th>BASELINE</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((run) => {
            const isSelected = selectedRunIds.has(run.id);
            const isBaseline = run.id === baselineRunId;
            const isExpanded = expandedRunIds.has(run.id);
            const delta =
              baselineBest > 0 && run.bestLapMs > 0
                ? run.bestLapMs - baselineBest
                : null;
            const hasLaps = run.laps && run.laps.length > 0;

            return (
              <React.Fragment key={run.id}>
                <tr
                  className={[
                    isSelected ? styles.runSelected : '',
                    isBaseline ? styles.runBaseline : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <td>
                    {hasLaps && (
                      <button
                        className={styles.expandBtn}
                        onClick={() => toggleExpand(run.id)}
                        title={isExpanded ? 'Collapse laps' : 'Expand laps'}
                      >
                        {isExpanded ? '\u25BC' : '\u25B6'}
                      </button>
                    )}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      className={styles.runCheck}
                      checked={isSelected}
                      onChange={() => toggleRunSelection(run.id)}
                    />
                  </td>
                  <td style={{ color: 'var(--grey-light)' }}>
                    {fmtDate(run.timestamp)}
                  </td>
                  <td className={styles.labelCell}>
                    <input
                      className={styles.labelInput}
                      value={run.label}
                      placeholder={run.compound ? `${run.compound} STINT` : 'UNNAMED'}
                      onChange={(e) =>
                        handleLabelChange(run.id, e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <span
                      className={`${styles.compoundBadge} ${styles[run.compound.toLowerCase()] || ''}`}
                    >
                      {run.compound}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.conditionTag} ${run.condition === 'wet' ? styles.tagWet : styles.tagDry}`}
                    >
                      {run.condition.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {run.validLapCount}/{run.lapCount}
                  </td>
                  <td>
                    <button
                      className={expandedSetupIds.has(run.id) ? styles.setupBtnActive : styles.setupBtn}
                      onClick={() => toggleSetup(run.id)}
                    >
                      SETUP
                    </button>
                  </td>
                  <td>
                    {run.bestLapMs > 0 ? fmtTime(run.bestLapMs) : '\u2014'}
                  </td>
                  {baselineBest > 0 && (
                    <td>
                      {delta !== null && delta !== 0 ? (
                        <span
                          className={`${styles.delta} ${delta > 0 ? styles.deltaPositive : styles.deltaNegative}`}
                        >
                          {delta > 0 ? '+' : ''}
                          {fmtDelta(delta)}
                        </span>
                      ) : delta === 0 ? (
                        <span className={`${styles.delta} ${styles.deltaZero}`}>
                          BASE
                        </span>
                      ) : (
                        '\u2014'
                      )}
                    </td>
                  )}
                  <td>
                    {run.avgLapMs > 0 ? fmtTime(run.avgLapMs) : '\u2014'}
                  </td>
                  <td>{run.maxSpeed > 0 ? `${run.maxSpeed}` : '\u2014'}</td>
                  <td
                    style={{
                      color:
                        run.consistency > 80
                          ? 'var(--green)'
                          : run.consistency > 50
                            ? 'var(--yellow)'
                            : 'var(--red)',
                    }}
                  >
                    {run.consistency > 0 ? `${run.consistency}%` : '\u2014'}
                  </td>
                  <td>
                    <button
                      className="btn"
                      style={{
                        fontSize: '0.5rem',
                        padding: '0.15rem 0.4rem',
                        color: isBaseline ? 'var(--green)' : undefined,
                        borderColor: isBaseline
                          ? 'var(--green)'
                          : undefined,
                      }}
                      onClick={() => handleBaselineClick(run.id)}
                    >
                      {isBaseline ? 'BASE' : 'Set'}
                    </button>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', display: 'flex', gap: 2 }}>
                    {prevRunInSession.has(run.id) && (
                      <button
                        className={styles.btnXs}
                        aria-label="Merge with previous stint"
                        title="Merge this run into the previous stint in the same session"
                        onClick={() => {
                          const prevId = prevRunInSession.get(run.id);
                          if (prevId) handleMerge(prevId, run.id);
                        }}
                      >
                        MERGE↑
                      </button>
                    )}
                    <button
                      className={styles.btnXs}
                      aria-label="Export run as CSV"
                      title="Export run as CSV"
                      onClick={() => {
                        if (!selectedTrack) return;
                        window.open(
                          `/api/practice/${encodeURIComponent(selectedTrack)}/runs/${run.id}/export?format=csv`,
                          '_blank',
                        );
                        toast('CSV download started', 'success', 2500);
                      }}
                    >
                      CSV
                    </button>
                    <button
                      className={styles.btnXs}
                      aria-label="Export run as JSON"
                      title="Export run as JSON"
                      onClick={() => {
                        if (!selectedTrack) return;
                        window.open(
                          `/api/practice/${encodeURIComponent(selectedTrack)}/runs/${run.id}/export?format=json`,
                          '_blank',
                        );
                        toast('JSON download started', 'success', 2500);
                      }}
                    >
                      JSON
                    </button>
                    <button
                      className={`${styles.btnXs} ${styles.btnXsDanger}`}
                      aria-label="Delete run"
                      title="Delete run"
                      onClick={() => handleDelete(run.id)}
                    >
                      ×
                    </button>
                  </td>
                </tr>

                {/* ── Expanded lap rows ── */}
                {isExpanded && hasLaps && run.laps!.map((lap, i) => {
                  const isBestLap = lap.lapTimeMs > 0 && lap.lapTimeMs === run.bestLapMs;
                  const lapDelta = baselineBest > 0 && lap.lapTimeMs > 0
                    ? lap.lapTimeMs - baselineBest
                    : null;
                  // Also compute delta vs run's own best
                  const runDelta = run.bestLapMs > 0 && lap.lapTimeMs > 0
                    ? lap.lapTimeMs - run.bestLapMs
                    : null;

                  return (
                    <tr
                      key={`${run.id}_lap_${i}`}
                      className={`${styles.lapDetailRow} ${!lap.valid ? styles.lapInvalid : ''}`}
                    >
                      <td></td>
                      <td></td>
                      <td>
                        <span className={styles.lapNum}>
                          L{lap.lapNum}
                          {lap.isOutLap && <span style={{ color: 'var(--yellow)', marginLeft: '4px', fontSize: '0.45rem' }}>[OUT]</span>}
                          {lap.trafficLap && (
                            <span
                              title="Auto-flagged as traffic (lap-time / max-speed / S3 outside 2.5×MAD of stint median)"
                              style={{ color: 'var(--orange)', marginLeft: '4px', fontSize: '0.45rem' }}
                            >
                              [TRAFFIC]
                            </span>
                          )}
                          {lap.flag === 'mistake' && (
                            <span style={{ color: 'var(--red)', marginLeft: '4px', fontSize: '0.45rem' }}>[MISTAKE]</span>
                          )}
                          {lap.flag === 'reference' && (
                            <span style={{ color: 'var(--blue)', marginLeft: '4px', fontSize: '0.45rem' }}>[REF]</span>
                          )}
                        </span>
                      </td>
                      <td colSpan={3}>
                        <span style={{ color: 'var(--grey)', fontSize: '0.52rem' }}>
                          S1 {lap.s1Ms > 0 ? fmtTime(lap.s1Ms) : '\u2014'}
                          {' \u00B7 '}
                          S2 {lap.s2Ms > 0 ? fmtTime(lap.s2Ms) : '\u2014'}
                          {' \u00B7 '}
                          S3 {lap.s3Ms > 0 ? fmtTime(lap.s3Ms) : '\u2014'}
                        </span>
                      </td>
                      <td className={isBestLap ? styles.lapBest : undefined}>
                        {lap.lapTimeMs > 0 ? fmtTime(lap.lapTimeMs) : '\u2014'}
                      </td>
                      {baselineBest > 0 && (
                        <td>
                          {lapDelta !== null && lapDelta !== 0 ? (
                            <span className={`${styles.delta} ${lapDelta > 0 ? styles.deltaPositive : styles.deltaNegative}`}>
                              {lapDelta > 0 ? '+' : ''}{fmtDelta(lapDelta)}
                            </span>
                          ) : '\u2014'}
                        </td>
                      )}
                      <td>
                        {runDelta !== null && runDelta > 0 ? (
                          <span style={{ color: 'var(--grey)', fontSize: '0.52rem' }}>
                            +{fmtDelta(runDelta)}
                          </span>
                        ) : runDelta === 0 ? (
                          <span style={{ color: 'var(--green)', fontSize: '0.52rem' }}>best</span>
                        ) : '\u2014'}
                      </td>
                      <td>{lap.maxSpeed > 0 ? lap.maxSpeed : '\u2014'}</td>
                      <td colSpan={2} style={{ fontSize: '0.52rem', color: 'var(--grey)' }}>
                        Tyre age: {lap.tyreAge}
                        {lap.fuel > 0 && ` · Fuel: ${lap.fuel.toFixed(2)} kg`}
                        {!lap.valid && ' · invalid'}
                        {lap.notes && (
                          <span title={lap.notes} style={{ color: 'var(--yellow)', marginLeft: '4px' }}>
                            · note
                          </span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          <button
                            className={`${styles.btnXs} ${refRunId === run.id && refLapNum === lap.lapNum ? styles.btnXsActive : ''}`}
                            aria-pressed={refRunId === run.id && refLapNum === lap.lapNum}
                            title="Pin this lap as the chart reference (Δ mode)"
                            onClick={() => {
                              if (refRunId === run.id && refLapNum === lap.lapNum) setReferenceLap(null, null);
                              else setReferenceLap(run.id, lap.lapNum);
                            }}
                          >
                            REF
                          </button>
                          <button
                            className={styles.btnXs}
                            aria-pressed={cmpRunId === run.id && cmpLapNum === lap.lapNum}
                            style={
                              cmpRunId === run.id && cmpLapNum === lap.lapNum
                                ? { color: 'var(--orange)', borderColor: 'rgba(246,148,24,0.5)' }
                                : undefined
                            }
                            title="Pin this lap as the compare lap"
                            onClick={() => {
                              if (cmpRunId === run.id && cmpLapNum === lap.lapNum) setComparisonLap(null, null);
                              else setComparisonLap(run.id, lap.lapNum);
                            }}
                          >
                            CMP
                          </button>
                          <button
                            className={styles.btnXs}
                            style={
                              lap.flag === 'mistake' ? { color: 'var(--red)' }
                              : lap.flag === 'traffic' ? { color: 'var(--orange)' }
                              : lap.flag === 'clean' ? { color: 'var(--green)' }
                              : undefined
                            }
                            title={`Cycle flag (current: ${lap.flag || 'none'})`}
                            onClick={() => patchLap(run.id, lap.lapNum, { flag: cycleFlag(lap.flag) })}
                          >
                            {lap.flag ? String(lap.flag).slice(0, 4).toUpperCase() : 'FLAG'}
                          </button>
                          <button
                            className={`${styles.btnXs} ${!lap.valid ? styles.btnXsDanger : ''}`}
                            aria-pressed={!lap.valid}
                            title="Toggle valid (exclude from best/avg)"
                            onClick={() => patchLap(run.id, lap.lapNum, { valid: !lap.valid })}
                          >
                            {lap.valid ? 'VALID' : 'INVAL'}
                          </button>
                          <button
                            className={styles.btnXs}
                            title={lap.notes ? `Edit note: "${lap.notes}"` : 'Add note'}
                            onClick={() => {
                              const key = `${run.id}_${lap.lapNum}`;
                              if (notingLap === key) setNotingLap(null);
                              else {
                                setNotingLap(key);
                                setNoteDraft(lap.notes || '');
                              }
                            }}
                          >
                            NOTE
                          </button>
                          {run.laps && i > 0 && (
                            <button
                              className={styles.btnXs}
                              style={{ color: 'var(--orange)' }}
                              title={`Split stint starting from lap ${lap.lapNum} (creates two stints)`}
                              onClick={() => handleSplit(run.id, lap.lapNum)}
                            >
                              SPLIT↕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Inline note editor, one per expanded lap at a time */}
                {isExpanded && hasLaps && run.laps!.map((lap) => {
                  const key = `${run.id}_${lap.lapNum}`;
                  if (notingLap !== key) return null;
                  return (
                    <tr key={`${key}_note`} className={styles.lapDetailRow}>
                      <td colSpan={100} style={{ padding: '0.4rem 0.6rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-d)', fontSize: '0.5rem', color: 'var(--grey)' }}>
                            L{lap.lapNum} NOTE
                          </span>
                          <input
                            autoFocus
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                patchLap(run.id, lap.lapNum, { notes: noteDraft });
                                setNotingLap(null);
                              }
                              if (e.key === 'Escape') setNotingLap(null);
                            }}
                            placeholder="e.g. locked up T1, DRS failed..."
                            style={{
                              flex: 1,
                              background: 'transparent',
                              border: '1px solid var(--border)',
                              borderRadius: '3px',
                              color: 'var(--white)',
                              fontFamily: 'var(--font-d)',
                              fontSize: '0.55rem',
                              padding: '0.2rem 0.4rem',
                            }}
                          />
                          <button
                            className="btn"
                            style={{ fontSize: '0.5rem' }}
                            onClick={() => {
                              patchLap(run.id, lap.lapNum, { notes: noteDraft });
                              setNotingLap(null);
                            }}
                          >
                            SAVE
                          </button>
                          <button
                            className="btn"
                            style={{ fontSize: '0.5rem' }}
                            onClick={() => setNotingLap(null)}
                          >
                            CANCEL
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* ── Expanded setup row ── */}
                {expandedSetupIds.has(run.id) && run.setup && (
                  <tr className={styles.setupRow}>
                    <td colSpan={100}>
                      <div className={styles.setupDetail}>
                        <SetupGrid
                          setup={run.setup}
                          columns={3}
                          label="STINT SETUP"
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

