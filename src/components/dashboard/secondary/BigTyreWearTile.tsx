import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTimingStore } from '@/store/timingStore';
import { wearColor } from '@/lib/colors';
import styles from './SecondaryDashboard.module.css';

// F1 tyre array order: [RL=0, RR=1, FL=2, FR=3]
const CORNERS = [
  { label: 'FL', idx: 2 },
  { label: 'FR', idx: 3 },
  { label: 'RL', idx: 0 },
  { label: 'RR', idx: 1 },
] as const;

/**
 * Large 2×2 tyre-wear tile. Each corner shows big % digits, a vertical fill
 * bar that rises with wear, and matches the wearColor palette used elsewhere.
 *
 * Layout: label LEFT, huge number RIGHT — chosen for peripheral-vision
 * legibility while the user is sim-racing.
 */
export default function BigTyreWearTile() {
  const tyresWear = useTimingStore(
    useShallow((s) => s.allCarDamage?.playerData?.tyresWear ?? [0, 0, 0, 0]),
  );
  const compound = useTimingStore(
    (s) => s.allCarStatus?.playerData?.tyreCompoundName ?? '—',
  );
  const tyreAge = useTimingStore(
    (s) => s.allCarStatus?.playerData?.tyresAgeLaps ?? 0,
  );
  const worst = Math.max(...tyresWear);

  return (
    <>
      <div className={styles.tileHeader}>
        TYRE WEAR
        <span className={styles.tileSub}>
          {compound} · {tyreAge} LAPS · WORST {worst.toFixed(1)}%
        </span>
      </div>
      <div className={styles.tyreGrid}>
        {CORNERS.map(({ label, idx }) => (
          <Corner key={label} label={label} pct={tyresWear[idx] ?? 0} />
        ))}
      </div>
    </>
  );
}

function Corner({ label, pct }: { label: string; pct: number }) {
  const val = Math.max(0, Math.min(100, pct));
  const color = wearColor(val);
  // One CSS custom property feeds three places (border, fill bar, number)
  // so the wear gradient stays in lock-step everywhere.
  const cornerStyle = { '--tyre-color': color } as React.CSSProperties;
  return (
    <div className={styles.tyreCorner} style={cornerStyle}>
      <div className={styles.tyreFill} style={{ height: `${val}%` }} />
      <div className={styles.tyreLabel}>{label}</div>
      <div className={styles.tyreNumber}>
        {val.toFixed(0)}<span className={styles.tyreNumberPct}>%</span>
      </div>
    </div>
  );
}
