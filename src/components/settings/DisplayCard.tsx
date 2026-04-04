import React from 'react';
import styles from './DisplayCard.module.css';

interface Props {
  showTrackMap: boolean;
  notifications: boolean;
  onShowTrackMap: (v: boolean) => void;
  onNotifications: (v: boolean) => void;
}

function DisplayCard({ showTrackMap, notifications, onShowTrackMap, onNotifications }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Display</div>

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
