import React, { useMemo } from 'react';
import type { SessionDetail, RecordedLap } from '@shared/types';
import { findBestLapIndex } from '@/lib/lapUtils';
import DataTable from '@/components/common/DataTable';
import { lapColumns } from '@/components/shared/lapColumns';

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
  const bestIdx = useMemo(() => findBestLapIndex(session.laps || []), [session.laps]);

  // Preserve the original slot index so click / right-click still points
  // at the correct `session.laps[i]` after filtering out deleted laps.
  const rows = useMemo<(RecordedLap & { __idx: number })[]>(
    () =>
      (session.laps || [])
        .map((l, i) => ({ ...l, __idx: i }))
        .filter((l) => !l.deleted),
    [session.laps],
  );

  const columns = useMemo(() => lapColumns({ showTyreDot: false }), []);

  const rowClass = (l: (typeof rows)[number]) => {
    const parts: string[] = [];
    if (l.__idx === bestIdx) parts.push('historyLapBest');
    if (l.__idx === selectedLapIdx) parts.push('historyLapSelected');
    if (l.valid === false || l.isOutLap || l.isPitLap) parts.push('historyLapDim');
    return parts.join(' ');
  };

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(l) => l.__idx}
      storageKey="history-laps"
      initialSort={{ columnId: 'lapNum', dir: 'asc' }}
      onRowClick={(l) => onLapSelect(l.__idx)}
      onRowContextMenu={(l, e) => {
        e.preventDefault();
        onContextMenu(e, l.__idx);
      }}
      rowClassName={rowClass}
      size="compact"
      emptyState={{ message: 'No laps recorded' }}
    />
  );
}

export default React.memo(LapTable);
