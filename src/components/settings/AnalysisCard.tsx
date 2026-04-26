import React from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import styles from './RecordingCard.module.css';

/**
 * Analysis tunables card — exposes knobs that were previously hardcoded:
 * - fuel safety margin %
 * - default starting fuel kg
 *
 * The 2.5 × MAD threshold for traffic-lap detection lives on the backend and
 * would need a WS-broadcast round-trip to tune live; skipped here to keep
 * the surface area small.
 */
export default function AnalysisCard() {
  const marginPct = useSettingsStore((s) => s.fuelSafetyMarginPct);
  const setMargin = useSettingsStore((s) => s.setFuelSafetyMargin);
  const startKg = useSettingsStore((s) => s.defaultStartingFuelKg);
  const setStartKg = useSettingsStore((s) => s.setDefaultStartingFuel);
  const tempUnit = useSettingsStore((s) => s.tempUnit);
  const setTempUnit = useSettingsStore((s) => s.setTempUnit);

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Analysis</div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="fuel-margin">Fuel safety margin</label>
        <div className={styles.control} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            id="fuel-margin"
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={marginPct}
            onChange={(e) => setMargin(parseFloat(e.target.value))}
            aria-valuemin={0}
            aria-valuemax={10}
            aria-valuenow={marginPct}
          />
          <span style={{ minWidth: '2.5rem', textAlign: 'right' }}>{marginPct.toFixed(1)}%</span>
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor="start-fuel">Default starting fuel</label>
        <div className={styles.control}>
          <input
            id="start-fuel"
            type="number"
            className={styles.input}
            value={startKg}
            min={50}
            max={110}
            step={0.5}
            onChange={(e) => setStartKg(parseFloat(e.target.value) || 110)}
          />
          <span style={{ marginLeft: '0.3rem', color: 'var(--grey)' }}>kg</span>
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>Temperature unit</label>
        <div className={styles.control}>
          <select
            className={styles.select}
            value={tempUnit}
            onChange={(e) => setTempUnit(e.target.value as 'C' | 'F')}
          >
            <option value="C">°C (Celsius)</option>
            <option value="F">°F (Fahrenheit)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
