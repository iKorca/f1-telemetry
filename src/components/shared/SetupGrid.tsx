import React, { useState, useMemo } from 'react';
import type { CarSetup } from '@shared/types';
import styles from './SetupGrid.module.css';

const FIELDS: [string, keyof CarSetup, string, number][] = [
  ['Front Wing', 'frontWing', '', 0],
  ['Rear Wing', 'rearWing', '', 0],
  ['Diff On', 'onThrottle', '%', 0],
  ['Diff Off', 'offThrottle', '%', 0],
  ['Front Camber', 'frontCamber', '\u00B0', 2],
  ['Rear Camber', 'rearCamber', '\u00B0', 2],
  ['Front Toe', 'frontToe', '\u00B0', 4],
  ['Rear Toe', 'rearToe', '\u00B0', 4],
  ['Front Susp', 'frontSuspension', '', 0],
  ['Rear Susp', 'rearSuspension', '', 0],
  ['Front ARB', 'frontAntiRollBar', '', 0],
  ['Rear ARB', 'rearAntiRollBar', '', 0],
  ['Front Height', 'frontSuspensionHeight', '', 0],
  ['Rear Height', 'rearSuspensionHeight', '', 0],
  ['Brake Pres', 'brakePressure', '%', 0],
  ['Brake Bias', 'brakeBias', '%', 0],
  ['Tyre FL', 'frontLeftTyrePressure', ' psi', 1],
  ['Tyre FR', 'frontRightTyrePressure', ' psi', 1],
  ['Tyre RL', 'rearLeftTyrePressure', ' psi', 1],
  ['Tyre RR', 'rearRightTyrePressure', ' psi', 1],
];

function fmtVal(v: unknown, suffix: string, dec: number): string {
  if (v == null) return '\u2014';
  return (dec > 0 ? Number(v).toFixed(dec) : String(v)) + suffix;
}

function buildRows(s: CarSetup): [string, string][] {
  const rows: [string, string][] = FIELDS.map(([label, key, suffix, dec]) => [
    label,
    fmtVal(s[key], suffix, dec),
  ]);
  if (s.fuelLoad != null) {
    rows.push(['Fuel Load', s.fuelLoad.toFixed(1) + ' kg']);
  }
  return rows;
}

interface SetupGridProps {
  setup: CarSetup | null;
  collapsed?: boolean;
  onToggle?: () => void;
  label?: string;
  columns?: 2 | 3;
  lapSetups?: Record<number, CarSetup>;
  className?: string;
}

function SetupGrid({
  setup,
  collapsed: collapsedProp,
  onToggle,
  label = 'CAR SETUP',
  columns = 2,
  lapSetups,
  className,
}: SetupGridProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(true);
  const isControlled = collapsedProp !== undefined;
  const collapsed = isControlled ? collapsedProp : internalCollapsed;

  const handleToggle = () => {
    if (onToggle) onToggle();
    if (!isControlled) setInternalCollapsed((c) => !c);
  };

  const hasMultiSetups = useMemo(
    () => lapSetups && Object.keys(lapSetups).length > 1,
    [lapSetups],
  );

  const singleRows = useMemo(() => {
    if (!setup) return null;
    return buildRows(setup);
  }, [setup]);

  const diffData = useMemo(() => {
    if (!hasMultiSetups || !lapSetups) return null;
    const keys = Object.keys(lapSetups).sort((a, b) => +a - +b);
    return keys.map((k) => ({ lap: +k, setup: lapSetups[+k] }));
  }, [hasMultiSetups, lapSetups]);

  if (!setup && !hasMultiSetups) return null;

  const gridClass = [
    styles.grid,
    columns === 3 ? styles.cols3 : styles.cols2,
    collapsed ? styles.collapsed : '',
  ]
    .filter(Boolean)
    .join(' ');

  const sectionClass = [styles.section, className].filter(Boolean).join(' ');

  return (
    <div className={sectionClass}>
      <span className={`section-label ${styles.toggle}`} onClick={handleToggle}>
        {label} {collapsed ? '\u25BE' : '\u25B4'}
      </span>

      {!collapsed && hasMultiSetups && diffData ? (
        <div className={styles.diffTable}>
          <table>
            <thead>
              <tr>
                <th>Setting</th>
                {diffData.map((s) => (
                  <th key={s.lap}>Lap {s.lap}+</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(([lbl, key, suffix, dec]) => {
                const vals = diffData.map((s) => s.setup[key]);
                const hasChange = vals.some(
                  (v, i) => i > 0 && v !== vals[0],
                );
                return (
                  <tr key={key} className={hasChange ? styles.changed : ''}>
                    <td>{lbl}</td>
                    {vals.map((v, i) => {
                      let cls = '';
                      if (i > 0 && v !== vals[i - 1]) {
                        cls =
                          Number(v) > Number(vals[i - 1])
                            ? styles.valUp
                            : styles.valDown;
                      }
                      return (
                        <td key={i} className={cls}>
                          {fmtVal(v, suffix, dec)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        singleRows && (
          <div className={gridClass}>
            {singleRows.map(([lbl, val]) => (
              <div className={styles.row} key={lbl}>
                <span className={styles.lbl}>{lbl}</span>
                <span className={styles.val}>{val}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default React.memo(SetupGrid);
