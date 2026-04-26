import React from 'react';
import type { PracticeRun } from '@shared/types';
import type { CarSetup } from '@shared/types/telemetry';
import { usePracticeStore } from '@/store/practiceStore';
import styles from './PracticeTab.module.css';

interface SetupDeltaProps {
  runs: PracticeRun[];
}

// Flatten a CarSetup into label/value pairs for comparison
function flattenSetup(setup: CarSetup | null): Record<string, number | string> {
  if (!setup) return {};
  const flat: Record<string, number | string> = {};

  // Front wing
  if (setup.frontWing != null) flat['Front Wing'] = setup.frontWing;
  if (setup.rearWing != null) flat['Rear Wing'] = setup.rearWing;

  // Differential
  if (setup.onThrottle != null) flat['Diff On-Throttle'] = setup.onThrottle;
  if (setup.offThrottle != null) flat['Diff Off-Throttle'] = setup.offThrottle;

  // Camber
  if (setup.frontCamber != null) flat['Front Camber'] = setup.frontCamber;
  if (setup.rearCamber != null) flat['Rear Camber'] = setup.rearCamber;

  // Toe
  if (setup.frontToe != null) flat['Front Toe'] = setup.frontToe;
  if (setup.rearToe != null) flat['Rear Toe'] = setup.rearToe;

  // Suspension
  if (setup.frontSuspension != null) flat['Front Suspension'] = setup.frontSuspension;
  if (setup.rearSuspension != null) flat['Rear Suspension'] = setup.rearSuspension;
  if (setup.frontAntiRollBar != null) flat['Front Anti-Roll'] = setup.frontAntiRollBar;
  if (setup.rearAntiRollBar != null) flat['Rear Anti-Roll'] = setup.rearAntiRollBar;
  if (setup.frontSuspensionHeight != null) flat['Front Ride Height'] = setup.frontSuspensionHeight;
  if (setup.rearSuspensionHeight != null) flat['Rear Ride Height'] = setup.rearSuspensionHeight;

  // Brakes
  if (setup.brakePressure != null) flat['Brake Pressure'] = setup.brakePressure;
  if (setup.brakeBias != null) flat['Brake Bias'] = setup.brakeBias;

  // Tyres
  if (setup.frontLeftTyrePressure != null) flat['FL Tyre Pressure'] = setup.frontLeftTyrePressure;
  if (setup.frontRightTyrePressure != null) flat['FR Tyre Pressure'] = setup.frontRightTyrePressure;
  if (setup.rearLeftTyrePressure != null) flat['RL Tyre Pressure'] = setup.rearLeftTyrePressure;
  if (setup.rearRightTyrePressure != null) flat['RR Tyre Pressure'] = setup.rearRightTyrePressure;

  // Ballast / fuel
  if (setup.ballast != null) flat['Ballast'] = setup.ballast;
  if (setup.fuelLoad != null) flat['Fuel Load'] = setup.fuelLoad;

  return flat;
}

function formatValue(v: number | string): string {
  if (typeof v === 'number') {
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }
  return String(v);
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  if (Math.abs(delta) < 0.01) return '0';
  if (Number.isInteger(delta)) return `${sign}${delta}`;
  return `${sign}${delta.toFixed(2)}`;
}

export default function SetupDelta({ runs }: SetupDeltaProps) {
  const baselineRunId = usePracticeStore((s) => s.baselineRunId);

  const runsWithSetup = runs.filter((r) => r.setup != null);
  if (runsWithSetup.length < 1) return null;

  // Baseline: user-pinned run if in selection, else leftmost (first selected).
  const baselineIdx = (() => {
    if (!baselineRunId) return 0;
    const idx = runsWithSetup.findIndex((r) => r.id === baselineRunId);
    return idx >= 0 ? idx : 0;
  })();

  const flattened = runsWithSetup.map((r) => ({
    run: r,
    fields: flattenSetup(r.setup),
  }));

  const baselineFields = flattened[baselineIdx].fields;

  // Collect all field names across all setups (ordered by flattenSetup output)
  const allFields: string[] = [];
  const seen = new Set<string>();
  for (const f of flattened) {
    for (const key of Object.keys(f.fields)) {
      if (!seen.has(key)) {
        seen.add(key);
        allFields.push(key);
      }
    }
  }

  // Partition into changed / unchanged
  const changedFields: string[] = [];
  const unchangedFields: string[] = [];
  for (const field of allFields) {
    const values = flattened.map((f) => f.fields[field]);
    const unique = new Set(values.map((v) => String(v ?? '')));
    if (unique.size > 1) changedFields.push(field);
    else unchangedFields.push(field);
  }

  // Single-run case: show the setup as a plain readout
  if (runsWithSetup.length === 1) {
    return (
      <div>
        <div className={styles.sectionTitle}>STINT SETUP</div>
        <div
          className={styles.comparisonGrid}
          style={{ gridTemplateColumns: '160px minmax(100px, 1fr)' }}
        >
          <div className={styles.comparisonLabel}>Setting</div>
          <div className={styles.comparisonLabel} style={{ textAlign: 'center' }}>
            {runsWithSetup[0].label || runsWithSetup[0].compound}
          </div>
          {allFields.map((field) => (
            <React.Fragment key={field}>
              <div className={styles.comparisonLabel}>{field}</div>
              <div className={styles.comparisonValue}>
                {formatValue(baselineFields[field] ?? '\u2014')}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  if (changedFields.length === 0) {
    return (
      <div>
        <div className={styles.sectionTitle}>SETUP DELTA</div>
        <div style={{ color: 'var(--grey)', fontFamily: 'var(--font-d)', fontSize: '0.62rem' }}>
          All setup values are identical across selected runs.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.sectionTitle}>
        SETUP DELTA
        <span style={{ color: 'var(--grey-light)', fontWeight: 400, marginLeft: '0.5rem' }}>
          {changedFields.length} difference{changedFields.length !== 1 ? 's' : ''} &middot; baseline:&nbsp;
          <span style={{ color: 'var(--green)' }}>
            {runsWithSetup[baselineIdx].label || runsWithSetup[baselineIdx].compound}
          </span>
        </span>
      </div>

      {/* Matrix */}
      <div
        className={styles.comparisonGrid}
        style={{ gridTemplateColumns: `160px repeat(${runsWithSetup.length}, minmax(100px, 1fr))` }}
      >
        {/* Header */}
        <div className={styles.comparisonLabel}>Setting</div>
        {runsWithSetup.map((r, idx) => (
          <div
            key={r.id}
            className={styles.comparisonLabel}
            style={{
              textAlign: 'center',
              color: idx === baselineIdx ? 'var(--green)' : undefined,
            }}
          >
            {r.label || r.compound}
            {idx === baselineIdx && (
              <span style={{ display: 'block', fontSize: '0.42rem', opacity: 0.7 }}>baseline</span>
            )}
          </div>
        ))}

        {/* Changed rows — each cell tinted relative to baseline */}
        {changedFields.map((field) => {
          const basisRaw = baselineFields[field];
          const basisIsNumeric = typeof basisRaw === 'number';
          return (
            <React.Fragment key={field}>
              <div className={styles.comparisonLabel}>{field}</div>
              {flattened.map((f, idx) => {
                const val = f.fields[field];
                const isBaseline = idx === baselineIdx;
                const equal =
                  val != null && basisRaw != null && String(val) === String(basisRaw);
                const delta =
                  basisIsNumeric && typeof val === 'number'
                    ? val - (basisRaw as number)
                    : null;

                // Color: baseline = green, equal-to-baseline = muted,
                // different = yellow (gentle) or orange (large)
                let color: string | undefined;
                if (isBaseline) color = 'var(--green)';
                else if (equal) color = 'var(--grey-light)';
                else color = 'var(--yellow)';

                return (
                  <div
                    key={f.run.id}
                    className={styles.comparisonValue}
                    style={{ color, fontWeight: isBaseline || !equal ? 700 : 400 }}
                    title={
                      delta != null && !isBaseline
                        ? `${formatValue(val)} (${formatDelta(delta)} vs baseline)`
                        : undefined
                    }
                  >
                    {val != null ? formatValue(val) : '\u2014'}
                    {delta != null && delta !== 0 && !isBaseline && (
                      <span style={{ fontSize: '0.5rem', color: 'var(--grey)', marginLeft: '0.3rem' }}>
                        ({formatDelta(delta)})
                      </span>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>

      {/* Collapsed unchanged-fields summary */}
      {unchangedFields.length > 0 && (
        <div style={{
          fontFamily: 'var(--font-d)',
          fontSize: '0.48rem',
          color: 'var(--grey)',
          marginTop: '0.4rem',
          fontStyle: 'italic',
        }}>
          {unchangedFields.length} setting{unchangedFields.length !== 1 ? 's' : ''} match across all selected runs
        </div>
      )}
    </div>
  );
}
