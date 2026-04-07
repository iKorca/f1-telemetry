import { useRef } from 'react';
import { useTimingStore } from '../../store/timingStore';
import { useSessionInfoStore } from '../../store/sessionInfoStore';
import TimingRow from './TimingRow';
import EmptyState from '@/components/common/EmptyState';
import styles from './TimingTab.module.css';

interface SortedCar {
  idx: number;
  lapData: import('@shared/types').LapData;
  participant: import('@shared/types').Participant;
  carStatus: import('@shared/types').CarStatus | null;
}

const QUALI_RE = /^Q|^Short Q|^OSQ|Sprint SO/i;

export default function TimingTab() {
  const allLapData = useTimingStore((s) => s.allLapData);
  const allParticipants = useTimingStore((s) => s.allParticipants);
  const allCarStatus = useTimingStore((s) => s.allCarStatus);
  const playerCarIndex = useTimingStore((s) => s.playerCarIndex);
  const sessionTypeName = useSessionInfoStore((s) => s.sessionTypeName);

  // Persist best-lap map across renders (keyed by car index)
  const bestLapsRef = useRef<Map<number, number>>(new Map());

  if (!allLapData?.allCars || !allParticipants?.participants) {
    return <EmptyState message="WAITING FOR TIMING DATA..." />;
  }

  const cars = allLapData.allCars;
  const names = allParticipants.participants;
  const statuses = allCarStatus?.allCars || [];
  const isQualifying = QUALI_RE.test(sessionTypeName);

  // Build rows (filter active cars with position > 0 and a name)
  const rows: SortedCar[] = [];
  for (let i = 0; i < cars.length; i++) {
    if (!cars[i] || cars[i].carPosition === 0) continue;
    if (!names[i]?.name) continue;
    rows.push({
      idx: i,
      lapData: cars[i],
      participant: names[i],
      carStatus: statuses[i] || null,
    });
  }

  // Update best-lap map for qualifying
  const bestLaps = bestLapsRef.current;
  if (isQualifying) {
    for (const r of rows) {
      const last = r.lapData.lastLapTimeInMS;
      if (last > 0) {
        const prev = bestLaps.get(r.idx);
        if (!prev || last < prev) {
          bestLaps.set(r.idx, last);
        }
      }
    }
  }

  // Sort: qualifying by best lap, race by position
  if (isQualifying) {
    rows.sort((a, b) => {
      const aBest = bestLaps.get(a.idx) ?? Infinity;
      const bBest = bestLaps.get(b.idx) ?? Infinity;
      if (aBest === bBest) return a.lapData.carPosition - b.lapData.carPosition;
      return aBest - bBest;
    });
  } else {
    rows.sort((a, b) => a.lapData.carPosition - b.lapData.carPosition);
  }

  // Find session fastest last-lap time
  let sessionFastest = Infinity;
  for (const r of rows) {
    if (
      r.lapData.lastLapTimeInMS > 0 &&
      r.lapData.lastLapTimeInMS < sessionFastest
    ) {
      sessionFastest = r.lapData.lastLapTimeInMS;
    }
  }

  // Session best lap overall (for qualifying gap calculation)
  let sessionBestMs = Infinity;
  if (isQualifying) {
    for (const v of bestLaps.values()) {
      if (v < sessionBestMs) sessionBestMs = v;
    }
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>POS</th>
            <th>DRIVER</th>
            <th>{isQualifying ? 'GAP TO P1' : 'GAP LEADER'}</th>
            <th>GAP AHEAD</th>
            <th>LAST LAP</th>
            <th>BEST LAP</th>
            <th>TYRE</th>
            <th>PITS</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const qualiBestMs = isQualifying ? (bestLaps.get(r.idx) ?? 0) : 0;
            const aheadBestMs =
              isQualifying && i > 0 ? (bestLaps.get(rows[i - 1].idx) ?? 0) : 0;
            return (
              <TimingRow
                key={r.idx}
                carIndex={r.idx}
                participant={r.participant}
                lapData={r.lapData}
                carStatus={r.carStatus}
                isPlayer={r.idx === playerCarIndex}
                isFastest={
                  r.lapData.lastLapTimeInMS === sessionFastest &&
                  sessionFastest < Infinity
                }
                sessionBestLapMs={
                  sessionFastest < Infinity ? sessionFastest : 0
                }
                isQualifying={isQualifying}
                qualiBestMs={qualiBestMs}
                sessionBestMs={sessionBestMs < Infinity ? sessionBestMs : 0}
                aheadBestMs={aheadBestMs}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
