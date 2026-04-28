import React, { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTimingStore } from '@/store/timingStore';
import { fmtTime } from '@/lib/formatters';
import { wearColor, getCompoundColor } from '@/lib/colors';
import { ERS_FULL_ENERGY } from '@/lib/constants';
import type {
  LapData,
  LapDataPacket,
  CarStatusData,
  CarDamageData,
  ParticipantsData,
} from '@shared/types';
import styles from './SecondaryDashboard.module.css';

/**
 * Snapshot of one rival driver — the data the proximity panel reads.
 * `gapMs` is positive when the rival is N ms ahead, negative when behind.
 */
interface RivalSnapshot {
  name: string;
  teamId: number;
  position: number;
  ersPct: number;            // 0–100
  ersMode: string;           // "Medium" / "Hotlap" / "Overtake"
  gapMs: number;             // positive = ahead of player, negative = behind
  lastLapMs: number;
  maxTyreWear: number;       // worst of FL/FR/RL/RR
  maxWingDamage: number;     // worst of FL wing / FR wing
  tyreCompoundName: string;  // SOFT / MEDIUM / HARD / INTER / WET
}

/**
 * Single-letter tyre code (S/M/H/I/W) for the compact rival display.
 * Returns "—" for unknown so the cell doesn't render a stray empty span.
 */
function tyreLetter(name: string): string {
  const u = (name || '').toUpperCase();
  if (u === 'SOFT' || u.startsWith('S ')) return 'S';
  if (u === 'MEDIUM' || u === 'M') return 'M';
  if (u === 'HARD' || u === 'H') return 'H';
  if (u === 'INTER' || u === 'INTERMEDIATE' || u === 'I') return 'I';
  if (u === 'WET' || u === 'W') return 'W';
  return '—';
}

/**
 * Twin proximity tile occupying the third column of the glance dashboard.
 * Top half = the driver one position AHEAD of the player.
 * Bottom half = the driver one position BEHIND.
 *
 * Picks rivals by `carPosition`. Falls back to placeholder copy when
 * the player is leader / last / no race data — never crashes the column
 * on early-session frames.
 *
 * Data per rival (per the user's request): ERS charge + deploy mode,
 * time gap, last-lap time, max tyre wear, and front-wing damage.
 */
export default function RivalsTile() {
  const {
    playerCarIndex,
    playerPosition,
    allLapData,
    allCarStatus,
    allCarDamage,
    allParticipants,
  } = useTimingStore(
    useShallow((s) => ({
      playerCarIndex: s.playerCarIndex,
      playerPosition: s.position,
      allLapData: s.allLapData,
      allCarStatus: s.allCarStatus,
      allCarDamage: s.allCarDamage,
      allParticipants: s.allParticipants,
    })),
  );

  const { ahead, behind } = useMemo(() => {
    return pickRivals({
      playerCarIndex,
      playerPosition,
      allLapData,
      allCarStatus,
      allCarDamage,
      allParticipants,
    });
  }, [playerCarIndex, playerPosition, allLapData, allCarStatus, allCarDamage, allParticipants]);

  return (
    <>
      <div className={styles.tileHeader}>
        RIVALS
        <span className={styles.tileSub}>
          {playerPosition > 0 ? `P${playerPosition}` : '—'}
        </span>
      </div>
      <div className={styles.rivalsBody}>
        <RivalRow rival={ahead} role="AHEAD" />
        <RivalRow rival={behind} role="BEHIND" />
      </div>
    </>
  );
}

function RivalRow({ rival, role }: { rival: RivalSnapshot | null; role: 'AHEAD' | 'BEHIND' }) {
  if (!rival) {
    return (
      <div className={styles.rivalRow}>
        <div className={styles.rivalRoleLabel}>{role}</div>
        <div className={styles.rivalEmpty}>
          {role === 'AHEAD' ? 'You are leading' : 'No car behind'}
        </div>
      </div>
    );
  }

  const gapText = formatGap(rival.gapMs);
  const wingTone = rival.maxWingDamage >= 50 ? styles.rivalDanger
    : rival.maxWingDamage >= 20 ? styles.rivalWarn
    : null;

  const tyreT = tyreLetter(rival.tyreCompoundName);
  const tyreCol = getCompoundColor(rival.tyreCompoundName);

  return (
    <div className={styles.rivalRow}>
      <div className={styles.rivalRoleLabel}>{role}</div>

      <div className={styles.rivalHeader}>
        <span className={styles.rivalPos}>P{rival.position}</span>
        <span className={styles.rivalName}>{rival.name}</span>
        <span className={styles.rivalGap}>{gapText}</span>
      </div>

      {/* LAST gets its own line — lap-time is the widest value. */}
      <RivalStat
        label="LAST"
        value={rival.lastLapMs > 0 ? fmtTime(rival.lastLapMs) : '—'}
      />

      {/* ERS dominates: full-width block with bigger value, much bigger
          deploy mode caption, and a full-width gradient bar. */}
      <div className={styles.rivalErsBlock}>
        <div className={styles.rivalStatLabel}>ERS</div>
        <div className={styles.rivalErsRow}>
          <span className={styles.rivalErsValue}>{Math.round(rival.ersPct)}%</span>
          <span className={styles.rivalErsMode}>{rival.ersMode || '—'}</span>
        </div>
        <ErsBar pct={rival.ersPct} />
      </div>

      {/* TYRE (with compound letter) shares a row with F-WING when wing
          damage is present; otherwise TYRE sits on its own. */}
      <div className={styles.rivalGrid}>
        <div className={styles.rivalStat}>
          <div className={styles.rivalStatLabel}>TYRE</div>
          <div className={styles.rivalStatValue}>
            <span className={styles.rivalTyreLetter} style={{ color: tyreCol }}>
              {tyreT}
            </span>
            <span style={{ color: wearColor(rival.maxTyreWear) }}>
              {Math.round(rival.maxTyreWear)}%
            </span>
          </div>
        </div>
        {rival.maxWingDamage > 0 && (
          <RivalStat
            label="F-WING"
            value={`${Math.round(rival.maxWingDamage)}%`}
            className={wingTone ?? undefined}
          />
        )}
      </div>
    </div>
  );
}

function RivalStat(props: {
  label: string;
  value: string;
  subtext?: string;
  valueColor?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`${styles.rivalStat} ${props.className ?? ''}`}>
      <div className={styles.rivalStatLabel}>{props.label}</div>
      <div className={styles.rivalStatValue} style={props.valueColor ? { color: props.valueColor } : undefined}>
        {props.value}
      </div>
      {props.subtext && <div className={styles.rivalStatSub}>{props.subtext}</div>}
      {props.children}
    </div>
  );
}

function ErsBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className={styles.rivalErsBar}>
      <div className={styles.rivalErsFill} style={{ width: `${clamped}%` }} />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
//  Pure helpers — no React, no store. Keeps the rival-picking logic testable.
// ────────────────────────────────────────────────────────────────────────────

interface PickInput {
  playerCarIndex: number;
  playerPosition: number;
  allLapData: LapDataPacket | null;
  allCarStatus: CarStatusData | null;
  allCarDamage: CarDamageData | null;
  allParticipants: ParticipantsData | null;
}

export function pickRivals(input: PickInput): { ahead: RivalSnapshot | null; behind: RivalSnapshot | null } {
  const { playerCarIndex, playerPosition, allLapData, allCarStatus, allCarDamage, allParticipants } = input;
  if (!allLapData?.allCars || !allParticipants?.participants || playerPosition <= 0) {
    return { ahead: null, behind: null };
  }
  const cars = allLapData.allCars;
  const aheadIdx = findCarIdxAtPosition(cars, playerPosition - 1);
  const behindIdx = findCarIdxAtPosition(cars, playerPosition + 1);

  const playerLap: LapData | null =
    playerCarIndex >= 0 && cars[playerCarIndex] ? cars[playerCarIndex] : null;

  return {
    ahead: aheadIdx >= 0
      ? buildSnapshot(aheadIdx, 'ahead', playerLap, cars, allCarStatus, allCarDamage, allParticipants)
      : null,
    behind: behindIdx >= 0
      ? buildSnapshot(behindIdx, 'behind', playerLap, cars, allCarStatus, allCarDamage, allParticipants)
      : null,
  };
}

function findCarIdxAtPosition(cars: LapData[], position: number): number {
  if (position <= 0) return -1;
  for (let i = 0; i < cars.length; i++) {
    if (cars[i] && cars[i].carPosition === position) return i;
  }
  return -1;
}

function buildSnapshot(
  rivalIdx: number,
  side: 'ahead' | 'behind',
  playerLap: LapData | null,
  cars: LapData[],
  status: CarStatusData | null,
  damage: CarDamageData | null,
  participants: ParticipantsData | null,
): RivalSnapshot {
  const lap = cars[rivalIdx];
  const carStatus = status?.allCars?.[rivalIdx];
  const carDamage = damage?.allCars?.[rivalIdx];
  const part = participants?.participants?.[rivalIdx];

  // The F1 25 packet exposes only "delta to car ahead". For the rival in
  // front of the player, that's the player's own delta. For the rival
  // BEHIND, the published value sits on THEIR row (their delta to me).
  const gapMs = side === 'ahead'
    ? (playerLap?.deltaToCarInFrontInMS ?? 0)
    : -(lap?.deltaToCarInFrontInMS ?? 0);

  const tyres = carDamage?.tyresWear ?? [0, 0, 0, 0];
  const maxTyreWear = Math.max(0, ...tyres);
  const maxWingDamage = Math.max(
    carDamage?.frontLeftWingDamage ?? 0,
    carDamage?.frontRightWingDamage ?? 0,
  );

  const ersPct = carStatus
    ? Math.max(0, Math.min(100, (carStatus.ersStoreEnergy / ERS_FULL_ENERGY) * 100))
    : 0;

  return {
    name: part?.name ?? `#${rivalIdx}`,
    teamId: part?.teamId ?? -1,
    position: lap?.carPosition ?? 0,
    ersPct,
    ersMode: carStatus?.ersDeployModeName ?? '',
    gapMs,
    lastLapMs: lap?.lastLapTimeInMS ?? 0,
    maxTyreWear,
    maxWingDamage,
    tyreCompoundName: carStatus?.tyreCompoundName ?? '',
  };
}

/**
 * Format a millisecond gap as a signed seconds string with a leading
 * sign character (`+0.842` or `-1.205`). Sign is from the player's POV:
 * positive = rival is in front, negative = rival is behind.
 */
function formatGap(ms: number): string {
  if (!ms || !Number.isFinite(ms)) return '—';
  const sign = ms > 0 ? '+' : '−';
  return `${sign}${(Math.abs(ms) / 1000).toFixed(3)}s`;
}
