import React, { useMemo } from 'react';
import { useTimingStore } from '@/store/timingStore';
import styles from './WingDamage.module.css';

function wingDamageColor(dmg: number): string {
  const r = Math.round((dmg / 100) * 232);
  const g = Math.round(((100 - dmg) / 100) * 211);
  return `rgb(${r},${g},0)`;
}

const WINGS = [
  { label: 'FL', key: 'frontLeftWingDamage' },
  { label: 'FR', key: 'frontRightWingDamage' },
  { label: 'REAR', key: 'rearWingDamage' },
] as const;

function WingDamage() {
  const allCarDamage = useTimingStore((s) => s.allCarDamage);

  const damages = useMemo(() => {
    const dmg = allCarDamage?.playerData;
    return {
      frontLeftWingDamage: dmg?.frontLeftWingDamage ?? 0,
      frontRightWingDamage: dmg?.frontRightWingDamage ?? 0,
      rearWingDamage: dmg?.rearWingDamage ?? 0,
    };
  }, [allCarDamage]);

  return (
    <>
      <span className="section-label">WING DAMAGE</span>
      <div className={styles.row}>
        {WINGS.map(({ label, key }) => (
          <div key={label} className={styles.item}>
            <span className={styles.label}>{label}</span>
            <div
              className={styles.box}
              style={{ background: wingDamageColor(damages[key]) }}
            />
          </div>
        ))}
      </div>
    </>
  );
}

export default React.memo(WingDamage);
