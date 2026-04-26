import { useRef, useMemo, useEffect } from 'react';
import { useTimingStore } from '../../store/timingStore';
import { useSessionInfoStore } from '../../store/sessionInfoStore';
import DataTable, { type DataColumn } from '@/components/common/DataTable';
import { fmtTime, fmtSector, fmtDelta } from '@/lib/formatters';
import { getTeamColor, getCompoundColor } from '@/lib/colors';
import { DRIVER_STATUS } from '@/lib/constants';
import EmptyState from '@/components/common/EmptyState';
import type { LapData, CarStatus, Participant, SessionHistoryData } from '@shared/types';
import styles from './TimingTab.module.css';

const LAPTIME_SESSION_RE = /^P\d|^Short P|^Q|^Short Q|^OSQ|Sprint SO|Time Trial/i;

const RESULT_STATUS: Record<number, string> = {
  0: '', 1: '', 2: 'DNF', 3: 'DSQ', 4: 'NC', 5: 'RET',
};

function bestSectorsFor(history: SessionHistoryData | undefined) {
  if (!history?.laps) return { s1: 0, s2: 0, s3: 0 };
  let s1 = Infinity, s2 = Infinity, s3 = Infinity;
  for (const lap of history.laps) {
    if (lap.sector1TimeInMS > 0 && lap.sector1Valid && lap.sector1TimeInMS < s1) s1 = lap.sector1TimeInMS;
    if (lap.sector2TimeInMS > 0 && lap.sector2Valid && lap.sector2TimeInMS < s2) s2 = lap.sector2TimeInMS;
    if (lap.sector3TimeInMS > 0 && lap.sector3Valid && lap.sector3TimeInMS < s3) s3 = lap.sector3TimeInMS;
  }
  return {
    s1: Number.isFinite(s1) ? s1 : 0,
    s2: Number.isFinite(s2) ? s2 : 0,
    s3: Number.isFinite(s3) ? s3 : 0,
  };
}

interface TimingRow {
  idx: number;
  lapData: LapData;
  participant: Participant;
  carStatus: CarStatus | null;
  isPlayer: boolean;
  isFastest: boolean;
  isQualifying: boolean;
  qualiBestMs: number;
  sessionBestMs: number;
  aheadBestMs: number;
  bestS1Ms: number;
  bestS2Ms: number;
  bestS3Ms: number;
  sessionBestS1Ms: number;
  sessionBestS2Ms: number;
  sessionBestS3Ms: number;
}

/**
 * Build the column definitions used by the timing table. Pure function of
 * `isLaptimeSession`, but lives in its own hook so the call site can keep
 * the column-build `useMemo` ABOVE any conditional return — necessary to
 * obey React's rules of hooks. Previously the component placed this
 * `useMemo` after an empty-state early return, which crashed React's hook
 * bookkeeping every time data first arrived (the ErrorBoundary at App
 * level masked it).
 */
function useTimingColumns(isLaptimeSession: boolean): DataColumn<TimingRow>[] {
  return useMemo(() => {
    const sectorClass = (ms: number, sessBest: number): string | undefined => {
      if (ms <= 0) return undefined;
      if (sessBest > 0 && ms === sessBest) return styles.sectorPurple;
      return styles.sectorGreen;
    };

    return [
      { id: 'pos', header: 'POS', accessor: (r) => r.lapData.carPosition, numeric: true, width: '48px' },
      {
        id: 'driver', header: 'DRIVER',
        accessor: (r) => r.participant.name,
        width: '140px',
        render: (r) => (
          <span style={{ borderLeft: `3px solid ${getTeamColor(r.participant.teamId)}`, paddingLeft: '0.5rem', fontWeight: 700 }}>
            {r.participant.name}
          </span>
        ),
      },
      {
        id: 'gapLeader',
        header: isLaptimeSession ? 'GAP TO P1' : 'GAP LEADER',
        accessor: (r) => {
          if (isLaptimeSession) {
            if (r.qualiBestMs === 0 || r.sessionBestMs === 0) return Number.MAX_SAFE_INTEGER;
            return r.qualiBestMs - r.sessionBestMs;
          }
          return r.lapData.deltaToLeaderInMS;
        },
        numeric: true,
        render: (r) => {
          if (isLaptimeSession) {
            if (r.qualiBestMs > 0 && r.sessionBestMs > 0 && r.qualiBestMs === r.sessionBestMs) return 'P1';
            if (r.qualiBestMs > 0 && r.sessionBestMs > 0) return '+' + fmtDelta(r.qualiBestMs - r.sessionBestMs);
            return '—';
          }
          return r.lapData.carPosition === 1 ? 'LEAD' : '+' + fmtDelta(r.lapData.deltaToLeaderInMS);
        },
      },
      {
        id: 'gapAhead', header: 'GAP AHEAD',
        accessor: (r) => {
          if (isLaptimeSession) {
            if (r.qualiBestMs === 0 || r.aheadBestMs === 0) return Number.MAX_SAFE_INTEGER;
            return r.qualiBestMs - r.aheadBestMs;
          }
          return r.lapData.deltaToCarInFrontInMS;
        },
        numeric: true,
        render: (r) => {
          if (isLaptimeSession) {
            if (r.qualiBestMs > 0 && r.aheadBestMs > 0 && r.qualiBestMs === r.sessionBestMs) return '—';
            if (r.qualiBestMs > 0 && r.aheadBestMs > 0) return '+' + fmtDelta(r.qualiBestMs - r.aheadBestMs);
            return '—';
          }
          return r.lapData.carPosition === 1 ? '—' : '+' + fmtDelta(r.lapData.deltaToCarInFrontInMS);
        },
      },
      {
        id: 'lastLap', header: 'LAST LAP',
        accessor: (r) => r.lapData.lastLapTimeInMS || Number.MAX_SAFE_INTEGER,
        numeric: true,
        render: (r) => (r.lapData.lastLapTimeInMS > 0 ? fmtTime(r.lapData.lastLapTimeInMS) : '—'),
      },
      {
        id: 'bestLap', header: 'BEST LAP',
        accessor: (r) => (isLaptimeSession ? r.qualiBestMs : 0) || Number.MAX_SAFE_INTEGER,
        numeric: true,
        render: (r) => {
          const bestMs = isLaptimeSession ? r.qualiBestMs : 0;
          const isSessionBest = bestMs > 0 && r.sessionBestMs > 0 && bestMs === r.sessionBestMs;
          return (
            <span className={isSessionBest ? styles.bestLap : undefined}>
              {bestMs > 0 ? fmtTime(bestMs) : '—'}
            </span>
          );
        },
      },
      {
        id: 's1', header: 'S1', title: 'Best sector 1 this session',
        accessor: (r) => r.bestS1Ms || Number.MAX_SAFE_INTEGER,
        numeric: true,
        render: (r) => (
          <span className={sectorClass(r.bestS1Ms, r.sessionBestS1Ms)}>
            {r.bestS1Ms > 0 ? fmtSector(r.bestS1Ms) : '—'}
          </span>
        ),
      },
      {
        id: 's2', header: 'S2', title: 'Best sector 2 this session',
        accessor: (r) => r.bestS2Ms || Number.MAX_SAFE_INTEGER,
        numeric: true,
        render: (r) => (
          <span className={sectorClass(r.bestS2Ms, r.sessionBestS2Ms)}>
            {r.bestS2Ms > 0 ? fmtSector(r.bestS2Ms) : '—'}
          </span>
        ),
      },
      {
        id: 's3', header: 'S3', title: 'Best sector 3 this session',
        accessor: (r) => r.bestS3Ms || Number.MAX_SAFE_INTEGER,
        numeric: true,
        render: (r) => (
          <span className={sectorClass(r.bestS3Ms, r.sessionBestS3Ms)}>
            {r.bestS3Ms > 0 ? fmtSector(r.bestS3Ms) : '—'}
          </span>
        ),
      },
      {
        id: 'tyre', header: 'TYRE',
        accessor: (r) => r.carStatus?.tyreCompoundName ?? '',
        render: (r) => {
          const compound = r.carStatus?.tyreCompoundName || '—';
          return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: getCompoundColor(compound),
              }} />
              {compound}
            </span>
          );
        },
      },
      {
        id: 'pits', header: 'PITS',
        accessor: (r) => r.lapData.numPitStops || 0,
        numeric: true,
        width: '56px',
      },
      {
        id: 'status', header: 'STATUS',
        accessor: (r) => {
          const dr = DRIVER_STATUS[r.lapData.driverStatus] || '';
          const res = RESULT_STATUS[r.lapData.resultStatus] || '';
          return res || dr;
        },
        width: '96px',
      },
    ];
  }, [isLaptimeSession]);
}

export default function TimingTab() {
  const allLapData = useTimingStore((s) => s.allLapData);
  const allParticipants = useTimingStore((s) => s.allParticipants);
  const allCarStatus = useTimingStore((s) => s.allCarStatus);
  const playerCarIndex = useTimingStore((s) => s.playerCarIndex);
  const sessionHistories = useTimingStore((s) => s.sessionHistories);
  const sessionTypeName = useSessionInfoStore((s) => s.sessionTypeName);
  const trackLength = useSessionInfoStore((s) => s.trackLength);

  const bestLapsRef = useRef<Map<number, number>>(new Map());
  const isLaptimeSession = LAPTIME_SESSION_RE.test(sessionTypeName);

  // Clear the per-car best-lap cache whenever the session identity changes
  // (e.g. P1 → P2, or driver loads a different track). Without this the
  // map keyed by `carIdx` carries previous-session bests into a fresh
  // P3/Q1, sorting drivers by stale times and showing wrong "GAP TO P1".
  useEffect(() => {
    bestLapsRef.current = new Map();
  }, [sessionTypeName, trackLength]);

  // Column defs depend only on session-type. Computed here, BEFORE the
  // empty-state early return — otherwise the very first render (no data)
  // skips the `useMemo`, then later renders include it, and React's
  // rules-of-hooks bookkeeping crashes the tree. Currently the
  // ErrorBoundary at App level catches this and shows a fallback, masking
  // the bug; the proper fix is unconditional hook order.
  const columns = useTimingColumns(isLaptimeSession);

  if (!allLapData?.allCars || !allParticipants?.participants) {
    return <EmptyState message="WAITING FOR TIMING DATA..." />;
  }

  const cars = allLapData.allCars;
  const names = allParticipants.participants;
  const statuses = allCarStatus?.allCars || [];
  const minLapMs = trackLength > 0 ? Math.max(30000, (trackLength / 97) * 700) : 30000;

  // Collect active cars
  const pre: Omit<TimingRow, 'isFastest' | 'qualiBestMs' | 'sessionBestMs' | 'aheadBestMs' | 'sessionBestS1Ms' | 'sessionBestS2Ms' | 'sessionBestS3Ms'>[] = [];
  for (let i = 0; i < cars.length; i++) {
    if (!cars[i] || cars[i].carPosition === 0) continue;
    if (!names[i]?.name) continue;
    const sectors = bestSectorsFor(sessionHistories.get(i));
    pre.push({
      idx: i,
      lapData: cars[i],
      participant: names[i],
      carStatus: statuses[i] || null,
      isPlayer: i === playerCarIndex,
      isQualifying: isLaptimeSession,
      bestS1Ms: sectors.s1,
      bestS2Ms: sectors.s2,
      bestS3Ms: sectors.s3,
    });
  }

  // Track per-car best lap for practice/qualifying sessions
  const bestLaps = bestLapsRef.current;
  if (isLaptimeSession) {
    for (const r of pre) {
      const last = r.lapData.lastLapTimeInMS;
      if (last > minLapMs) {
        const prev = bestLaps.get(r.idx);
        if (!prev || last < prev) bestLaps.set(r.idx, last);
      }
    }
  }

  // Session bests
  let sessionFastest = Infinity;
  for (const r of pre) {
    if (r.lapData.lastLapTimeInMS > minLapMs && r.lapData.lastLapTimeInMS < sessionFastest) {
      sessionFastest = r.lapData.lastLapTimeInMS;
    }
  }
  let sessionBestMs = Infinity;
  if (isLaptimeSession) for (const v of bestLaps.values()) if (v < sessionBestMs) sessionBestMs = v;

  let sbS1 = Infinity, sbS2 = Infinity, sbS3 = Infinity;
  for (const r of pre) {
    if (r.bestS1Ms > 0 && r.bestS1Ms < sbS1) sbS1 = r.bestS1Ms;
    if (r.bestS2Ms > 0 && r.bestS2Ms < sbS2) sbS2 = r.bestS2Ms;
    if (r.bestS3Ms > 0 && r.bestS3Ms < sbS3) sbS3 = r.bestS3Ms;
  }

  const sortedPre = pre
    .map((r): TimingRow => ({
      ...r,
      qualiBestMs: isLaptimeSession ? bestLaps.get(r.idx) ?? 0 : 0,
      sessionBestMs: Number.isFinite(sessionBestMs) ? sessionBestMs : 0,
      aheadBestMs: 0, // recomputed below once order is known
      isFastest: r.lapData.lastLapTimeInMS === sessionFastest && Number.isFinite(sessionFastest),
      sessionBestS1Ms: Number.isFinite(sbS1) ? sbS1 : 0,
      sessionBestS2Ms: Number.isFinite(sbS2) ? sbS2 : 0,
      sessionBestS3Ms: Number.isFinite(sbS3) ? sbS3 : 0,
    }));

  if (isLaptimeSession) {
    sortedPre.sort((a, b) => {
      const aBest = bestLaps.get(a.idx) ?? Infinity;
      const bBest = bestLaps.get(b.idx) ?? Infinity;
      return aBest === bBest
        ? a.lapData.carPosition - b.lapData.carPosition
        : aBest - bBest;
    });
  } else {
    sortedPre.sort((a, b) => a.lapData.carPosition - b.lapData.carPosition);
  }

  // After sorting, fill `aheadBestMs` from the row immediately above each
  // (used only for the Δ to car ahead in the Gap Ahead column).
  for (let i = 0; i < sortedPre.length; i++) {
    sortedPre[i].aheadBestMs =
      isLaptimeSession && i > 0 ? bestLaps.get(sortedPre[i - 1].idx) ?? 0 : 0;
  }

  const rowClass = (r: TimingRow): string => {
    const parts: string[] = [];
    if (r.isPlayer) parts.push(styles.player);
    if (r.isFastest && r.lapData.lastLapTimeInMS > 0) parts.push(styles.fastest);
    if (r.lapData.pitStatus > 0) parts.push(styles.pit);
    if (r.lapData.resultStatus >= 2) parts.push(styles.retired);
    return parts.join(' ');
  };

  return (
    <div className={styles.wrap}>
      <DataTable
        columns={columns}
        rows={sortedPre}
        getRowId={(r) => r.idx}
        storageKey="timing"
        rowClassName={rowClass}
        size="compact"
      />
    </div>
  );
}
