import React from 'react';
import type { PracticeRun } from '@shared/types';
import type { CarSetup } from '@shared/types/telemetry';
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

export default function SetupDelta({ runs }: SetupDeltaProps) {
  // Only show if at least 2 runs have setups
  const runsWithSetup = runs.filter((r) => r.setup != null);
  if (runsWithSetup.length < 2) return null;

  const flattened = runsWithSetup.map((r) => ({
    run: r,
    fields: flattenSetup(r.setup),
  }));

  // Collect all field names across all setups
  const allFields = new Set<string>();
  for (const f of flattened) {
    for (const key of Object.keys(f.fields)) {
      allFields.add(key);
    }
  }

  // Find fields that differ between at least two runs
  const changedFields: string[] = [];
  const unchangedFields: string[] = [];

  for (const field of allFields) {
    const values = flattened.map((f) => f.fields[field]);
    const unique = new Set(values.map((v) => String(v ?? '')));
    if (unique.size > 1) {
      changedFields.push(field);
    } else {
      unchangedFields.push(field);
    }
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
          {changedFields.length} difference{changedFields.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Changed fields as comparison grid */}
      <div
        className={styles.comparisonGrid}
        style={{ gridTemplateColumns: `160px repeat(${runsWithSetup.length}, minmax(100px, 1fr))` }}
      >
        {/* Header */}
        <div className={styles.comparisonLabel}>Setting</div>
        {runsWithSetup.map((r) => (
          <div key={r.id} className={styles.comparisonLabel} style={{ textAlign: 'center' }}>
            {r.label || r.compound}
          </div>
        ))}

        {/* Changed rows */}
        {changedFields.map((field) => (
          <React.Fragment key={field}>
            <div className={styles.comparisonLabel}>{field}</div>
            {flattened.map((f) => {
              const val = f.fields[field];
              return (
                <div
                  key={f.run.id}
                  className={`${styles.comparisonValue} ${styles.setupChanged}`}
                >
                  {val != null ? formatValue(val) : '\u2014'}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
