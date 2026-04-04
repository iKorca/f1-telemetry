import React, { useEffect, useCallback } from 'react';
import { useUIStore } from '@/store/uiStore';
import styles from './ShortcutsOverlay.module.css';

const shortcuts = [
  { key: '1', label: 'Dashboard' },
  { key: '2', label: 'Timing' },
  { key: '3', label: 'Race' },
  { key: '4', label: 'History' },
  { key: '5', label: 'Settings' },
  { key: 'R', label: 'Toggle Recording' },
  { key: 'F', label: 'Fullscreen' },
  { key: '?', label: 'Close' },
];

function ShortcutsOverlay() {
  const show = useUIStore((s) => s.showShortcutsOverlay);
  const toggle = useUIStore((s) => s.toggleShortcutsOverlay);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && show) {
        toggle();
      }
    },
    [show, toggle],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!show) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      toggle();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.content}>
        <h3 className={styles.title}>KEYBOARD SHORTCUTS</h3>
        <div className={styles.grid}>
          {shortcuts.map((s) => (
            <div key={s.key} className={styles.item}>
              <kbd className={styles.kbd}>{s.key}</kbd> {s.label}
            </div>
          ))}
        </div>
        <button className={styles.btnSecondary} onClick={toggle}>
          Close
        </button>
      </div>
    </div>
  );
}

export default ShortcutsOverlay;
