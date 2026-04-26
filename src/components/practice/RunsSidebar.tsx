import React, { useCallback, useState } from 'react';
import type { PracticeRun } from '@shared/types';
import { usePracticeStore } from '@/store/practiceStore';
import { fmtTime } from '@/lib/formatters';
import * as api from '@/lib/api';
import styles from './PracticeTab.module.css';

interface RunsSidebarProps {
  runs: PracticeRun[];
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

export default function RunsSidebar({ runs }: RunsSidebarProps) {
  const selectedRunIds = usePracticeStore((s) => s.selectedRunIds);
  const baselineRunId = usePracticeStore((s) => s.baselineRunId);
  const toggleRunSelection = usePracticeStore((s) => s.toggleRunSelection);
  const setBaselineRunId = usePracticeStore((s) => s.setBaselineRunId);
  const updateRun = usePracticeStore((s) => s.updateRun);
  const selectedTrack = usePracticeStore((s) => s.selectedTrack);
  const setWorkbook = usePracticeStore((s) => s.setWorkbook);
  const [collapsed, setCollapsed] = useState(false);

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
    <div className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
      <div className={styles.sidebarHeader}>
        {!collapsed && (
          <span className={styles.sectionTitle} style={{ margin: 0 }}>
            RUNS ({runs.length})
          </span>
        )}
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '\u25B6' : '\u25C0'}
        </button>
      </div>

      {!collapsed && (
        <div className={styles.sidebarList}>
          {sorted.map((run) => {
            const isSelected = selectedRunIds.has(run.id);
            const isBaseline = run.id === baselineRunId;

            return (
              <div
                key={run.id}
                className={`${styles.runCard} ${isSelected ? styles.runCardSelected : ''} ${isBaseline ? styles.runCardBaseline : ''}`}
              >
                <div className={styles.runCardTop}>
                  <input
                    type="checkbox"
                    className={styles.runCheck}
                    checked={isSelected}
                    onChange={() => toggleRunSelection(run.id)}
                  />
                  <span
                    className={`${styles.compoundBadge} ${styles[run.compound.toLowerCase()] || ''}`}
                  >
                    {run.compound}
                  </span>
                  <span
                    className={`${styles.conditionTag} ${run.condition === 'wet' ? styles.tagWet : styles.tagDry}`}
                  >
                    {run.condition.toUpperCase()}
                  </span>
                  <span className={styles.runCardDate}>{fmtDate(run.timestamp)}</span>
                </div>

                <input
                  className={styles.runCardLabel}
                  value={run.label}
                  placeholder={run.compound ? `${run.compound} STINT` : 'UNNAMED'}
                  onChange={(e) => handleLabelChange(run.id, e.target.value)}
                />

                <div className={styles.runCardStats}>
                  <span>
                    Best: {run.bestLapMs > 0 ? fmtTime(run.bestLapMs) : '\u2014'}
                  </span>
                  <span>
                    {run.validLapCount}/{run.lapCount} laps
                  </span>
                </div>
                <div className={styles.runCardStats}>
                  <span>
                    Avg: {run.avgLapMs > 0 ? fmtTime(run.avgLapMs) : '\u2014'}
                  </span>
                  <span>
                    {run.consistency > 0 ? `${run.consistency}%` : '\u2014'} cons.
                  </span>
                </div>

                <div className={styles.runCardActions}>
                  <button
                    className={styles.runCardBtn}
                    style={isBaseline ? { color: 'var(--green)', borderColor: 'var(--green)' } : undefined}
                    onClick={() => handleBaselineClick(run.id)}
                  >
                    {isBaseline ? 'BASE' : 'Set Base'}
                  </button>
                  <button
                    className={styles.runCardBtn}
                    style={{ color: 'var(--red)', borderColor: 'rgba(232,0,45,0.3)' }}
                    onClick={() => handleDelete(run.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
