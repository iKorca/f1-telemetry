import React, { useMemo } from 'react';
import type { SessionDetail } from '@shared/types';
import LapTableBase from '@/components/shared/LapTableBase';

interface LapTableProps {
  session: SessionDetail;
  selectedLapIdx: number | null;
  onLapSelect: (lapIdx: number) => void;
  onContextMenu: (e: React.MouseEvent, lapIdx: number) => void;
}

function LapTable({
  session,
  selectedLapIdx,
  onLapSelect,
  onContextMenu,
}: LapTableProps) {
  const bestIdx = useMemo(() => {
    const allLaps = session.laps || [];
    let bestTime = Infinity;
    let best = -1;
    allLaps.forEach((lap, idx) => {
      if (!lap.deleted && lap.valid && lap.lapTimeMs > 0 && lap.lapTimeMs < bestTime) {
        bestTime = lap.lapTimeMs;
        best = idx;
      }
    });
    return best;
  }, [session.laps]);

  return (
    <LapTableBase
      laps={session.laps || []}
      bestLapIdx={bestIdx}
      selectedLapIdx={selectedLapIdx}
      onLapClick={onLapSelect}
      onContextMenu={onContextMenu}
      showTyreDot={false}
    />
  );
}

export default React.memo(LapTable);
