import type React from 'react';

export type SortDir = 'asc' | 'desc';

export interface SortSpec {
  columnId: string;
  dir: SortDir;
}

export interface DataColumn<Row> {
  /** Stable key, used for persistence and React keys. */
  id: string;
  /** Column label (ALL CAPS convention matches existing tables). */
  header: string;
  /** Raw value extractor for sorting + fallback display. */
  accessor: (row: Row) => unknown;
  /** Custom cell JSX (default: accessor as text). */
  render?: (row: Row) => React.ReactNode;
  /** Default true; set false to disable sorting on a column. */
  sortable?: boolean;
  /** Right-aligns the cell and forces numeric compare. */
  numeric?: boolean;
  /** Column hidden by default (user can re-enable via the menu). */
  defaultHidden?: boolean;
  /** CSS grid / `<col>` width, e.g. '80px' | '1fr'. Falls back to content. */
  width?: string;
  /** Cell alignment. */
  align?: 'left' | 'right' | 'center';
  /** Tooltip shown on the header cell. */
  title?: string;
}

export interface TablePersistedState {
  /** Ordered list of column ids. Columns not present fall to the end. */
  order?: string[];
  /** Column ids currently hidden. */
  hidden?: string[];
  /** Active multi-sort (single-entry in the common case). */
  sort?: SortSpec[];
}

export interface DataTableProps<Row> {
  columns: DataColumn<Row>[];
  rows: Row[];
  /** Stable key per row (used for React key + memo). */
  getRowId: (row: Row) => string | number;
  /** LocalStorage namespace for column order / visibility / sort. */
  storageKey?: string;
  /** Initial sort if nothing is persisted. */
  initialSort?: SortSpec;
  onRowClick?: (row: Row) => void;
  onRowContextMenu?: (row: Row, e: React.MouseEvent) => void;
  /** Accordion content rendered as a full-width row below the parent. */
  renderExpanded?: (row: Row) => React.ReactNode;
  /** Custom classes per row (player / fastest / invalid / …). */
  rowClassName?: (row: Row) => string | undefined;
  emptyState?: { message: string; hint?: string };
  /** Compact rows for dense tables (default: normal). */
  size?: 'compact' | 'normal';
  stickyHeader?: boolean;
  /** Optional group of dashboard-style "action" buttons shown left of the column menu. */
  toolbar?: React.ReactNode;
}
