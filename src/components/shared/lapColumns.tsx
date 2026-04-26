import React from 'react';
import type { RecordedLap } from '@shared/types';
import type { DataColumn } from '@/components/common/DataTable';
import { fmtTime } from '@/lib/formatters';
import { getCompoundColor } from '@/lib/colors';

/**
 * Shared column registry for per-lap tables. Used by the History lap table
 * and the Session live-lap table so both get the DataTable features (sort,
 * reorder, hide, keyboard) without re-declaring 9 columns twice.
 */
export function lapColumns(opts: { showTyreDot?: boolean } = {}): DataColumn<RecordedLap>[] {
  const showTyreDot = opts.showTyreDot ?? true;
  return [
    {
      id: 'lapNum',
      header: '#',
      accessor: (l) => l.lapNum,
      numeric: true,
      width: '56px',
      render: (l) => (
        <>
          {l.lapNum}
          {l.notes && <span title={l.notes}> 📝</span>}
        </>
      ),
    },
    {
      id: 'lapTime',
      header: 'TIME',
      accessor: (l) => l.lapTimeMs || Number.MAX_SAFE_INTEGER,
      numeric: true,
      render: (l) => (l.lapTimeMs > 0 ? fmtTime(l.lapTimeMs) : '\u2014'),
    },
    { id: 's1', header: 'S1', accessor: (l) => l.s1Ms || Number.MAX_SAFE_INTEGER, numeric: true, render: (l) => (l.s1Ms > 0 ? fmtTime(l.s1Ms) : '\u2014') },
    { id: 's2', header: 'S2', accessor: (l) => l.s2Ms || Number.MAX_SAFE_INTEGER, numeric: true, render: (l) => (l.s2Ms > 0 ? fmtTime(l.s2Ms) : '\u2014') },
    { id: 's3', header: 'S3', accessor: (l) => l.s3Ms || Number.MAX_SAFE_INTEGER, numeric: true, render: (l) => (l.s3Ms > 0 ? fmtTime(l.s3Ms) : '\u2014') },
    {
      id: 'compound',
      header: showTyreDot ? 'TYRE' : 'COMP',
      accessor: (l) => l.compound,
      render: (l) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          {showTyreDot && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: getCompoundColor(l.compound),
              }}
            />
          )}
          {l.compound || '\u2014'}
        </span>
      ),
    },
    { id: 'tyreAge', header: 'AGE', accessor: (l) => l.tyreAge ?? 0, numeric: true, width: '56px' },
    {
      id: 'maxSpeed',
      header: 'MAX SPD',
      accessor: (l) => l.maxSpeed ?? 0,
      numeric: true,
      render: (l) => (l.maxSpeed ? `${l.maxSpeed} km/h` : '\u2014'),
    },
    {
      id: 'valid',
      header: 'VALID',
      accessor: (l) => (l.valid === false ? 0 : 1),
      width: '72px',
      render: (l) => {
        if (l.isOutLap) return <span style={{ color: 'var(--yellow)', fontSize: '0.5rem' }}>OUT</span>;
        if (l.isPitLap) return <span style={{ color: 'var(--orange)', fontSize: '0.5rem' }}>PIT</span>;
        return l.valid === false ? <span style={{ color: 'var(--red)' }}>✗</span> : <span style={{ color: 'var(--green)' }}>✓</span>;
      },
    },
  ];
}
