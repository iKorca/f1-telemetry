import React, { useMemo, useRef, useEffect } from 'react';
import type { SessionDetail } from '@shared/types';
import LapTableBase from '@/components/shared/LapTableBase';

interface LiveLapTableProps {
  session: SessionDetail;
  selectedLap: number | null;
  onLapClick: (lapIdx: number) => void;
}

function LiveLapTable({ session, selectedLap, onLapClick }: LiveLapTableProps) {
  const prevLapCountRef = useRef(0);

  const { laps, bestIdx } = useMemo(() => {
    const laps = session.laps || [];
    let bestTime = Infinity;
    let bestIdx = -1;
    laps.forEach((l, i) => {
      if (
        l.lapTimeMs > 0 &&
        l.valid !== false &&
        !l.deleted &&
        l.lapTimeMs < bestTime
      ) {
        bestTime = l.lapTimeMs;
        bestIdx = i;
      }
    });
    return { laps, bestIdx };
  }, [session.laps]);

  // Track new laps for flash animation
  const currentLapCount = laps.length;
  const hasNewLap = currentLapCount > prevLapCountRef.current;
  useEffect(() => {
    prevLapCountRef.current = currentLapCount;
  }, [currentLapCount]);

  return (
    <LapTableBase
      laps={laps}
      bestLapIdx={bestIdx}
      selectedLapIdx={selectedLap}
      onLapClick={onLapClick}
      showFlashAnimation={hasNewLap}
      flashLapIdx={laps.length - 1}
      showTyreDot={true}
    />
  );
}

export default React.memo(LiveLapTable);
