import React, { useState, useMemo } from 'react';
import { useTimingStore } from '@/store/timingStore';
import type { CarSetup as CarSetupType } from '@shared/types';
import styles from './CarSetup.module.css';

/**
 * Build setup rows from a CarSetup object.
 * Matches the original renderHistorySetup layout (21 params in 2-col grid).
 */
function buildRows(s: CarSetupType): [string, string][] {
  return [
    ['Front Wing', String(s.frontWing)],
    ['Rear Wing', String(s.rearWing)],
    ['Diff On', s.onThrottle + '%'],
    ['Diff Off', s.offThrottle + '%'],
    ['Front Camber', s.frontCamber?.toFixed(2) + '\u00B0'],
    ['Rear Camber', s.rearCamber?.toFixed(2) + '\u00B0'],
    ['Front Toe', s.frontToe?.toFixed(4) + '\u00B0'],
    ['Rear Toe', s.rearToe?.toFixed(4) + '\u00B0'],
    ['Front Susp', String(s.frontSuspension)],
    ['Rear Susp', String(s.rearSuspension)],
    ['Front ARB', String(s.frontAntiRollBar)],
    ['Rear ARB', String(s.rearAntiRollBar)],
    ['Front Height', String(s.frontSuspensionHeight)],
    ['Rear Height', String(s.rearSuspensionHeight)],
    ['Brake Pres', s.brakePressure + '%'],
    ['Brake Bias', s.brakeBias + '%'],
    ['Tyre FL', s.frontLeftTyrePressure?.toFixed(1) + ' psi'],
    ['Tyre FR', s.frontRightTyrePressure?.toFixed(1) + ' psi'],
    ['Tyre RL', s.rearLeftTyrePressure?.toFixed(1) + ' psi'],
    ['Tyre RR', s.rearRightTyrePressure?.toFixed(1) + ' psi'],
    ['Fuel Load', s.fuelLoad?.toFixed(1) + ' kg'],
  ];
}

function CarSetup() {
  const [collapsed, setCollapsed] = useState(true);
  const carSetupData = useTimingStore((s) => s.carSetupData);

  const rows = useMemo(() => {
    if (!carSetupData) return null;
    return buildRows(carSetupData);
  }, [carSetupData]);

  if (!rows) return null;

  const gridClass = [styles.grid, collapsed ? styles.collapsed : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.section}>
      <span
        className={`section-label ${styles.toggle}`}
        onClick={() => setCollapsed((c) => !c)}
      >
        CAR SETUP {collapsed ? '\u25BE' : '\u25B4'}
      </span>
      <div className={gridClass}>
        {rows.map(([lbl, val]) => (
          <div className={styles.row} key={lbl}>
            <span className={styles.lbl}>{lbl}</span>
            <span className={styles.val}>{val ?? '\u2014'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default React.memo(CarSetup);
