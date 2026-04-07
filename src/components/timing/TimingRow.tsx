import React from 'react';
import type { LapData, CarStatus, Participant } from '@shared/types';
import { DRIVER_STATUS } from '@/lib/constants';
import { fmtTime, fmtDelta } from '@/lib/formatters';
import { getTeamColor } from '@/lib/colors';
import styles from './TimingRow.module.css';

/** Timing-specific mapping: indices 0-1 show empty (use driverStatus instead). */
const RESULT_STATUS: Record<number, string> = {
  0: '',
  1: '',
  2: 'DNF',
  3: 'DSQ',
  4: 'NC',
  5: 'RET',
};

interface TimingRowProps {
  carIndex: number;
  participant: Participant;
  lapData: LapData;
  carStatus: CarStatus | null;
  isPlayer: boolean;
  isFastest: boolean;
  sessionBestLapMs: number;
  isQualifying: boolean;
  qualiBestMs: number;
  sessionBestMs: number;
  aheadBestMs: number;
}

function TimingRowInner({
  participant,
  lapData,
  carStatus,
  isPlayer,
  isFastest,
  sessionBestLapMs,
  isQualifying,
  qualiBestMs,
  sessionBestMs,
  aheadBestMs,
}: TimingRowProps) {
  const isPit = lapData.pitStatus > 0;
  const isRetired = lapData.resultStatus >= 2;

  const driverStatus = DRIVER_STATUS[lapData.driverStatus] || '';
  const resultStr = RESULT_STATUS[lapData.resultStatus] || '';
  const statusStr = resultStr || driverStatus;

  const compound = carStatus?.tyreCompoundName || '\u2014';
  const compCls = compound.toLowerCase();

  // Gap columns: qualifying uses best-lap based gaps, race uses live deltas
  let gapLeader: string;
  let gapAhead: string;

  if (isQualifying) {
    if (qualiBestMs > 0 && sessionBestMs > 0 && qualiBestMs === sessionBestMs) {
      gapLeader = 'P1';
    } else if (qualiBestMs > 0 && sessionBestMs > 0) {
      gapLeader = '+' + fmtDelta(qualiBestMs - sessionBestMs);
    } else {
      gapLeader = '\u2014';
    }

    if (qualiBestMs > 0 && aheadBestMs > 0 && qualiBestMs === sessionBestMs) {
      gapAhead = '\u2014';
    } else if (qualiBestMs > 0 && aheadBestMs > 0) {
      gapAhead = '+' + fmtDelta(qualiBestMs - aheadBestMs);
    } else {
      gapAhead = '\u2014';
    }
  } else {
    gapLeader =
      lapData.carPosition === 1
        ? 'LEAD'
        : '+' + fmtDelta(lapData.deltaToLeaderInMS);
    gapAhead =
      lapData.carPosition === 1
        ? '\u2014'
        : '+' + fmtDelta(lapData.deltaToCarInFrontInMS);
  }

  const lastLap =
    lapData.lastLapTimeInMS > 0 ? fmtTime(lapData.lastLapTimeInMS) : '\u2014';

  // Best lap: in qualifying show tracked best, otherwise dash
  const bestLapMs = isQualifying ? qualiBestMs : 0;
  const bestLap = bestLapMs > 0 ? fmtTime(bestLapMs) : '\u2014';
  const isBestLapSessionBest =
    bestLapMs > 0 && sessionBestMs > 0 && bestLapMs === sessionBestMs;

  // Determine if this car's last lap IS the session fastest
  const isLastLapFastest =
    isFastest && lapData.lastLapTimeInMS > 0;

  const rowClasses = [
    styles.row,
    isPlayer ? styles.player : '',
    isLastLapFastest ? styles.fastest : '',
    isPit ? styles.pit : '',
    isRetired ? styles.retired : '',
  ]
    .filter(Boolean)
    .join(' ');

  const teamColor = getTeamColor(participant.teamId);

  const compoundClasses = [
    styles.compound,
    styles[compCls] || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <tr className={rowClasses}>
      <td className={styles.pos}>{lapData.carPosition}</td>
      <td className={styles.driver} style={{ borderLeftColor: teamColor }}>
        {participant.name}
      </td>
      <td className={isQualifying ? styles.qualiGap : undefined}>{gapLeader}</td>
      <td className={isQualifying ? styles.qualiGap : undefined}>{gapAhead}</td>
      <td className={styles.lastLap}>{lastLap}</td>
      <td className={isBestLapSessionBest ? styles.bestLap : undefined}>
        {bestLap}
      </td>
      <td>
        <span className={compoundClasses}>{compound}</span>
      </td>
      <td>{lapData.numPitStops || 0}</td>
      <td>{statusStr}</td>
    </tr>
  );
}

function rowsEqual(prev: TimingRowProps, next: TimingRowProps): boolean {
  if (prev.lapData.carPosition !== next.lapData.carPosition) return false;
  if (prev.lapData.lastLapTimeInMS !== next.lapData.lastLapTimeInMS)
    return false;
  if (prev.lapData.deltaToLeaderInMS !== next.lapData.deltaToLeaderInMS)
    return false;
  if (prev.lapData.deltaToCarInFrontInMS !== next.lapData.deltaToCarInFrontInMS)
    return false;
  if (prev.lapData.pitStatus !== next.lapData.pitStatus) return false;
  if (prev.lapData.resultStatus !== next.lapData.resultStatus) return false;
  if (prev.lapData.driverStatus !== next.lapData.driverStatus) return false;
  if (prev.lapData.numPitStops !== next.lapData.numPitStops) return false;
  if (prev.isPlayer !== next.isPlayer) return false;
  if (prev.isFastest !== next.isFastest) return false;
  if (prev.sessionBestLapMs !== next.sessionBestLapMs) return false;
  if (prev.isQualifying !== next.isQualifying) return false;
  if (prev.qualiBestMs !== next.qualiBestMs) return false;
  if (prev.sessionBestMs !== next.sessionBestMs) return false;
  if (prev.aheadBestMs !== next.aheadBestMs) return false;
  if (
    (prev.carStatus?.tyreCompoundName || '') !==
    (next.carStatus?.tyreCompoundName || '')
  )
    return false;
  return true;
}

const TimingRow = React.memo(TimingRowInner, rowsEqual);
export default TimingRow;
