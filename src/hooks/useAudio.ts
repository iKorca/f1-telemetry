import { useEffect, useRef } from 'react';
import { useUIStore } from '../store/uiStore';

export type NotificationType =
  | 'flag'
  | 'safetyCar'
  | 'pitWindow'
  | 'recStart'
  | 'disconnect'
  | 'lapComplete'
  | 'fastest';

/**
 * Audio notification hook.
 * Creates an AudioContext on first user interaction (click or keydown).
 * Returns a playNotification function that plays different tones per type.
 */
export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const activate = () => {
      if (!ctxRef.current) {
        // Safari < 14 shipped AudioContext under `webkitAudioContext`.
        // It's not part of the stock `Window` typings, so declare a narrow
        // shape instead of using `any`.
        type AudioCtor = typeof AudioContext;
        const w = window as unknown as {
          AudioContext?: AudioCtor;
          webkitAudioContext?: AudioCtor;
        };
        const Ctor = w.AudioContext ?? w.webkitAudioContext;
        if (Ctor) ctxRef.current = new Ctor();
      }
      document.removeEventListener('click', activate);
      document.removeEventListener('keydown', activate);
    };
    document.addEventListener('click', activate);
    document.addEventListener('keydown', activate);

    return () => {
      document.removeEventListener('click', activate);
      document.removeEventListener('keydown', activate);
    };
  }, []);

  const playNotification = (type: NotificationType): void => {
    const enabled = useUIStore.getState().notificationsEnabled;
    if (!enabled || !ctxRef.current) return;

    const ctx = ctxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    switch (type) {
      case 'flag':
        osc.frequency.setValueAtTime(880, now);
        osc.type = 'square';
        break;
      case 'safetyCar':
        osc.frequency.setValueAtTime(660, now);
        osc.type = 'sawtooth';
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        break;
      case 'pitWindow':
        osc.frequency.setValueAtTime(520, now);
        osc.type = 'sine';
        break;
      case 'recStart':
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(660, now + 0.1);
        osc.type = 'sine';
        break;
      case 'disconnect':
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.setValueAtTime(220, now + 0.1);
        osc.type = 'sine';
        break;
      case 'lapComplete':
        osc.frequency.setValueAtTime(523, now);
        osc.frequency.setValueAtTime(659, now + 0.1);
        osc.type = 'sine';
        break;
      case 'fastest':
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1047, now + 0.1);
        osc.type = 'sine';
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        break;
      default:
        osc.frequency.setValueAtTime(440, now);
        osc.type = 'sine';
    }

    osc.start(now);
    osc.stop(now + 0.3);
  };

  return { playNotification };
}
