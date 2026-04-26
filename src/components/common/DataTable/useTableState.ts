import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import type { DataColumn, SortSpec, TablePersistedState } from './types';
import { loadTableState, saveTableState } from './storage';

interface UseTableStateArgs<Row> {
  columns: DataColumn<Row>[];
  storageKey?: string;
  initialSort?: SortSpec;
}

interface UseTableStateResult<Row> {
  /** Columns after order + hidden filters (preserves original `DataColumn` refs). */
  visibleColumns: DataColumn<Row>[];
  /** Full column list, ordered but including hidden (for the menu). */
  orderedColumns: DataColumn<Row>[];
  hidden: Set<string>;
  order: string[];
  sort: SortSpec[];

  cycleSort: (columnId: string, shift: boolean) => void;
  toggleHidden: (columnId: string) => void;
  moveColumn: (draggedId: string, targetId: string, side: 'before' | 'after') => void;
  resetAll: () => void;
}

/**
 * Reducer-ish hook centralising column order, visibility, and multi-column
 * sort for `DataTable`. Persists to `storageKey` if supplied.
 */
export function useTableState<Row>({
  columns,
  storageKey,
  initialSort,
}: UseTableStateArgs<Row>): UseTableStateResult<Row> {
  // Load once per-mount. If the column set has changed (id added / removed
  // upstream) we fall through to the column array itself.
  const persisted = useMemo<TablePersistedState>(
    () => (storageKey ? loadTableState(storageKey) : {}),
    [storageKey],
  );

  const defaultHidden = useMemo(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id)),
    [columns],
  );

  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(persisted.hidden ?? Array.from(defaultHidden)),
  );
  const [order, setOrder] = useState<string[]>(() => {
    const known = new Set(columns.map((c) => c.id));
    const fromPersist = (persisted.order ?? []).filter((id) => known.has(id));
    const remainder = columns.map((c) => c.id).filter((id) => !fromPersist.includes(id));
    return [...fromPersist, ...remainder];
  });
  const [sort, setSort] = useState<SortSpec[]>(
    () => persisted.sort ?? (initialSort ? [initialSort] : []),
  );

  // Re-sync `order` when the column id set changes. We avoid re-resetting
  // when the id set is stable (common case) so user-dragged order sticks
  // through data updates.
  const lastColumnIdsRef = useRef<string>('');
  useEffect(() => {
    const key = columns.map((c) => c.id).join('|');
    if (key === lastColumnIdsRef.current) return;
    lastColumnIdsRef.current = key;
    setOrder((prev) => {
      const known = new Set(columns.map((c) => c.id));
      const kept = prev.filter((id) => known.has(id));
      const added = columns.map((c) => c.id).filter((id) => !kept.includes(id));
      return [...kept, ...added];
    });
  }, [columns]);

  // Persist on every change.
  useEffect(() => {
    if (!storageKey) return;
    saveTableState(storageKey, {
      order,
      hidden: Array.from(hidden),
      sort,
    });
  }, [storageKey, order, hidden, sort]);

  const orderedColumns = useMemo(() => {
    const byId = new Map(columns.map((c) => [c.id, c]));
    return order.map((id) => byId.get(id)).filter(Boolean) as DataColumn<Row>[];
  }, [columns, order]);

  const visibleColumns = useMemo(
    () => orderedColumns.filter((c) => !hidden.has(c.id)),
    [orderedColumns, hidden],
  );

  const cycleSort = useCallback((columnId: string, shift: boolean) => {
    setSort((prev) => {
      const existing = prev.find((s) => s.columnId === columnId);
      const others = prev.filter((s) => s.columnId !== columnId);
      // three-state cycle: unsorted → asc → desc → unsorted
      let next: SortSpec | null;
      if (!existing) next = { columnId, dir: 'asc' };
      else if (existing.dir === 'asc') next = { columnId, dir: 'desc' };
      else next = null;

      if (shift) {
        // multi-sort: append / replace / remove, keep the rest.
        return next ? [...others, next] : others;
      }
      return next ? [next] : [];
    });
  }, []);

  const toggleHidden = useCallback((columnId: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      return next;
    });
  }, []);

  const moveColumn = useCallback(
    (draggedId: string, targetId: string, side: 'before' | 'after') => {
      if (draggedId === targetId) return;
      setOrder((prev) => {
        const without = prev.filter((id) => id !== draggedId);
        const targetIdx = without.indexOf(targetId);
        if (targetIdx < 0) return prev;
        const insertAt = side === 'before' ? targetIdx : targetIdx + 1;
        return [...without.slice(0, insertAt), draggedId, ...without.slice(insertAt)];
      });
    },
    [],
  );

  const resetAll = useCallback(() => {
    setHidden(new Set(defaultHidden));
    setOrder(columns.map((c) => c.id));
    setSort(initialSort ? [initialSort] : []);
    if (storageKey) saveTableState(storageKey, { order: [], hidden: [], sort: [] });
  }, [columns, defaultHidden, initialSort, storageKey]);

  return {
    visibleColumns,
    orderedColumns,
    hidden,
    order,
    sort,
    cycleSort,
    toggleHidden,
    moveColumn,
    resetAll,
  };
}

/**
 * Apply a `SortSpec[]` (first entry primary, subsequent entries tie-breakers)
 * over `rows` using each column's `accessor`. Returns a new array; never
 * mutates the input.
 */
export function applySort<Row>(
  rows: Row[],
  sort: SortSpec[],
  columns: DataColumn<Row>[],
): Row[] {
  if (sort.length === 0) return rows;
  const byId = new Map(columns.map((c) => [c.id, c]));
  const strCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  const copy = rows.slice();
  copy.sort((a, b) => {
    for (const spec of sort) {
      const col = byId.get(spec.columnId);
      if (!col) continue;
      const av = col.accessor(a);
      const bv = col.accessor(b);
      let cmp = 0;
      if (col.numeric) {
        const an = typeof av === 'number' ? av : Number(av);
        const bn = typeof bv === 'number' ? bv : Number(bv);
        const aIsNaN = !Number.isFinite(an);
        const bIsNaN = !Number.isFinite(bn);
        if (aIsNaN && bIsNaN) cmp = 0;
        else if (aIsNaN) cmp = 1; // NaNs last
        else if (bIsNaN) cmp = -1;
        else cmp = an - bn;
      } else if (typeof av === 'number' && typeof bv === 'number') {
        cmp = av - bv;
      } else {
        cmp = strCollator.compare(String(av ?? ''), String(bv ?? ''));
      }
      if (cmp !== 0) return spec.dir === 'asc' ? cmp : -cmp;
    }
    return 0;
  });
  return copy;
}
