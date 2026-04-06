import React from 'react';
import { FONT_PRESETS } from '@/store/settingsStore';
import styles from './DisplayCard.module.css';

interface Props {
  showTrackMap: boolean;
  notifications: boolean;
  fontPreset: string;
  uiScale: number;
  onShowTrackMap: (v: boolean) => void;
  onNotifications: (v: boolean) => void;
  onFontPreset: (v: string) => void;
  onUIScale: (v: number) => void;
}

const SCALE_OPTIONS = [80, 90, 100, 110, 120, 130];

function DisplayCard({
  showTrackMap, notifications, fontPreset, uiScale,
  onShowTrackMap, onNotifications, onFontPreset, onUIScale,
}: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Display</div>

      <div className={styles.row}>
        <label className={styles.label}>Font theme</label>
        <div className={styles.control}>
          <select
            className={styles.select}
            value={fontPreset}
            onChange={(e) => onFontPreset(e.target.value)}
          >
            {Object.entries(FONT_PRESETS).map(([key, preset]) => (
              <option key={key} value={key}>{preset.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>UI scale</label>
        <div className={styles.control}>
          <input
            type="range"
            className={styles.range}
            min={80}
            max={130}
            step={5}
            value={uiScale}
            onChange={(e) => onUIScale(Number(e.target.value))}
          />
          <span className={styles.scaleValue}>{uiScale}%</span>
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>Show track map</label>
        <div className={styles.control}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={showTrackMap}
              onChange={(e) => onShowTrackMap(e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>Notification sounds</label>
        <div className={styles.control}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={notifications}
              onChange={(e) => onNotifications(e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      </div>
    </div>
  );
}

export default DisplayCard;
