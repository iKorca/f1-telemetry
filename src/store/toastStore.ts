import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error' | 'warn';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  timeoutMs: number;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, opts?: { kind?: ToastKind; timeoutMs?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

/**
 * Central toast store. One global stack, capped at 5 concurrent entries so a
 * runaway error loop can't flood the viewport. Consumers get an imperative
 * `push(message)` from `useToast()`; the stack renders via `<ToastStack />`
 * mounted once at the App root.
 */
export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (message, opts = {}) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const toast: Toast = {
      id,
      kind: opts.kind ?? 'info',
      message,
      timeoutMs: opts.timeoutMs ?? 4500,
      createdAt: Date.now(),
    };
    set((s) => ({ toasts: [...s.toasts.slice(-4), toast] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));
