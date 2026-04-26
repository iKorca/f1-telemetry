import React from 'react';
import { usePracticeStore } from '@/store/practiceStore';
import styles from './PracticeTab.module.css';

/**
 * Shared control strip for the charts column. Toggles x-axis, delta mode,
 * invalid-lap inclusion, and chart palette.
 */
export default function ChartControls() {
  const xAxisMode = usePracticeStore((s) => s.xAxisMode);
  const setXAxisMode = usePracticeStore((s) => s.setXAxisMode);
  const refRunId = usePracticeStore((s) => s.referenceRunId);
  const refLapNum = usePracticeStore((s) => s.referenceLapNum);
  const setReferenceLap = usePracticeStore((s) => s.setReferenceLap);
  const cmpRunId = usePracticeStore((s) => s.comparisonRunId);
  const cmpLapNum = usePracticeStore((s) => s.comparisonLapNum);
  const setComparisonLap = usePracticeStore((s) => s.setComparisonLap);
  const includeInvalid = usePracticeStore((s) => s.includeInvalidLaps);
  const setIncludeInvalid = usePracticeStore((s) => s.setIncludeInvalidLaps);
  const palette = usePracticeStore((s) => s.chartPalette);
  const setPalette = usePracticeStore((s) => s.setChartPalette);
  const workbook = usePracticeStore((s) => s.workbook);

  const refRun = workbook?.runs.find((r) => r.id === refRunId);
  const cmpRun = workbook?.runs.find((r) => r.id === cmpRunId);

  return (
    <div
      role="toolbar"
      aria-label="Chart controls"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.8rem',
        padding: '0.4rem 0.2rem',
        borderBottom: '1px dashed var(--border)',
        marginBottom: '0.4rem',
        flexWrap: 'wrap',
      }}
    >
      <span className={styles.toolbarLabel}>X-AXIS</span>
      <div className={styles.filterGroup} role="group" aria-label="X-axis mode">
        <button
          className={xAxisMode === 'lap' ? styles.filterBtnActive : styles.filterBtn}
          onClick={() => setXAxisMode('lap')}
          aria-pressed={xAxisMode === 'lap'}
        >
          STINT LAP
        </button>
        <button
          className={xAxisMode === 'tyreAge' ? styles.filterBtnActive : styles.filterBtn}
          onClick={() => setXAxisMode('tyreAge')}
          aria-pressed={xAxisMode === 'tyreAge'}
          title="Align all runs by tyre age (out-laps collapse to 0)"
        >
          TYRE AGE
        </button>
      </div>

      <span className={styles.toolbarLabel}>LAPS</span>
      <button
        className={includeInvalid ? styles.btnXsActive : styles.btnXs}
        onClick={() => setIncludeInvalid(!includeInvalid)}
        aria-pressed={includeInvalid}
        title={
          includeInvalid
            ? 'Including invalid / out / pit / traffic laps in charts and stats'
            : 'Invalid / out / pit / traffic laps are hidden from charts and stats — click to include them'
        }
      >
        {includeInvalid ? 'INVALID ON' : 'INVALID OFF'}
      </button>

      <span className={styles.toolbarLabel}>PALETTE</span>
      <div className={styles.filterGroup} role="group" aria-label="Chart palette">
        <button
          className={palette === 'default' ? styles.filterBtnActive : styles.filterBtn}
          onClick={() => setPalette('default')}
          aria-pressed={palette === 'default'}
        >
          COLOUR
        </button>
        <button
          className={palette === 'cvd' ? styles.filterBtnActive : styles.filterBtn}
          onClick={() => setPalette('cvd')}
          aria-pressed={palette === 'cvd'}
          title="Deuteranopia-friendly palette"
        >
          CVD
        </button>
      </div>

      {refRunId && refLapNum != null && (
        <>
          <span style={{
            fontFamily: 'var(--font-d)',
            fontSize: '0.52rem',
            color: 'var(--blue)',
            letterSpacing: '0.1em',
          }}>
            Δ REF {refRun?.label || refRun?.compound || 'run'} L{refLapNum}
          </span>
          <button
            className={styles.btnXs}
            onClick={() => setReferenceLap(null, null)}
            title="Clear reference lap (exit delta mode)"
          >
            CLEAR REF
          </button>
        </>
      )}
      {cmpRunId && cmpLapNum != null && (
        <>
          <span style={{
            fontFamily: 'var(--font-d)',
            fontSize: '0.52rem',
            color: 'var(--orange)',
            letterSpacing: '0.1em',
          }}>
            CMP {cmpRun?.label || cmpRun?.compound || 'run'} L{cmpLapNum}
          </span>
          <button
            className={styles.btnXs}
            onClick={() => setComparisonLap(null, null)}
            title="Clear comparison lap"
          >
            CLEAR CMP
          </button>
        </>
      )}
    </div>
  );
}
