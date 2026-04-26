import React, { useMemo } from 'react';
import type { RaceEngineerCar } from '@shared/types';
import { useTimingStore } from '@/store/timingStore';
import { useRaceStore } from '@/store/raceStore';
import DataTable, { type DataColumn } from '@/components/common/DataTable';
import { fmtTime, fmtGap } from '@/lib/formatters';
import { getTeamColor, getCompoundColor, wearColor } from '@/lib/colors';
import { DRIVER_STATUS, RESULT_STATUS } from '@/lib/constants';
import StintBadge from './StintBadge';
import styles from './RaceTable.module.css';

interface RaceRow extends RaceEngineerCar {
  idx: number;
  avgWearPct: number;      // mean of 4-wheel wear
  maxWingPct: number;      // worst of FL / FR / rear wing damage
  penaltySec: number;      // lapData.penalties
  isPlayer: boolean;
}

function wingColor(pct: number): string {
  if (pct >= 80) return 'var(--red)';
  if (pct >= 40) return 'var(--orange)';
  if (pct >= 10) return 'var(--yellow)';
  return 'var(--green)';
}

export default function RaceTable() {
  // Pull raw state — each store is a tiny slice so the re-render cost is fine.
  // The rAF-throttled WebSocket handler keeps this cheap during a race.
  const allDamage = useTimingStore((s) => s.allCarDamage);
  const allLapData = useTimingStore((s) => s.allLapData);
  const playerCarIndex = useTimingStore((s) => s.playerCarIndex);
  // Race engineer state lives on raceStore — re-import locally to keep this
  // component standalone.
  const rawCars = useRawCars();

  const rows: RaceRow[] = useMemo(() => {
    return rawCars
      .map((c, i) => {
        const dmg = allDamage?.allCars?.[i];
        const lap = allLapData?.allCars?.[i];
        const tyres = dmg?.tyresWear;
        const avgWearPct = tyres && tyres.length === 4
          ? (tyres[0] + tyres[1] + tyres[2] + tyres[3]) / 4
          : 0;
        const maxWingPct = dmg
          ? Math.max(dmg.frontLeftWingDamage ?? 0, dmg.frontRightWingDamage ?? 0, dmg.rearWingDamage ?? 0)
          : 0;
        return {
          ...c,
          idx: i,
          avgWearPct,
          maxWingPct,
          penaltySec: lap?.penalties ?? 0,
          isPlayer: i === playerCarIndex,
        };
      })
      .filter((r) => r.name && r.position > 0);
  }, [rawCars, allDamage, allLapData, playerCarIndex]);

  const columns: DataColumn<RaceRow>[] = useMemo(() => [
    {
      id: 'pos',
      header: 'POS',
      accessor: (r) => r.position,
      numeric: true,
      width: '52px',
    },
    {
      id: 'driver',
      header: 'DRIVER',
      accessor: (r) => r.name,
      width: '140px',
      render: (r) => (
        <span style={{ borderLeft: `3px solid ${getTeamColor(r.teamId)}`, paddingLeft: '0.5rem', fontWeight: 700 }}>
          {r.name}
        </span>
      ),
    },
    {
      id: 'lastLap',
      header: 'LAST LAP',
      accessor: (r) => r.lastLapMs || Number.MAX_SAFE_INTEGER,
      numeric: true,
      render: (r) => (r.lastLapMs ? fmtTime(r.lastLapMs) : '\u2014'),
    },
    {
      id: 'bestLap',
      header: 'BEST LAP',
      accessor: (r) => r.bestLapMs || Number.MAX_SAFE_INTEGER,
      numeric: true,
      render: (r) => (r.bestLapMs ? fmtTime(r.bestLapMs) : '\u2014'),
    },
    {
      id: 'gapLeader',
      header: 'GAP LEADER',
      accessor: (r) => r.gapToLeaderMs,
      numeric: true,
      render: (r) =>
        r.position === 1 ? 'LEAD' : r.gapToLeaderMs > 0 ? '+' + fmtGap(r.gapToLeaderMs) : '\u2014',
    },
    {
      id: 'gapAhead',
      header: 'GAP AHEAD',
      accessor: (r) => r.gapToAheadMs,
      numeric: true,
      render: (r) =>
        r.position === 1 ? '\u2014' : r.gapToAheadMs > 0 ? '+' + fmtGap(r.gapToAheadMs) : '\u2014',
    },
    {
      id: 'tyre',
      header: 'TYRE',
      accessor: (r) => r.currentCompound,
      render: (r) => (
        <span className={styles.tyre}>
          <span
            className={styles.tyreDot}
            style={{ background: getCompoundColor(r.currentCompound) }}
          />
          {r.currentCompound || '\u2014'}
        </span>
      ),
    },
    {
      id: 'age',
      header: 'AGE',
      accessor: (r) => r.tyreAge,
      numeric: true,
      width: '52px',
    },
    {
      id: 'avgWear',
      header: 'AVG WEAR',
      title: 'Average tyre wear across 4 wheels',
      accessor: (r) => r.avgWearPct,
      numeric: true,
      width: '88px',
      render: (r) =>
        r.avgWearPct > 0 ? (
          <span style={{ color: wearColor(r.avgWearPct), fontWeight: 700 }}>
            {r.avgWearPct.toFixed(1)}%
          </span>
        ) : (
          '\u2014'
        ),
    },
    {
      id: 'wing',
      header: 'WING',
      title: 'Worst wing damage (FL / FR / rear)',
      accessor: (r) => r.maxWingPct,
      numeric: true,
      width: '72px',
      render: (r) =>
        r.maxWingPct > 0 ? (
          <span style={{ color: wingColor(r.maxWingPct), fontWeight: 700 }}>
            {Math.round(r.maxWingPct)}%
          </span>
        ) : (
          '\u2014'
        ),
    },
    {
      id: 'penalty',
      header: 'PENALTY',
      title: 'Time penalty seconds',
      accessor: (r) => r.penaltySec,
      numeric: true,
      width: '80px',
      render: (r) =>
        r.penaltySec > 0 ? (
          <span style={{ color: 'var(--red)', fontWeight: 700 }}>+{r.penaltySec}s</span>
        ) : (
          '—'
        ),
    },
    {
      id: 'stintHistory',
      header: 'STINT HISTORY',
      accessor: (r) => r.stints?.length ?? 0,
      sortable: false,
      width: '1fr',
      render: (r) => (
        <StintBadge
          stints={r.stints || []}
          currentCompound={r.currentCompound}
          currentLap={r.currentLap}
        />
      ),
    },
    {
      id: 'pits',
      header: 'PITS',
      accessor: (r) => r.numPitStops,
      numeric: true,
      width: '56px',
    },
    {
      id: 'status',
      header: 'STATUS',
      accessor: (r) => r.resultStatus >= 4
        ? (RESULT_STATUS[r.resultStatus] || 'RET')
        : (DRIVER_STATUS[r.driverStatus] || ''),
      width: '96px',
    },
  ], []);

  const rowClass = (r: RaceRow): string => {
    if (r.resultStatus >= 4) return styles.retired;
    if (r.driverStatus === 0) return styles.pit;
    if (r.isPlayer) return styles.player;
    return '';
  };

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(r) => r.idx}
      storageKey="race"
      initialSort={{ columnId: 'pos', dir: 'asc' }}
      rowClassName={rowClass}
      emptyState={{ message: 'No race data yet', hint: 'Waiting for lap + participant packets' }}
      size="compact"
    />
  );
}

function useRawCars(): RaceEngineerCar[] {
  return useRaceStore((s) => s.raceState?.cars ?? []);
}
