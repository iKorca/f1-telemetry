import React from 'react';
import { useTimingStore } from '@/store/timingStore';
import styles from './SecondaryDashboard.module.css';

/**
 * Front-wing damage tile. Two side-by-side progress bars (left / right)
 * showing % damage, plus a large combined headline. Red bar fills up as
 * damage accrues. Rear wing is included as a third row for completeness.
 */
export default function FrontWingTile() {
  const damage = useTimingStore((s) => s.allCarDamage?.playerData);

  const fl = damage?.frontLeftWingDamage ?? 0;
  const fr = damage?.frontRightWingDamage ?? 0;
  const rw = damage?.rearWingDamage ?? 0;
  const worst = Math.max(fl, fr, rw);

  const barColor = (pct: number) => {
    if (pct >= 80) return 'var(--red)';
    if (pct >= 40) return 'var(--orange)';
    if (pct >= 10) return 'var(--yellow)';
    return 'var(--green)';
  };

  return (
    <>
      <div className={styles.tileHeader}>
        WING DAMAGE
        <span className={styles.tileSub}>WORST {Math.round(worst)}%</span>
      </div>
      <div className={styles.tileBody} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.6rem' }}>
        <DamageRow label="FRONT L" pct={fl} color={barColor(fl)} />
        <DamageRow label="FRONT R" pct={fr} color={barColor(fr)} />
        <DamageRow label="REAR"    pct={rw} color={barColor(rw)} />
      </div>
    </>
  );
}

function DamageRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  const val = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        fontFamily: 'var(--font-d)',
        fontSize: '0.62rem',
        letterSpacing: '0.12em',
        color: 'var(--grey-light)',
        marginBottom: '0.25rem',
      }}>
        <span>{label}</span>
        <span style={{
          // ~2× the previous size and scales with viewport for the glance
          // screen (driver reads this at a distance).
          color: val > 0 ? color : 'var(--white)',
          fontSize: 'clamp(1.4rem, 3.2vw, 2rem)',
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>
          {Math.round(val)}<span style={{ fontSize: '0.45em', opacity: 0.75 }}>%</span>
        </span>
      </div>
      <div style={{
        height: 10,
        background: 'rgba(255, 255, 255, 0.06)',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${val}%`,
          height: '100%',
          background: color,
          transition: 'width 0.25s, background 0.25s',
        }} />
      </div>
    </div>
  );
}
