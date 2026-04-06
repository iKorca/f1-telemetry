import { useTimingStore } from '../../store/timingStore';
import TimingRow from './TimingRow';
import EmptyState from '@/components/common/EmptyState';
import styles from './TimingTab.module.css';

interface SortedCar {
  idx: number;
  lapData: import('@shared/types').LapData;
  participant: import('@shared/types').Participant;
  carStatus: import('@shared/types').CarStatus | null;
}

export default function TimingTab() {
  const allLapData = useTimingStore((s) => s.allLapData);
  const allParticipants = useTimingStore((s) => s.allParticipants);
  const allCarStatus = useTimingStore((s) => s.allCarStatus);
  const playerCarIndex = useTimingStore((s) => s.playerCarIndex);

  if (!allLapData?.allCars || !allParticipants?.participants) {
    return <EmptyState message="WAITING FOR TIMING DATA..." />;
  }

  const cars = allLapData.allCars;
  const names = allParticipants.participants;
  const statuses = allCarStatus?.allCars || [];

  // Build sorted rows (filter active cars with position > 0 and a name)
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

  rows.sort((a, b) => a.lapData.carPosition - b.lapData.carPosition);

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

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>POS</th>
            <th>DRIVER</th>
            <th>GAP LEADER</th>
            <th>GAP AHEAD</th>
            <th>LAST LAP</th>
            <th>BEST LAP</th>
            <th>TYRE</th>
            <th>PITS</th>
            <th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
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
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
