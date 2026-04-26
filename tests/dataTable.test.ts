import { describe, it, expect } from 'vitest';
import { applySort } from '../src/components/common/DataTable/useTableState';
import type { DataColumn } from '../src/components/common/DataTable/types';

interface Row {
  name: string;
  pos: number;
  lap: number;
}

const cols: DataColumn<Row>[] = [
  { id: 'name', header: 'DRIVER', accessor: (r) => r.name },
  { id: 'pos',  header: 'POS',    accessor: (r) => r.pos,  numeric: true },
  { id: 'lap',  header: 'LAP',    accessor: (r) => r.lap,  numeric: true },
];

const rows: Row[] = [
  { name: 'ALONSO',     pos: 5, lap: 82345 },
  { name: 'VERSTAPPEN', pos: 1, lap: 80123 },
  { name: 'HAMILTON',   pos: 3, lap: 81900 },
  { name: 'NORRIS',     pos: 1, lap: 80123 }, // ties with Verstappen on both
];

describe('applySort', () => {
  it('returns the input reference-shape unchanged when sort is empty', () => {
    const out = applySort(rows, [], cols);
    expect(out).toEqual(rows);
  });

  it('sorts ascending by a numeric column', () => {
    const out = applySort(rows, [{ columnId: 'pos', dir: 'asc' }], cols);
    expect(out.map((r) => r.pos)).toEqual([1, 1, 3, 5]);
  });

  it('sorts descending by a string column using locale collator', () => {
    const out = applySort(rows, [{ columnId: 'name', dir: 'desc' }], cols);
    expect(out.map((r) => r.name)).toEqual(['VERSTAPPEN', 'NORRIS', 'HAMILTON', 'ALONSO']);
  });

  it('multi-sort: primary pos asc, tiebreak name asc', () => {
    const out = applySort(
      rows,
      [
        { columnId: 'pos', dir: 'asc' },
        { columnId: 'name', dir: 'asc' },
      ],
      cols,
    );
    // Two cars at P1 — Norris before Verstappen alphabetically
    expect(out.map((r) => r.name)).toEqual(['NORRIS', 'VERSTAPPEN', 'HAMILTON', 'ALONSO']);
  });

  it('puts NaN / non-numeric values last on numeric columns', () => {
    const weird: Row[] = [
      ...rows,
      { name: 'MAYBE', pos: Number.NaN, lap: 0 },
    ];
    const out = applySort(weird, [{ columnId: 'pos', dir: 'asc' }], cols);
    expect(out[out.length - 1].name).toBe('MAYBE');
  });

  it('does not mutate the input array', () => {
    const input = rows.slice();
    applySort(input, [{ columnId: 'pos', dir: 'asc' }], cols);
    expect(input.map((r) => r.name)).toEqual(['ALONSO', 'VERSTAPPEN', 'HAMILTON', 'NORRIS']);
  });
});
