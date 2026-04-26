import React from 'react';
import type { LapData, CarStatus, Participant } from '@shared/types';
import { DRIVER_STATUS } from '@/lib/constants';
import { fmtTime, fmtSector, fmtDelta } from '@/lib/formatters';
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
  // Per-car best sector times (from session history) + session-wide bests
  // for colour-coding. 0 = no data yet.
  bestS1Ms: number;
  bestS2Ms: number;
  bestS3Ms: number;
  sessionBestS1Ms: number;
  sessionBestS2Ms: number;
  sessionBestS3Ms: number;
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
  bestS1Ms,
  bestS2Ms,
  bestS3Ms,
  sessionBestS1Ms,
  sessionBestS2Ms,
  sessionBestS3Ms,
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

  // Sector-cell colour rules:
  //   purple  = session best (overall optimal sector)
  //   green   = driver's personal best (but not session best)
  //   white   = filled but not best
  const sectorClass = (sectorMs: number, sessBest: number) => {
    if (sectorMs <= 0) return styles.sectorEmpty;
    if (sessBest > 0 && sectorMs === sessBest) return styles.sectorPurple;
    return styles.sectorGreen;
  };

  const s1Str = bestS1Ms > 0 ? fmtSector(bestS1Ms) : '\u2014';
  const s2Str = bestS2Ms > 0 ? fmtSector(bestS2Ms) : '\u2014';
  const s3Str = bestS3Ms > 0 ? fmtSector(bestS3Ms) : '\u2014';

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
      <td className={sectorClass(bestS1Ms, sessionBestS1Ms)}>{s1Str}</td>
      <td className={sectorClass(bestS2Ms, sessionBestS2Ms)}>{s2Str}</td>
      <td className={sectorClass(bestS3Ms, sessionBestS3Ms)}>{s3Str}</td>
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
  if (prev.bestS1Ms !== next.bestS1Ms) return false;
  if (prev.bestS2Ms !== next.bestS2Ms) return false;
  if (prev.bestS3Ms !== next.bestS3Ms) return false;
  if (prev.sessionBestS1Ms !== next.sessionBestS1Ms) return false;
  if (prev.sessionBestS2Ms !== next.sessionBestS2Ms) return false;
  if (prev.sessionBestS3Ms !== next.sessionBestS3Ms) return false;
  return true;
}

const TimingRow = React.memo(TimingRowInner, rowsEqual);
export default TimingRow;
