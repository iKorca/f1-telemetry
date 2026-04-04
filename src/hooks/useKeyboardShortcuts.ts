import { useEffect } from 'react';
import { useUIStore, type TabId } from '../store/uiStore';

/**
 * Global keyboard shortcut handler — side-effect only, called once in App.tsx.
 * Ignores events when focus is on INPUT, SELECT, or TEXTAREA elements.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const ui = useUIStore.getState();

      switch (e.key) {
        case '1':
          ui.switchTab('dashboard');
          break;
        case '2':
          ui.switchTab('timing');
          break;
        case '3':
          ui.switchTab('race');
          break;
        case '4':
          ui.switchTab('session');
          break;
        case '5':
          ui.switchTab('history');
          break;
        case '6':
          ui.switchTab('settings');
          break;
        case 'r':
        case 'R':
          toggleRecording();
          break;
        case 'f':
        case 'F':
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen();
          }
          break;
        case '?':
          ui.toggleShortcutsOverlay();
          break;
        case 'Escape':
          if (ui.showShortcutsOverlay) {
            ui.toggleShortcutsOverlay();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, []);
}

async function toggleRecording(): Promise<void> {
  const { isRecording } = useUIStore.getState();
  if (isRecording) {
    await fetch('/api/recordings/stop', { method: 'POST' });
  } else {
    await fetch('/api/recordings/start', { method: 'POST' });
  }
}

/** Tab ID lookup from numeric key */
const TAB_MAP: Record<string, TabId> = {
  '1': 'dashboard',
  '2': 'timing',
  '3': 'race',
  '4': 'session',
  '5': 'history',
  '6': 'settings',
};
