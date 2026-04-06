import React, { useMemo } from 'react';
import type { SessionDetail } from '@shared/types';
import { findBestLapIndex } from '@/lib/lapUtils';
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
    return findBestLapIndex(session.laps || []);
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
