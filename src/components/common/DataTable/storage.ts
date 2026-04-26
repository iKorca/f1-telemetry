import type { TablePersistedState } from './types';

const PREFIX = 'f1-table:';

/** Read persisted column order / visibility / sort for a table. */
export function loadTableState(storageKey: string): TablePersistedState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PREFIX + storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Persist updated state (merges onto any existing entry). */
export function saveTableState(storageKey: string, patch: Partial<TablePersistedState>): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadTableState(storageKey);
    const next = { ...current, ...patch };
    window.localStorage.setItem(PREFIX + storageKey, JSON.stringify(next));
  } catch {
    // Ignore quota / privacy-mode errors — the table will still work, just
    // without persistence.
  }
}
