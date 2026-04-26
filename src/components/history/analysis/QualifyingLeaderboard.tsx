import React, { useMemo, useState } from 'react';
import type { SessionDetail, CarLap, Participant } from '@shared/types';
import { fmtTime, fmtSector, fmtDelta } from '@/lib/formatters';
import { getTeamColor } from '@/lib/colors';
import styles from './QualifyingLeaderboard.module.css';

interface Props {
  session: SessionDetail;
  /**
   * Called when the user asks to open full telemetry for two picked laps.
   * Only fires when both laps belong to the player (the only car whose frames
   * were recorded). `a` / `b` are indices into `session.laps[]`.
   */
  onOpenTelemetry?: (aLapIdx: number, bLapIdx: number) => void;
}

interface DriverRow {
  idx: number;
  participant: Participant;
  laps: CarLap[];
  bestLapMs: number;
  bestLapIdx: number;
  bestS1Ms: number;
  bestS2Ms: number;
  bestS3Ms: number;
}

interface LapSelection {
  driverIdx: number;
  lapIdx: number; // index within that driver's laps[]
}

/**
 * Per-driver leaderboard for saved qualifying / practice / sprint-shootout
 * sessions. Driven by `session.raceData.carLaps` + `session.raceData.participants`
 * (populated for every car from their SessionHistory packets during the
 * recording). Drivers are sortable by best lap; clicking a row expands all
 * of their laps with S1/S2/S3. Checkboxes next to individual laps let the
 * user pick exactly two (from any driver) to compare side-by-side.
 */
export default function QualifyingLeaderboard({ session, onOpenTelemetry }: Props) {
  const rd = session.raceData;

  // Match the player against the per-car lap records by fingerprinting the
  // player's RecordedLap[] against each driver's CarLap[] lap-time sequence.
  // The best-match driver is the player — the only car whose frames exist.
  const playerCarIdx = useMemo<number | null>(() => {
    if (!rd?.carLaps || !session.laps || session.laps.length === 0) return null;
    const playerTimes = session.laps
      .filter((l) => l.lapTimeMs > 0 && !l.deleted)
      .map((l) => ({ n: l.lapNum, ms: l.lapTimeMs }));
    if (playerTimes.length === 0) return null;
    let bestIdx: number | null = null;
    let bestScore = Infinity;
    for (const idxStr of Object.keys(rd.carLaps)) {
      const idx = Number(idxStr);
      const carLaps = rd.carLaps[idx] || [];
      let score = 0;
      let matched = 0;
      for (const p of playerTimes) {
        const c = carLaps.find((x) => x.lapNum === p.n);
        if (!c) { score += 10000; continue; }
        score += Math.abs(c.lapTimeMs - p.ms);
        matched++;
      }
      if (matched === 0) continue;
      if (score < bestScore) { bestScore = score; bestIdx = idx; }
    }
    return bestIdx;
  }, [rd, session.laps]);

  // Translate a picked (driverIdx, lapNum) back into the player's session.laps
  // index so we can drive the existing ChartSection. Null if the pick isn't
  // the player or the lap can't be located.
  const playerLapIdxFromPick = (driverIdx: number, lapNum: number): number | null => {
    if (playerCarIdx == null || driverIdx !== playerCarIdx) return null;
    const idx = (session.laps || []).findIndex(
      (l) => l.lapNum === lapNum && !l.deleted,
    );
    return idx >= 0 ? idx : null;
  };

  const rows: DriverRow[] = useMemo(() => {
    if (!rd?.carLaps || !rd.participants) return [];
    const out: DriverRow[] = [];
    for (const key of Object.keys(rd.carLaps)) {
      const idx = Number(key);
      const p = rd.participants[idx];
      if (!p || !p.name) continue;
      const laps = (rd.carLaps[idx] || []).filter((l) => l.lapTimeMs > 0 && l.valid);
      if (laps.length === 0) continue;
      let best = Infinity, bestIdx = -1;
      let bS1 = Infinity, bS2 = Infinity, bS3 = Infinity;
      for (let i = 0; i < laps.length; i++) {
        const l = laps[i];
        if (l.lapTimeMs < best) { best = l.lapTimeMs; bestIdx = i; }
        if (l.s1Ms > 0 && l.s1Ms < bS1) bS1 = l.s1Ms;
        if (l.s2Ms > 0 && l.s2Ms < bS2) bS2 = l.s2Ms;
        if (l.s3Ms > 0 && l.s3Ms < bS3) bS3 = l.s3Ms;
      }
      out.push({
        idx,
        participant: p,
        laps,
        bestLapMs: Number.isFinite(best) ? best : 0,
        bestLapIdx: bestIdx,
        bestS1Ms: Number.isFinite(bS1) ? bS1 : 0,
        bestS2Ms: Number.isFinite(bS2) ? bS2 : 0,
        bestS3Ms: Number.isFinite(bS3) ? bS3 : 0,
      });
    }
    out.sort((a, b) => a.bestLapMs - b.bestLapMs);
    return out;
  }, [rd]);

  // Session-wide optimal sectors, for purple highlighting
  const { sessionBestS1, sessionBestS2, sessionBestS3 } = useMemo(() => {
    let s1 = Infinity, s2 = Infinity, s3 = Infinity;
    for (const r of rows) {
      if (r.bestS1Ms > 0 && r.bestS1Ms < s1) s1 = r.bestS1Ms;
      if (r.bestS2Ms > 0 && r.bestS2Ms < s2) s2 = r.bestS2Ms;
      if (r.bestS3Ms > 0 && r.bestS3Ms < s3) s3 = r.bestS3Ms;
    }
    return {
      sessionBestS1: Number.isFinite(s1) ? s1 : 0,
      sessionBestS2: Number.isFinite(s2) ? s2 : 0,
      sessionBestS3: Number.isFinite(s3) ? s3 : 0,
    };
  }, [rows]);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [picks, setPicks] = useState<LapSelection[]>([]);

  const toggleExpand = (idx: number) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const togglePick = (sel: LapSelection) => {
    setPicks((prev) => {
      const exists = prev.find((p) => p.driverIdx === sel.driverIdx && p.lapIdx === sel.lapIdx);
      if (exists) return prev.filter((p) => p !== exists);
      const next = [...prev, sel];
      // Cap at 2 — drop the oldest when a third lap is ticked.
      return next.length > 2 ? next.slice(-2) : next;
    });
  };

  const clearPicks = () => setPicks([]);

  const sectorClass = (ms: number, sessBest: number) => {
    if (ms <= 0) return styles.sectorEmpty;
    if (sessBest > 0 && ms === sessBest) return styles.sectorPurple;
    return styles.sectorGreen;
  };

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        No per-driver timing data recorded for this session.
      </div>
    );
  }

  const leaderBest = rows[0].bestLapMs;

  // Resolve the picked laps to CarLap objects for the compare panel.
  const picked = picks
    .map((p) => {
      const row = rows.find((r) => r.idx === p.driverIdx);
      const lap = row?.laps[p.lapIdx];
      if (!row || !lap) return null;
      return { row, lap };
    })
    .filter((x): x is { row: DriverRow; lap: CarLap } => x != null);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <span className={styles.title}>QUALIFYING RESULTS</span>
        <span className={styles.subtitle}>{rows.length} drivers</span>
        {picks.length > 0 && (
          <button type="button" className={styles.clearBtn} onClick={clearPicks}>
            Clear picks ({picks.length})
          </button>
        )}
      </div>

      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">POS</th>
            <th scope="col">DRIVER</th>
            <th scope="col">BEST LAP</th>
            <th scope="col">GAP</th>
            <th scope="col">S1</th>
            <th scope="col">S2</th>
            <th scope="col">S3</th>
            <th scope="col">LAPS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, pos) => {
            const isOpen = expanded.has(r.idx);
            const gap = pos === 0 ? 'P1' : `+${fmtDelta(r.bestLapMs - leaderBest)}`;
            const teamColor = getTeamColor(r.participant.teamId);
            return (
              <React.Fragment key={r.idx}>
                <tr
                  className={`${styles.driverRow} ${isOpen ? styles.driverRowOpen : ''}`}
                  onClick={() => toggleExpand(r.idx)}
                  aria-expanded={isOpen}
                >
                  <td className={styles.pos}>{pos + 1}</td>
                  <td className={styles.driver} style={{ borderLeftColor: teamColor }}>
                    <span className={styles.chev}>{isOpen ? '\u25BC' : '\u25B6'}</span>
                    {r.participant.name}
                  </td>
                  <td className={styles.bestLap}>
                    {r.bestLapMs > 0 ? fmtTime(r.bestLapMs) : '\u2014'}
                  </td>
                  <td>{gap}</td>
                  <td className={sectorClass(r.bestS1Ms, sessionBestS1)}>
                    {r.bestS1Ms > 0 ? fmtSector(r.bestS1Ms) : '\u2014'}
                  </td>
                  <td className={sectorClass(r.bestS2Ms, sessionBestS2)}>
                    {r.bestS2Ms > 0 ? fmtSector(r.bestS2Ms) : '\u2014'}
                  </td>
                  <td className={sectorClass(r.bestS3Ms, sessionBestS3)}>
                    {r.bestS3Ms > 0 ? fmtSector(r.bestS3Ms) : '\u2014'}
                  </td>
                  <td>{r.laps.length}</td>
                </tr>

                {isOpen && r.laps.map((lap, li) => {
                  const isBestForDriver = li === r.bestLapIdx;
                  const picked = picks.find((p) => p.driverIdx === r.idx && p.lapIdx === li);
                  return (
                    <tr
                      key={`${r.idx}_${li}`}
                      className={`${styles.lapRow} ${picked ? styles.lapRowPicked : ''}`}
                    >
                      <td></td>
                      <td className={styles.lapCell}>
                        <input
                          type="checkbox"
                          aria-label={`Pick lap ${lap.lapNum} for comparison`}
                          checked={!!picked}
                          onChange={() => togglePick({ driverIdx: r.idx, lapIdx: li })}
                        />
                        <span className={styles.lapNum}>L{lap.lapNum}</span>
                        {isBestForDriver && <span className={styles.tag}>PB</span>}
                        {lap.compound && <span className={styles.compound}>{lap.compound}</span>}
                      </td>
                      <td className={isBestForDriver ? styles.bestLap : undefined}>
                        {fmtTime(lap.lapTimeMs)}
                      </td>
                      <td>{pos === 0 && isBestForDriver ? '\u2014' : `+${fmtDelta(lap.lapTimeMs - leaderBest)}`}</td>
                      <td className={sectorClass(lap.s1Ms, sessionBestS1)}>
                        {lap.s1Ms > 0 ? fmtSector(lap.s1Ms) : '\u2014'}
                      </td>
                      <td className={sectorClass(lap.s2Ms, sessionBestS2)}>
                        {lap.s2Ms > 0 ? fmtSector(lap.s2Ms) : '\u2014'}
                      </td>
                      <td className={sectorClass(lap.s3Ms, sessionBestS3)}>
                        {lap.s3Ms > 0 ? fmtSector(lap.s3Ms) : '\u2014'}
                      </td>
                      <td>{lap.tyreAge ?? '\u2014'}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {picked.length === 2 && (() => {
        const aLapIdx = playerLapIdxFromPick(picks[0].driverIdx, picked[0].lap.lapNum);
        const bLapIdx = playerLapIdxFromPick(picks[1].driverIdx, picked[1].lap.lapNum);
        const bothPlayer = aLapIdx != null && bLapIdx != null;
        return (
          <LapCompareRow
            a={picked[0]}
            b={picked[1]}
            sessBestS1={sessionBestS1}
            sessBestS2={sessionBestS2}
            sessBestS3={sessionBestS3}
            onOpenTelemetry={
              bothPlayer && onOpenTelemetry
                ? () => onOpenTelemetry(aLapIdx!, bLapIdx!)
                : undefined
            }
            telemetryAvailableNote={
              !bothPlayer
                ? (playerCarIdx == null
                    ? 'Per-frame telemetry was not recorded for this session.'
                    : 'Full telemetry traces available only for the player\u2019s own laps.')
                : undefined
            }
          />
        );
      })()}
      {picked.length === 1 && (
        <div className={styles.hint}>
          Pick a second lap (from any driver) to compare.
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
//  Inline side-by-side compare panel. Mirrors the shape of the practice
//  LapCompare but takes raw CarLap pairs from the saved session rather than
//  the live practice-store state.
// ──────────────────────────────────────────────────────────────────────────

interface LapCompareRowProps {
  a: { row: DriverRow; lap: CarLap };
  b: { row: DriverRow; lap: CarLap };
  sessBestS1: number;
  sessBestS2: number;
  sessBestS3: number;
  onOpenTelemetry?: () => void;
  telemetryAvailableNote?: string;
}

function LapCompareRow({
  a, b,
  sessBestS1, sessBestS2, sessBestS3,
  onOpenTelemetry,
  telemetryAvailableNote,
}: LapCompareRowProps) {
  const A = '#3b82f6';
  const B = '#f59e0b';
  const aLabel = `${a.row.participant.name} L${a.lap.lapNum}`;
  const bLabel = `${b.row.participant.name} L${b.lap.lapNum}`;

  // Sector breakdown — side-by-side bars + signed deltas.
  const sectors = [
    { name: 'S1', aMs: a.lap.s1Ms, bMs: b.lap.s1Ms, best: sessBestS1 },
    { name: 'S2', aMs: a.lap.s2Ms, bMs: b.lap.s2Ms, best: sessBestS2 },
    { name: 'S3', aMs: a.lap.s3Ms, bMs: b.lap.s3Ms, best: sessBestS3 },
  ];

  // Running cumulative delta across sectors — shows exactly where the lap
  // was won / lost.
  let running = 0;
  const deltas = sectors.map((s) => {
    if (!s.aMs || !s.bMs) return { d: null as number | null, cum: null as number | null };
    const d = s.bMs - s.aMs;
    running += d;
    return { d, cum: running };
  });

  // Normalise sector widths against the LONGER sector for balanced bars
  const maxSec = Math.max(
    ...sectors.flatMap((s) => [s.aMs || 0, s.bMs || 0]),
  );

  const rows: Array<{
    label: string;
    aVal: number;
    bVal: number;
    fmt: (v: number) => string;
    lowerIsBetter: boolean;
    isTime?: boolean;
  }> = [
    { label: 'Lap time',  aVal: a.lap.lapTimeMs,   bVal: b.lap.lapTimeMs,   fmt: fmtTime,   lowerIsBetter: true, isTime: true },
    { label: 'Position',  aVal: a.lap.position,    bVal: b.lap.position,    fmt: (v) => `P${v}`, lowerIsBetter: true },
    { label: 'Tyre',      aVal: 0,                 bVal: 0,                 fmt: () => '',   lowerIsBetter: true },
    { label: 'Tyre age',  aVal: a.lap.tyreAge,     bVal: b.lap.tyreAge,     fmt: (v) => String(v), lowerIsBetter: true },
    { label: 'Pit stops', aVal: a.lap.numPitStops, bVal: b.lap.numPitStops, fmt: (v) => String(v), lowerIsBetter: true },
  ];

  return (
    <div className={styles.compare}>
      <div className={styles.compareHeader}>
        <span className={styles.compareTitle}>LAP COMPARE</span>
        <span className={styles.compareSub}>
          <span style={{ color: A }}>{aLabel}</span>
          {' vs '}
          <span style={{ color: B }}>{bLabel}</span>
        </span>
        {onOpenTelemetry && (
          <button
            type="button"
            className={styles.openTelemetryBtn}
            onClick={onOpenTelemetry}
            title="Overlay speed/throttle/brake + mini-sectors + track map"
          >
            VIEW FULL TELEMETRY →
          </button>
        )}
      </div>

      {/* ── Sector breakdown bars ───────────────────────────────────── */}
      <div className={styles.sectorRows}>
        {sectors.map((s, i) => {
          const aW = s.aMs && maxSec > 0 ? (s.aMs / maxSec) * 100 : 0;
          const bW = s.bMs && maxSec > 0 ? (s.bMs / maxSec) * 100 : 0;
          const d = deltas[i].d;
          const bBetter = d != null && d < 0;
          const deltaColor = d == null ? 'var(--grey)' : bBetter ? 'var(--green)' : 'var(--red)';
          const deltaStr = d == null ? '—' : `${d >= 0 ? '+' : ''}${(d / 1000).toFixed(3)}s`;
          return (
            <div key={s.name} className={styles.sectorRow}>
              <div className={styles.sectorLabel}>{s.name}</div>
              <div className={styles.sectorBarWrap}>
                <div className={styles.sectorBar} style={{ width: `${aW}%`, background: A }} />
                <span className={styles.sectorBarLabel}>
                  {s.aMs > 0 ? fmtSector(s.aMs) : '—'}
                </span>
              </div>
              <div className={styles.sectorBarWrap}>
                <div className={styles.sectorBar} style={{ width: `${bW}%`, background: B }} />
                <span className={styles.sectorBarLabel}>
                  {s.bMs > 0 ? fmtSector(s.bMs) : '—'}
                </span>
              </div>
              <div className={styles.sectorDelta} style={{ color: deltaColor }}>
                {deltaStr}
                {deltas[i].cum != null && (
                  <span className={styles.sectorCum} title="Cumulative Δ">
                    ({deltas[i].cum! >= 0 ? '+' : ''}{(deltas[i].cum! / 1000).toFixed(3)}s cum)
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Scalar metrics ───────────────────────────────────────────── */}
      <div className={styles.compareGrid}>
        <div className={styles.compareLabel}>Metric</div>
        <div className={styles.compareHead} style={{ color: A }}>A</div>
        <div className={styles.compareHead} style={{ color: B }}>B</div>
        <div className={styles.compareHead}>Δ (B − A)</div>
        {rows.map((r) => {
          if (r.label === 'Tyre') {
            return (
              <React.Fragment key={r.label}>
                <div className={styles.compareLabel}>Tyre</div>
                <div className={styles.compareVal}>{a.lap.compound || '\u2014'}</div>
                <div className={styles.compareVal}>{b.lap.compound || '\u2014'}</div>
                <div className={styles.compareVal}>
                  {a.lap.compound === b.lap.compound ? 'same' : '—'}
                </div>
              </React.Fragment>
            );
          }
          const aStr = r.aVal > 0 ? r.fmt(r.aVal) : '\u2014';
          const bStr = r.bVal > 0 ? r.fmt(r.bVal) : '\u2014';
          let dStr = '\u2014';
          let dColor: string | undefined;
          if (r.aVal > 0 && r.bVal > 0) {
            const diff = r.bVal - r.aVal;
            if (r.isTime) {
              dStr = `${diff >= 0 ? '+' : ''}${(diff / 1000).toFixed(3)} s`;
            } else {
              dStr = `${diff >= 0 ? '+' : ''}${diff}`;
            }
            if (Math.abs(diff) > 0.0001) {
              const bBetter = r.lowerIsBetter ? diff < 0 : diff > 0;
              dColor = bBetter ? 'var(--green)' : 'var(--red)';
            }
          }
          return (
            <React.Fragment key={r.label}>
              <div className={styles.compareLabel}>{r.label}</div>
              <div className={styles.compareVal}>{aStr}</div>
              <div className={styles.compareVal}>{bStr}</div>
              <div className={styles.compareVal} style={{ color: dColor, fontWeight: dColor ? 700 : undefined }}>
                {dStr}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {telemetryAvailableNote && (
        <div className={styles.compareNote}>{telemetryAvailableNote}</div>
      )}
    </div>
  );
}
