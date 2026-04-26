import { useCallback } from 'react';
import { useToastStore, type ToastKind } from '@/store/toastStore';

export function useToast() {
  const push = useToastStore((s) => s.push);
  return useCallback(
    (message: string, kind: ToastKind = 'info', timeoutMs?: number) =>
      push(message, { kind, timeoutMs }),
    [push],
  );
}
