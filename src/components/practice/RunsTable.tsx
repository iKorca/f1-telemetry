import React, { useCallback } from 'react';
import type { PracticeRun } from '@shared/types';
import { usePracticeStore } from '@/store/practiceStore';
import { fmtTime, fmtDelta } from '@/lib/formatters';
import * as api from '@/lib/api';
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

  const baselineRun = runs.find((r) => r.id === baselineRunId);
  const baselineBest = baselineRun?.bestLapMs ?? 0;

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
      try {
        const wb = await api.deletePracticeRun(selectedTrack, runId);
        setWorkbook(wb);
      } catch (err) {
        console.error('Delete run error:', err);
      }
    },
    [selectedTrack, setWorkbook],
  );

  const handleBaselineClick = useCallback(
    (runId: string) => {
      setBaselineRunId(baselineRunId === runId ? null : runId);
    },
    [baselineRunId, setBaselineRunId],
  );

  // Sort: pinned first, then by timestamp descending
  const sorted = [...runs].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.timestamp - a.timestamp;
  });

  return (
    <div>
      <div className={styles.sectionTitle}>RUNS</div>
      <table className={styles.runsTable}>
        <thead>
          <tr>
            <th></th>
            <th>DATE</th>
            <th>LABEL</th>
            <th>TYRE</th>
            <th>COND</th>
            <th>LAPS</th>
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
            const delta =
              baselineBest > 0 && run.bestLapMs > 0
                ? run.bestLapMs - baselineBest
                : null;

            return (
              <tr
                key={run.id}
                className={[
                  isSelected ? styles.runSelected : '',
                  isBaseline ? styles.runBaseline : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
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
                <td>
                  <input
                    className={styles.labelInput}
                    value={run.label}
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
                <td>
                  <button
                    className="btn"
                    style={{
                      fontSize: '0.45rem',
                      padding: '0.1rem 0.3rem',
                      color: 'var(--red)',
                      borderColor: 'rgba(232,0,45,0.3)',
                    }}
                    onClick={() => handleDelete(run.id)}
                  >
                    x
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
