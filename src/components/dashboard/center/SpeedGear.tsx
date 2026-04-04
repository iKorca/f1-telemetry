import React, { useMemo } from 'react';
import { useTelemetryStore } from '@/store/telemetryStore';
import { useTimingStore } from '@/store/timingStore';
import { useSessionInfoStore } from '@/store/sessionInfoStore';
import { useSettingsStore } from '@/store/settingsStore';
import Badge from '@/components/common/Badge';
import type { BadgeVariant } from '@/components/common/Badge';
import styles from './SpeedGear.module.css';

/** Flag labels keyed by vehicleFiaFlags value */
const FLAG_LABELS: Record<number, string> = {
  '-1': '\u2014',
  0: '\u2014',
  1: 'YELLOW',
  2: 'DOUBLE Y',
  3: 'GREEN',
  4: 'SAFETY CAR',
  5: 'RED',
};

function flagVariant(flag: number): BadgeVariant {
  switch (flag) {
    case 1:
    case 2:
      return 'flagYellow';
    case 4:
      return 'flagSc';
    case 5:
      return 'flagRed';
    default:
      return 'default';
  }
}

function SpeedGear() {
  const speed = useTelemetryStore((s) => s.speed);
  const gear = useTelemetryStore((s) => s.gear);
  const drs = useTelemetryStore((s) => s.drs);
  const pitStatus = useTimingStore((s) => s.pitStatus);
  const safetyCarStatus = useSessionInfoStore((s) => s.safetyCarStatus);
  const speedUnit = useSettingsStore((s) => s.speedUnit);

  // Also read DRS state from carStatus
  const allCarStatus = useTimingStore((s) => s.allCarStatus);
  const drsAllowed = allCarStatus?.playerData?.drsAllowed === 1;
  const drsActivationDist = allCarStatus?.playerData?.drsActivationDistance || 0;
  const vehicleFiaFlags = allCarStatus?.playerData?.vehicleFiaFlags ?? 0;

  const displaySpeed = useMemo(() => {
    return speedUnit === 'mph' ? Math.round(speed * 0.621371) : speed;
  }, [speed, speedUnit]);

  const gearStr = gear === 0 ? 'N' : gear === -1 ? 'R' : String(gear);
  const unitLabel = speedUnit === 'mph' ? 'MPH' : 'KM/H';

  // DRS badge logic
  const drsActive = drs === 1;
  const drsVariant: BadgeVariant = drsActive
    ? 'drsActive'
    : drsAllowed
      ? 'drsAvailable'
      : 'default';
  const drsText = drsAllowed && !drsActive && drsActivationDist > 0
    ? `DRS ${drsActivationDist}m`
    : 'DRS';

  // PIT badge
  const isPit = pitStatus === 1 || pitStatus === 2;

  // FLAG badge
  const flagText = FLAG_LABELS[vehicleFiaFlags] ?? '\u2014';
  const flagActive = vehicleFiaFlags > 0 && vehicleFiaFlags !== 3;
  const flagVar = flagVariant(vehicleFiaFlags);

  return (
    <div className={styles.speedGearRow}>
      <div className={styles.speedBlock}>
        <span className={styles.speedVal}>{displaySpeed}</span>
        <span className={styles.unit}>{unitLabel}</span>
      </div>
      <div className={styles.gearBlock}>
        <span className={styles.gearVal}>{gearStr}</span>
        <div className={styles.badges}>
          <Badge
            text={drsText}
            active={drsActive || drsAllowed}
            variant={drsVariant}
          />
          <Badge text="PIT" active={isPit} variant="pit" />
          <Badge text={flagText} active={flagActive} variant={flagVar} />
        </div>
      </div>
    </div>
  );
}

export default React.memo(SpeedGear);
