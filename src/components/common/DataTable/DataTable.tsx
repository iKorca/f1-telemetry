import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import type { DataColumn, DataTableProps, SortDir } from './types';
import { useTableState, applySort } from './useTableState';
import styles from './DataTable.module.css';

// ────────────────────────────────────────────────────────────────────────────
//  Shared DataTable primitive.
//
//  Features:
//  - Click header → three-state sort (off → asc → desc → off)
//  - Shift-click → multi-column sort
//  - Drag a header to reorder columns (persisted)
//  - Right-click a header → "Hide column" context menu
//  - "⋯" trailing button opens a checklist of columns to show / hide
//  - Accordion rows via `renderExpanded`
//  - Row context menu passthrough
//  - LocalStorage persistence when `storageKey` is passed
//  - Sticky header, empty state, compact / normal sizing
//
//  Unopinionated about row shape: every call-site supplies its own
//  `DataColumn<Row>[]` registry.
// ────────────────────────────────────────────────────────────────────────────

export default function DataTable<Row>(props: DataTableProps<Row>) {
  const {
    columns,
    rows,
    getRowId,
    storageKey,
    initialSort,
    onRowClick,
    onRowSelect,
    onRowContextMenu,
    renderExpanded,
    rowClassName,
    emptyState,
    size = 'normal',
    stickyHeader = true,
    toolbar,
  } = props;

  const {
    visibleColumns,
    orderedColumns,
    hidden,
    sort,
    cycleSort,
    toggleHidden,
    moveColumn,
    resetAll,
  } = useTableState<Row>({ columns, storageKey, initialSort });

  const sortedRows = useMemo(
    () => applySort(rows, sort, columns),
    [rows, sort, columns],
  );

  // Expanded-row state (when `renderExpanded` is given)
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const toggleExpand = useCallback((id: string | number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Column drag state
  const dragSrcRef = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<{ id: string; side: 'before' | 'after' } | null>(null);

  // Column menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  // Header context menu (right-click to hide)
  const [headerCtx, setHeaderCtx] = useState<{ x: number; y: number; columnId: string } | null>(null);
  useEffect(() => {
    if (!headerCtx) return;
    const close = () => setHeaderCtx(null);
    document.addEventListener('click', close);
    document.addEventListener('contextmenu', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('contextmenu', close);
    };
  }, [headerCtx]);

  const gridTemplateColumns = visibleColumns
    .map((c) => c.width ?? 'minmax(60px, max-content)')
    .join(' ');

  return (
    <div className={`${styles.wrap} ${size === 'compact' ? styles.compact : ''}`}>
      {(toolbar || storageKey) && (
        <div className={styles.toolbar}>
          {toolbar}
          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title="Columns"
          >
            ⋯ COLUMNS
          </button>
          {menuOpen && (
            <div ref={menuRef} className={styles.menuPanel} role="menu">
              <div className={styles.menuHeader}>
                <span>COLUMNS</span>
                <button
                  type="button"
                  className={styles.menuReset}
                  onClick={() => { resetAll(); setMenuOpen(false); }}
                >
                  Reset
                </button>
              </div>
              {orderedColumns.map((c) => (
                <label key={c.id} className={styles.menuItem}>
                  <input
                    type="checkbox"
                    checked={!hidden.has(c.id)}
                    onChange={() => toggleHidden(c.id)}
                  />
                  <span>{c.header}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        className={styles.table}
        role="table"
        style={{ gridTemplateColumns }}
      >
        {/* ── Header row ──────────────────────────────────────────────── */}
        <div
          className={`${styles.headerRow} ${stickyHeader ? styles.sticky : ''}`}
          role="row"
        >
          {visibleColumns.map((col) => (
            <HeaderCell
              key={col.id}
              col={col}
              sortDir={dirFor(col.id, sort)}
              sortIndex={indexFor(col.id, sort)}
              sortTotal={sort.length}
              dragOver={dragOver}
              onSortClick={(e) => col.sortable !== false && cycleSort(col.id, e.shiftKey)}
              onDragStart={(e) => {
                dragSrcRef.current = col.id;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', col.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!dragSrcRef.current || dragSrcRef.current === col.id) return;
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const side: 'before' | 'after' = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
                setDragOver({ id: col.id, side });
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                const src = dragSrcRef.current;
                if (src && dragOver) moveColumn(src, dragOver.id, dragOver.side);
                dragSrcRef.current = null;
                setDragOver(null);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setHeaderCtx({ x: e.clientX, y: e.clientY, columnId: col.id });
              }}
            />
          ))}
        </div>

        {/* ── Body rows ───────────────────────────────────────────────── */}
        {sortedRows.length === 0 && emptyState ? (
          <div className={styles.emptyRow} style={{ gridColumn: `1 / span ${visibleColumns.length || 1}` }}>
            <div className={styles.emptyMsg}>{emptyState.message}</div>
            {emptyState.hint && <div className={styles.emptyHint}>{emptyState.hint}</div>}
          </div>
        ) : (
          sortedRows.map((row) => {
            const id = getRowId(row);
            const isExpanded = expanded.has(id);
            const rowClass = rowClassName?.(row) ?? '';
            return (
              <React.Fragment key={id}>
                <div
                  className={`${styles.row} ${rowClass} ${onRowClick || onRowSelect || renderExpanded ? styles.clickable : ''}`}
                  role="row"
                  tabIndex={onRowClick || onRowSelect || renderExpanded ? 0 : -1}
                  onClick={(e) => {
                    // Shift-click is reserved for multi-select compare flows.
                    // If a select handler is wired, hand off and DON'T also
                    // toggle expand — selecting and expanding at the same
                    // time is jarring.
                    if (e.shiftKey && onRowSelect) {
                      onRowSelect(row, e);
                      return;
                    }
                    if (onRowClick) onRowClick(row);
                    else if (renderExpanded) toggleExpand(id);
                  }}
                  onContextMenu={onRowContextMenu ? (e) => onRowContextMenu(row, e) : undefined}
                  onKeyDown={(e) => {
                    if (!onRowClick && !onRowSelect && !renderExpanded) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      // Shift+Enter mirrors shift-click for keyboard users.
                      if (e.shiftKey && onRowSelect) onRowSelect(row, e);
                      else if (onRowClick) onRowClick(row);
                      else toggleExpand(id);
                    }
                  }}
                >
                  {visibleColumns.map((col, colIdx) => {
                    const content = col.render ? col.render(row) : String(col.accessor(row) ?? '');
                    return (
                      <div
                        key={col.id}
                        className={`${styles.cell} ${col.align ? styles[`align_${col.align}`] : ''} ${col.numeric ? styles.numeric : ''}`}
                        role="cell"
                      >
                        {colIdx === 0 && renderExpanded && (
                          <button
                            type="button"
                            className={styles.expandBtn}
                            aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                            aria-expanded={isExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(id);
                            }}
                          >
                            {isExpanded ? '▼' : '▶'}
                          </button>
                        )}
                        {content}
                      </div>
                    );
                  })}
                </div>
                {isExpanded && renderExpanded && (
                  <div
                    className={styles.expandedRow}
                    style={{ gridColumn: `1 / span ${visibleColumns.length || 1}` }}
                  >
                    {renderExpanded(row)}
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
      </div>

      {headerCtx && (
        <div
          className={styles.headerCtx}
          style={{ left: headerCtx.x, top: headerCtx.y }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className={styles.ctxItem}
            onClick={() => {
              toggleHidden(headerCtx.columnId);
              setHeaderCtx(null);
            }}
          >
            Hide column
          </button>
          <button
            type="button"
            className={styles.ctxItem}
            onClick={() => {
              resetAll();
              setHeaderCtx(null);
            }}
          >
            Reset columns
          </button>
        </div>
      )}
    </div>
  );
}

interface HeaderCellProps<Row> {
  col: DataColumn<Row>;
  sortDir: SortDir | null;
  sortIndex: number;
  sortTotal: number;
  dragOver: { id: string; side: 'before' | 'after' } | null;
  onSortClick: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function HeaderCell<Row>({
  col,
  sortDir,
  sortIndex,
  sortTotal,
  dragOver,
  onSortClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onContextMenu,
}: HeaderCellProps<Row>) {
  const sortable = col.sortable !== false;
  return (
    <div
      role="columnheader"
      draggable
      aria-sort={sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : 'none'}
      className={[
        styles.headerCell,
        col.align ? styles[`align_${col.align}`] : '',
        col.numeric ? styles.numeric : '',
        sortable ? styles.headerSortable : '',
        dragOver?.id === col.id ? (dragOver.side === 'before' ? styles.dragTargetBefore : styles.dragTargetAfter) : '',
      ].filter(Boolean).join(' ')}
      title={col.title ?? (sortable ? `${col.header} — click to sort, shift-click for multi-sort` : col.header)}
      onClick={sortable ? onSortClick : undefined}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
    >
      <span className={styles.headerLabel}>{col.header}</span>
      {sortable && (
        <span className={styles.sortIndicator} aria-hidden="true">
          {sortDir === 'asc' ? '▲' : sortDir === 'desc' ? '▼' : '⇅'}
          {sortTotal > 1 && sortDir && <sup className={styles.sortIndex}>{sortIndex + 1}</sup>}
        </span>
      )}
    </div>
  );
}

function dirFor(columnId: string, sort: Array<{ columnId: string; dir: SortDir }>): SortDir | null {
  return sort.find((s) => s.columnId === columnId)?.dir ?? null;
}

function indexFor(columnId: string, sort: Array<{ columnId: string }>): number {
  return sort.findIndex((s) => s.columnId === columnId);
}
