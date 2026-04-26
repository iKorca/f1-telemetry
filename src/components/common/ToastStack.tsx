import React, { useEffect } from 'react';
import { useToastStore, type Toast } from '@/store/toastStore';
import styles from './ToastStack.module.css';

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    if (toast.timeoutMs <= 0) return;
    const id = window.setTimeout(() => dismiss(toast.id), toast.timeoutMs);
    return () => window.clearTimeout(id);
  }, [toast.id, toast.timeoutMs, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`${styles.toast} ${styles[`toast_${toast.kind}`]}`}
    >
      <span className={styles.message}>{toast.message}</span>
      <button
        type="button"
        aria-label="Dismiss notification"
        className={styles.close}
        onClick={() => dismiss(toast.id)}
      >
        ×
      </button>
    </div>
  );
}

export default function ToastStack() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className={styles.stack} aria-label="Notifications" role="region">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}
