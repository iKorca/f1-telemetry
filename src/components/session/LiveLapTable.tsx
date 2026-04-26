import React, { useMemo } from 'react';
import type { SessionDetail, RecordedLap } from '@shared/types';
import { findBestLapIndex } from '@/lib/lapUtils';
import DataTable from '@/components/common/DataTable';
import { lapColumns } from '@/components/shared/lapColumns';

interface LiveLapTableProps {
  session: SessionDetail;
  selectedLap: number | null;
  onLapClick: (lapIdx: number) => void;
}

function LiveLapTable({ session, selectedLap, onLapClick }: LiveLapTableProps) {
  const bestIdx = useMemo(
    () => findBestLapIndex(session.laps || []),
    [session.laps],
  );

  const rows = useMemo<(RecordedLap & { __idx: number })[]>(
    () =>
      (session.laps || [])
        .map((l, i) => ({ ...l, __idx: i }))
        .filter((l) => !l.deleted),
    [session.laps],
  );

  const columns = useMemo(() => lapColumns({ showTyreDot: true }), []);

  const rowClass = (l: (typeof rows)[number]): string => {
    const parts: string[] = [];
    if (l.__idx === bestIdx) parts.push('historyLapBest');
    if (l.__idx === selectedLap) parts.push('historyLapSelected');
    if (l.valid === false || l.isOutLap || l.isPitLap) parts.push('historyLapDim');
    return parts.join(' ');
  };

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(l) => l.__idx}
      storageKey="session-laps"
      initialSort={{ columnId: 'lapNum', dir: 'asc' }}
      onRowClick={(l) => onLapClick(l.__idx)}
      rowClassName={rowClass}
      size="compact"
      emptyState={{ message: 'Waiting for the first recorded lap' }}
    />
  );
}

export default React.memo(LiveLapTable);
