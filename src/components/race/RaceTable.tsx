import React, { useMemo, useState, useCallback } from 'react';
import type { RaceEngineerCar } from '@shared/types';
import { useTimingStore } from '@/store/timingStore';
import { useRaceStore } from '@/store/raceStore';
import DataTable, { type DataColumn } from '@/components/common/DataTable';
import { fmtTime, fmtGap } from '@/lib/formatters';
import { driverColor, getCompoundColor, wearColor } from '@/lib/colors';
import { DRIVER_STATUS, RESULT_STATUS, ERS_FULL_ENERGY } from '@/lib/constants';
import StintBadge from './StintBadge';
import styles from './RaceTable.module.css';

interface RaceRow extends RaceEngineerCar {
  idx: number;
  avgWearPct: number;      // mean of 4-wheel wear
  maxWearPct: number;      // worst of FL / FR / RL / RR
  maxWingPct: number;      // worst of FL / FR / rear wing damage
  penaltySec: number;      // lapData.penalties
  warnings: number;        // lapData.totalWarnings (track-limit etc.)
  cornerCutWarnings: number;
  retiredOnLap: number;    // 0 if still in race; otherwise lap of retirement
  ersPct: number;          // 0–100 — carStatus.ersStoreEnergy / ERS_FULL_ENERGY
  ersMode: string;         // carStatus.ersDeployModeName
  maxSpeedKph: number;     // lapData.speedTrapFastestSpeed (km/h)
  maxSpeedLap: number;     // lap on which the speed-trap best was set
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
  const allCarStatus = useTimingStore((s) => s.allCarStatus);
  // Authoritative full-race stint list per car. Used to back-fill the
  // stint bar when the race-engineer's in-memory state lost continuity
  // (e.g. server restart mid-race) — the F1 SessionHistory packet always
  // re-broadcasts the complete history.
  const sessionHistories = useTimingStore((s) => s.sessionHistories);
  const playerCarIndex = useTimingStore((s) => s.playerCarIndex);
  // Race engineer state lives on raceStore — re-import locally to keep this
  // component standalone.
  const rawCars = useRawCars();

  const rows: RaceRow[] = useMemo(() => {
    return rawCars
      .map((c, i) => {
        const dmg = allDamage?.allCars?.[i];
        const lap = allLapData?.allCars?.[i];
        const carStatus = allCarStatus?.allCars?.[i];
        const history = sessionHistories.get(i);
        const tyres = dmg?.tyresWear;
        const avgWearPct = tyres && tyres.length === 4
          ? (tyres[0] + tyres[1] + tyres[2] + tyres[3]) / 4
          : 0;
        const maxWearPct = tyres && tyres.length === 4
          ? Math.max(tyres[0], tyres[1], tyres[2], tyres[3])
          : 0;
        const maxWingPct = dmg
          ? Math.max(dmg.frontLeftWingDamage ?? 0, dmg.frontRightWingDamage ?? 0, dmg.rearWingDamage ?? 0)
          : 0;
        // ── Stint history reconciliation ─────────────────────────────────
        // SessionHistory.stints is the authoritative race-long list:
        // every closed stint plus an open "current" stint whose endLap
        // tracks the running lap. If that's available, prefer it over the
        // race-engineer state (which can be missing pre-restart history).
        // The bar component takes past stints separately from the current
        // compound, so we split off the trailing entry.
        let mergedStints = c.stints;
        let mergedCompound = c.currentCompound;
        if (history && history.stints.length > 0) {
          const all = history.stints.map((s, idx) => ({
            compound: (s.compoundName || '').toUpperCase(),
            startLap: idx === 0 ? 1 : history.stints[idx - 1].endLap + 1,
            endLap: s.endLap,
          })).filter((s) => s.compound && s.compound !== 'UNKNOWN');
          if (all.length > 0) {
            const current = all[all.length - 1];
            mergedStints = all.slice(0, -1);
            // Only override compound if the race-engineer hasn't set one
            // (post-restart edge case) or the two disagree because the
            // RE was zeroed and never saw the live compound flicker.
            if (!mergedCompound) mergedCompound = current.compound;
          }
        }

        return {
          ...c,
          stints: mergedStints,
          currentCompound: mergedCompound,
          idx: i,
          avgWearPct,
          maxWearPct,
          maxWingPct,
          penaltySec: lap?.penalties ?? 0,
          warnings: lap?.totalWarnings ?? 0,
          cornerCutWarnings: lap?.cornerCuttingWarnings ?? 0,
          // For retired drivers `currentLap` typically holds the lap they
          // dropped out on. Surfaces in the expanded panel.
          retiredOnLap: c.resultStatus >= 4 ? c.currentLap : 0,
          ersPct: carStatus
            ? Math.max(0, Math.min(100, (carStatus.ersStoreEnergy / ERS_FULL_ENERGY) * 100))
            : 0,
          ersMode: carStatus?.ersDeployModeName ?? '',
          maxSpeedKph: lap?.speedTrapFastestSpeed ?? 0,
          maxSpeedLap: lap?.speedTrapFastestLap ?? 0,
          isPlayer: i === playerCarIndex,
        };
      })
      // Keep retired cars (position is sometimes 0 once they DNF) so the
      // user can still see their stint, last laps and retirement reason.
      .filter((r) => r.name && (r.position > 0 || r.resultStatus >= 4));
  }, [rawCars, allDamage, allLapData, allCarStatus, sessionHistories, playerCarIndex]);

  const columns: DataColumn<RaceRow>[] = useMemo(() => [
    {
      id: 'pos',
      header: 'POS',
      accessor: (r) => r.position,
      numeric: true,
      width: '48px',
    },
    {
      id: 'driver',
      header: 'DRIVER',
      accessor: (r) => r.name,
      width: '140px',
      render: (r) => (
        <span style={{ borderLeft: `3px solid ${driverColor(r)}`, paddingLeft: '0.5rem', fontWeight: 700 }}>
          {r.name}
        </span>
      ),
    },
    {
      id: 'lastLap',
      header: 'LAST\nLAP',
      accessor: (r) => r.lastLapMs || Number.MAX_SAFE_INTEGER,
      numeric: true,
      render: (r) => (r.lastLapMs ? fmtTime(r.lastLapMs) : '\u2014'),
    },
    {
      id: 'bestLap',
      header: 'BEST\nLAP',
      accessor: (r) => r.bestLapMs || Number.MAX_SAFE_INTEGER,
      numeric: true,
      render: (r) => (r.bestLapMs ? fmtTime(r.bestLapMs) : '\u2014'),
    },
    {
      id: 'gapLeader',
      header: 'GAP\nLEADER',
      accessor: (r) => r.gapToLeaderMs,
      numeric: true,
      render: (r) =>
        r.position === 1 ? 'LEAD' : r.gapToLeaderMs > 0 ? '+' + fmtGap(r.gapToLeaderMs) : '\u2014',
    },
    {
      id: 'gapAhead',
      header: 'GAP\nAHEAD',
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
      header: 'AVG\nWEAR',
      title: 'Average tyre wear across 4 wheels',
      accessor: (r) => r.avgWearPct,
      numeric: true,
      width: '78px',
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
      id: 'maxWear',
      header: 'MAX\nWEAR',
      title: 'Worst tyre wear (FL / FR / RL / RR)',
      accessor: (r) => r.maxWearPct,
      numeric: true,
      width: '78px',
      render: (r) =>
        r.maxWearPct > 0 ? (
          <span style={{ color: wearColor(r.maxWearPct), fontWeight: 700 }}>
            {r.maxWearPct.toFixed(1)}%
          </span>
        ) : (
          '—'
        ),
    },
    {
      id: 'maxWearPerLap',
      header: 'MAX WEAR\n/LAP',
      title: 'Average per-lap rate of the worst-tyre wear (max wear ÷ tyre age)',
      // Drivers on a freshly bolted set (age 0) sort to the bottom; ranking
      // by max-wear ÷ age otherwise lets a 1-lap stint with 2% wear masquerade
      // as a worse degrader than a 25-lap stint at 30%.
      accessor: (r) => (r.tyreAge > 0 ? r.maxWearPct / r.tyreAge : -1),
      numeric: true,
      width: '92px',
      render: (r) => {
        if (r.tyreAge <= 0 || r.maxWearPct <= 0) return '—';
        const perLap = r.maxWearPct / r.tyreAge;
        return (
          <span style={{ color: wearColor(perLap * 25), fontWeight: 700 }}>
            {perLap.toFixed(2)}
            <span style={{ color: 'var(--grey)', fontSize: '0.78em', marginLeft: '0.2em' }}>
              %/lap
            </span>
          </span>
        );
      },
    },
    {
      id: 'wing',
      header: 'WING',
      title: 'Worst wing damage (FL / FR / rear)',
      accessor: (r) => r.maxWingPct,
      numeric: true,
      width: '60px',
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
      width: '78px',
      render: (r) =>
        r.penaltySec > 0 ? (
          <span style={{ color: 'var(--red)', fontWeight: 700 }}>+{r.penaltySec}s</span>
        ) : (
          '—'
        ),
    },
    {
      id: 'warnings',
      header: 'WARN',
      title: 'Track-limit warnings (corner-cuts in parentheses)',
      accessor: (r) => r.warnings,
      numeric: true,
      width: '64px',
      render: (r) =>
        r.warnings > 0 ? (
          <span style={{ color: r.warnings >= 3 ? 'var(--red)' : 'var(--yellow)', fontWeight: 700 }}>
            {r.warnings}
            {r.cornerCutWarnings > 0 ? ` (${r.cornerCutWarnings})` : ''}
          </span>
        ) : (
          '—'
        ),
    },
    {
      id: 'stintHistory',
      header: 'STINT\nHISTORY',
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
      width: '52px',
    },
    {
      id: 'ers',
      header: 'ERS',
      title: 'ERS store energy (% of full charge)',
      accessor: (r) => r.ersPct,
      numeric: true,
      width: '60px',
      render: (r) => {
        const pct = Math.round(r.ersPct);
        const colour = pct >= 60 ? 'var(--green)' : pct >= 30 ? 'var(--yellow)' : 'var(--red)';
        return (
          <span style={{ color: colour, fontWeight: 700 }}>
            {pct}%
          </span>
        );
      },
    },
    {
      id: 'ersMode',
      header: 'ERS\nMODE',
      title: 'Active ERS deploy mode',
      accessor: (r) => r.ersMode,
      width: '80px',
      render: (r) => (
        <span style={{ color: 'var(--grey-light)', letterSpacing: '0.05em' }}>
          {r.ersMode || '—'}
        </span>
      ),
    },
    {
      id: 'maxSpeed',
      header: 'MAX\nSPEED',
      title: 'Speed-trap best (km/h) and the lap it was set',
      accessor: (r) => r.maxSpeedKph,
      numeric: true,
      width: '92px',
      render: (r) =>
        r.maxSpeedKph > 0 ? (
          <span style={{ fontWeight: 700 }}>
            {Math.round(r.maxSpeedKph)}
            <span style={{ color: 'var(--grey)', fontSize: '0.78em', marginLeft: '0.25em' }}>
              km/h
            </span>
            {r.maxSpeedLap > 0 && (
              <span style={{ color: 'var(--grey-light)', fontSize: '0.78em', marginLeft: '0.4em' }}>
                L{r.maxSpeedLap}
              </span>
            )}
          </span>
        ) : (
          '—'
        ),
    },
    {
      id: 'status',
      header: 'STATUS',
      accessor: (r) => r.resultStatus >= 4
        ? (RESULT_STATUS[r.resultStatus] || 'RET')
        : (DRIVER_STATUS[r.driverStatus] || ''),
      width: '88px',
    },
  ], []);

  // Multi-select state for the comparison panel. Shift-click toggles a
  // driver in/out; clicking the panel's "Clear" wipes it.
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const toggleSelect = useCallback((row: RaceRow) => {
    setSelectedIdx((prev) => {
      const next = new Set(prev);
      if (next.has(row.idx)) next.delete(row.idx);
      else next.add(row.idx);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIdx(new Set()), []);

  const rowClass = (r: RaceRow): string => {
    const parts: string[] = [];
    if (r.resultStatus >= 4) parts.push(styles.retired);
    else if (r.driverStatus === 0) parts.push(styles.pit);
    else if (r.isPlayer) parts.push(styles.player);
    if (selectedIdx.has(r.idx)) parts.push(styles.selected);
    return parts.join(' ');
  };

  // Resolve the actual rows for the comparison panel — keep their on-table
  // ordering rather than the order they were clicked, so the columns line
  // up with grid positions in a way that matches what the eye expects.
  const selectedRows = useMemo(
    () => rows.filter((r) => selectedIdx.has(r.idx)).sort((a, b) => a.position - b.position),
    [rows, selectedIdx],
  );

  // Expanded panel: last 5 laps for any driver, plus retirement reason +
  // the lap they dropped out on for retired cars.
  const renderExpanded = (r: RaceRow) => {
    const lastFive = (r.lapTimes || []).slice(-5);
    const retired = r.resultStatus >= 4;
    return (
      <div className={styles.expanded}>
        {retired && (
          <div className={styles.retiredInfo}>
            <span className={styles.retiredTag}>
              {RESULT_STATUS[r.resultStatus] || 'RET'}
            </span>
            {r.retiredOnLap > 0 && <span>on lap {r.retiredOnLap}</span>}
            <span className={styles.retiredFinal}>
              final P{r.position || '—'} · {r.numPitStops} pit{r.numPitStops === 1 ? '' : 's'}
              {r.bestLapMs ? ` · best ${fmtTime(r.bestLapMs)}` : ''}
            </span>
          </div>
        )}
        <div className={styles.lastLapsLabel}>LAST 5 LAPS</div>
        {lastFive.length === 0 ? (
          <div className={styles.lastLapsEmpty}>no completed laps</div>
        ) : (
          <ol className={styles.lastLapsList}>
            {lastFive.map((ms, i) => {
              const lapNum = (r.currentLap || lastFive.length) - (lastFive.length - 1 - i);
              return (
                <li key={i} className={styles.lastLap}>
                  <span className={styles.lastLapNum}>L{lapNum}</span>
                  <span className={styles.lastLapTime}>{ms ? fmtTime(ms) : '—'}</span>
                </li>
              );
            })}
            {/* Trailing summary cell — mean of the same window. Only counts
                non-zero samples so a partial 1-2 lap window doesn't get
                dragged toward zero. */}
            {(() => {
              const valid = lastFive.filter((ms) => ms > 0);
              if (valid.length === 0) return null;
              const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
              return (
                <li className={`${styles.lastLap} ${styles.lastLapAvg}`}>
                  <span className={styles.lastLapNum}>AVG</span>
                  <span className={styles.lastLapTime}>{fmtTime(avg)}</span>
                </li>
              );
            })()}
          </ol>
        )}
      </div>
    );
  };

  return (
    <>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.idx}
        storageKey="race"
        initialSort={{ columnId: 'pos', dir: 'asc' }}
        rowClassName={rowClass}
        renderExpanded={renderExpanded}
        onRowSelect={toggleSelect}
        emptyState={{ message: 'No race data yet', hint: 'Waiting for lap + participant packets' }}
        size="compact"
      />
      {selectedRows.length >= 2 && (
        <ComparisonPanel rows={selectedRows} onClear={clearSelection} onRemove={toggleSelect} />
      )}
      {selectedIdx.size === 1 && (
        <div className={styles.compareHint}>
          Shift-click another driver to compare. ({selectedRows[0]?.name ?? '—'} selected)
          <button type="button" className={styles.compareClear} onClick={clearSelection}>
            clear
          </button>
        </div>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Comparison panel — rendered below the table when ≥2 drivers are picked
// via shift-click. Each row is a metric; columns are drivers; the "best"
// cell per metric is bolded so the eye can scan deltas at a glance.
// ────────────────────────────────────────────────────────────────────────

interface ComparisonPanelProps {
  rows: RaceRow[];
  onClear: () => void;
  onRemove: (row: RaceRow) => void;
}

interface CompareMetric {
  label: string;
  /** Returns the displayable string per row. */
  format: (r: RaceRow) => string;
  /** Returns a numeric score per row used to find the "winner" cell. Return
   *  `null` to skip highlight (categorical metrics like ERS MODE). */
  score: (r: RaceRow) => number | null;
  /** "lower" → smaller wins (e.g. lap time, gap, wear). "higher" → bigger
   *  wins (e.g. ERS, max speed). */
  better: 'lower' | 'higher';
  /** Optional row hint shown beside the label. */
  hint?: string;
}

function lastFiveAvgMs(r: RaceRow): number {
  const valid = (r.lapTimes || []).slice(-5).filter((ms) => ms > 0);
  if (valid.length === 0) return 0;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

const COMPARE_METRICS: CompareMetric[] = [
  {
    label: 'POS',
    format: (r) => (r.position > 0 ? `P${r.position}` : '—'),
    score: (r) => (r.position > 0 ? r.position : Number.POSITIVE_INFINITY),
    better: 'lower',
  },
  {
    label: 'GAP TO LEADER',
    format: (r) => (r.position === 1 ? 'LEAD' : r.gapToLeaderMs > 0 ? `+${fmtGap(r.gapToLeaderMs)}` : '—'),
    score: (r) => r.gapToLeaderMs || 0,
    better: 'lower',
  },
  {
    label: 'BEST LAP',
    format: (r) => (r.bestLapMs > 0 ? fmtTime(r.bestLapMs) : '—'),
    score: (r) => r.bestLapMs || Number.POSITIVE_INFINITY,
    better: 'lower',
  },
  {
    label: 'LAST LAP',
    format: (r) => (r.lastLapMs > 0 ? fmtTime(r.lastLapMs) : '—'),
    score: (r) => r.lastLapMs || Number.POSITIVE_INFINITY,
    better: 'lower',
  },
  {
    label: 'AVG LAST 5',
    hint: 'mean of the last 5 completed laps',
    format: (r) => {
      const avg = lastFiveAvgMs(r);
      return avg > 0 ? fmtTime(avg) : '—';
    },
    score: (r) => lastFiveAvgMs(r) || Number.POSITIVE_INFINITY,
    better: 'lower',
  },
  {
    label: 'TYRE',
    format: (r) => `${r.currentCompound || '—'} (age ${r.tyreAge})`,
    score: () => null,
    better: 'lower',
  },
  {
    label: 'AVG WEAR',
    format: (r) => (r.avgWearPct > 0 ? `${r.avgWearPct.toFixed(1)}%` : '—'),
    score: (r) => r.avgWearPct,
    better: 'lower',
  },
  {
    label: 'MAX WEAR',
    format: (r) => (r.maxWearPct > 0 ? `${r.maxWearPct.toFixed(1)}%` : '—'),
    score: (r) => r.maxWearPct,
    better: 'lower',
  },
  {
    label: 'MAX WEAR/LAP',
    hint: 'lower = kinder to tyres',
    format: (r) => (r.tyreAge > 0 && r.maxWearPct > 0 ? `${(r.maxWearPct / r.tyreAge).toFixed(2)} %/lap` : '—'),
    score: (r) => (r.tyreAge > 0 && r.maxWearPct > 0 ? r.maxWearPct / r.tyreAge : Number.POSITIVE_INFINITY),
    better: 'lower',
  },
  {
    label: 'WING',
    format: (r) => (r.maxWingPct > 0 ? `${Math.round(r.maxWingPct)}%` : '—'),
    score: (r) => r.maxWingPct,
    better: 'lower',
  },
  {
    label: 'PITS',
    format: (r) => String(r.numPitStops),
    score: (r) => r.numPitStops,
    better: 'lower',
  },
  {
    label: 'STINTS',
    format: (r) => String((r.stints?.length ?? 0) + (r.currentCompound ? 1 : 0)),
    score: (r) => (r.stints?.length ?? 0) + (r.currentCompound ? 1 : 0),
    better: 'lower',
  },
  {
    label: 'WARNINGS',
    format: (r) => (r.warnings > 0 ? `${r.warnings}${r.cornerCutWarnings > 0 ? ` (${r.cornerCutWarnings})` : ''}` : '0'),
    score: (r) => r.warnings,
    better: 'lower',
  },
  {
    label: 'PENALTY',
    format: (r) => (r.penaltySec > 0 ? `+${r.penaltySec}s` : '—'),
    score: (r) => r.penaltySec,
    better: 'lower',
  },
  {
    label: 'ERS',
    format: (r) => `${Math.round(r.ersPct)}%`,
    score: (r) => r.ersPct,
    better: 'higher',
  },
  {
    label: 'ERS MODE',
    format: (r) => r.ersMode || '—',
    score: () => null,
    better: 'higher',
  },
  {
    label: 'MAX SPEED',
    format: (r) => (r.maxSpeedKph > 0 ? `${Math.round(r.maxSpeedKph)} km/h` : '—'),
    score: (r) => r.maxSpeedKph,
    better: 'higher',
  },
  {
    label: 'STATUS',
    format: (r) => (r.resultStatus >= 4
      ? RESULT_STATUS[r.resultStatus] || 'RET'
      : DRIVER_STATUS[r.driverStatus] || '—'),
    score: () => null,
    better: 'higher',
  },
];

function ComparisonPanel({ rows, onClear, onRemove }: ComparisonPanelProps) {
  return (
    <div className={styles.compareWrap}>
      <div className={styles.compareHeader}>
        <span className={styles.compareTitle}>
          DRIVER COMPARISON · {rows.length} selected
        </span>
        <button type="button" className={styles.compareClear} onClick={onClear}>
          clear all
        </button>
      </div>
      <div
        className={styles.compareGrid}
        style={{ gridTemplateColumns: `160px repeat(${rows.length}, minmax(140px, 1fr))` }}
      >
        {/* Driver header row */}
        <div className={`${styles.compareCell} ${styles.compareMetricLabel}`}> </div>
        {rows.map((r) => (
          <div key={r.idx} className={`${styles.compareCell} ${styles.compareDriverHead}`}>
            <span
              className={styles.compareDriverName}
              style={{ borderLeft: `3px solid ${driverColor(r)}` }}
            >
              <span className={styles.compareDriverPos}>P{r.position || '—'}</span>
              {r.name}
            </span>
            <button
              type="button"
              className={styles.compareRemove}
              aria-label={`Remove ${r.name} from comparison`}
              onClick={() => onRemove(r)}
            >
              ×
            </button>
          </div>
        ))}

        {/* Metric rows */}
        {COMPARE_METRICS.map((m) => {
          const scores = rows.map((r) => m.score(r));
          const numeric = scores.filter((s): s is number => s != null && Number.isFinite(s));
          const winner = numeric.length >= 2
            ? (m.better === 'lower' ? Math.min(...numeric) : Math.max(...numeric))
            : null;
          return (
            <React.Fragment key={m.label}>
              <div className={`${styles.compareCell} ${styles.compareMetricLabel}`}>
                {m.label}
                {m.hint && <span className={styles.compareMetricHint}>{m.hint}</span>}
              </div>
              {rows.map((r, i) => {
                const value = scores[i];
                const isWinner = winner != null && value === winner;
                return (
                  <div
                    key={r.idx}
                    className={`${styles.compareCell} ${isWinner ? styles.compareWinner : ''}`}
                  >
                    {m.format(r)}
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function useRawCars(): RaceEngineerCar[] {
  return useRaceStore((s) => s.raceState?.cars ?? []);
}
