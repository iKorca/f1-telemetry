import React from 'react';
import styles from './RecordingCard.module.css';

interface Props {
  autoRecord: boolean;
  captureFrames: boolean;
  frameInterval: number;
  maxSessions: number;
  onAutoRecord: (v: boolean) => void;
  onCaptureFrames: (v: boolean) => void;
  onFrameInterval: (v: number) => void;
  onMaxSessions: (v: number) => void;
}

function RecordingCard({
  autoRecord,
  captureFrames,
  frameInterval,
  maxSessions,
  onAutoRecord,
  onCaptureFrames,
  onFrameInterval,
  onMaxSessions,
}: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Recording</div>

      <div className={styles.row}>
        <label className={styles.label}>Auto-record sessions</label>
        <div className={styles.control}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={autoRecord}
              onChange={(e) => onAutoRecord(e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>Capture frame data</label>
        <div className={styles.control}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={captureFrames}
              onChange={(e) => onCaptureFrames(e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>Frame interval</label>
        <div className={styles.control}>
          <select
            className={styles.select}
            value={frameInterval}
            onChange={(e) => onFrameInterval(parseInt(e.target.value, 10))}
          >
            <option value="1">1 &mdash; 60 fps</option>
            <option value="2">2 &mdash; 30 fps</option>
            <option value="3">3 &mdash; 20 fps</option>
            <option value="5">5 &mdash; 12 fps</option>
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>Max sessions to keep</label>
        <div className={styles.control}>
          <input
            type="number"
            className={styles.input}
            value={maxSessions}
            min={1}
            max={500}
            onChange={(e) => onMaxSessions(parseInt(e.target.value, 10) || 50)}
          />
        </div>
      </div>
    </div>
  );
}

export default RecordingCard;
