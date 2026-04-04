import React, { useState, useCallback } from 'react';
import styles from './ColumnPicker.module.css';

// Columns that can be toggled (indices 2-10; POS and DRIVER always visible)
const TOGGLEABLE_COLUMNS = [
  { index: 2, label: 'Last Lap' },
  { index: 3, label: 'Best Lap' },
  { index: 4, label: 'Gap Leader' },
  { index: 5, label: 'Gap Ahead' },
  { index: 6, label: 'Tyre' },
  { index: 7, label: 'Age' },
  { index: 8, label: 'Stint History' },
  { index: 9, label: 'Pits' },
  { index: 10, label: 'Status' },
];

interface ColumnPickerProps {
  visibleColumns: boolean[];
  onToggle: (index: number) => void;
}

function ColumnPicker({ visibleColumns, onToggle }: ColumnPickerProps) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <>
      <div className={styles.toolbar}>
        <span className={styles.label}>Race Engineer</span>
        <button className={styles.btn} onClick={toggle} title="Toggle columns">
          Columns
        </button>
      </div>
      {open && (
        <div className={styles.picker}>
          {TOGGLEABLE_COLUMNS.map((col) => (
            <label key={col.index} className={styles.pickerLabel}>
              <input
                type="checkbox"
                checked={visibleColumns[col.index]}
                onChange={() => onToggle(col.index)}
              />
              {col.label}
            </label>
          ))}
        </div>
      )}
    </>
  );
}

export default React.memo(ColumnPicker);
