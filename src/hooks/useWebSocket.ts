import { useEffect, useRef } from 'react';
import { useTelemetryStore } from '../store/telemetryStore';
import { useSessionInfoStore } from '../store/sessionInfoStore';
import { useTimingStore } from '../store/timingStore';
import { useRaceStore } from '../store/raceStore';
import { useUIStore } from '../store/uiStore';
import { useHistoryStore } from '../store/historyStore';
import { usePracticeStore } from '../store/practiceStore';
import * as api from '../lib/api';
import type { WSMessage } from '@shared/types';

/**
 * WebSocket hook.
 *
 * Call once at App root.
 *
 * Design notes:
 *
 * - **rAF batching for high-frequency streams**: telemetry, motion, lapData,
 *   carStatus, and carDamage stream at ~30–60 Hz. Instead of dispatching every
 *   message (which triggers a store `set` + full React render per packet), we
 *   keep a latest-wins queue and flush once per animation frame. UI still feels
 *   instant (16-ms cadence) but we cut re-renders by 2-4×.
 *
 * - **Unbatched events**: session, participants, carSetups, sessionHistory,
 *   raceEngineer, recStatus, tunnel, practiceUpdate — these arrive at ~1 Hz
 *   or slower, and each carries state that downstream UI relies on
 *   immediately; no batching benefit.
 *
 * - **Reconnect**: exponential backoff 1 s → 2 s → 4 s → 8 s → capped 30 s.
 *   Resets on successful open.
 *
 * - **Heartbeat**: app-level ping every 15 s so dead connections surface
 *   before the 2-minute TCP keepalive.
 */
export function useWebSocket(): void {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRecordingRef = useRef<boolean>(false);

  // Latest-wins queue for high-frequency message types
  const pendingRef = useRef<{
    telemetry?: unknown;
    motion?: unknown;
    lapData?: unknown;
    carStatus?: unknown;
    carDamage?: unknown;
  }>({});
  const rafHandleRef = useRef<number | null>(null);

  useEffect(() => {
    function flushPending() {
      rafHandleRef.current = null;
      const pending = pendingRef.current;
      pendingRef.current = {};

      if (pending.telemetry !== undefined) {
        useTelemetryStore.getState().handleTelemetry(pending.telemetry as any);
      }
      if (pending.motion !== undefined) {
        const data: any = pending.motion;
        useTelemetryStore.getState().handleMotion(data);
        // Accumulate track outline from player position (every rAF is fine;
        // the store dedupes by >5 m distance)
        if (data?.playerData) {
          const px = data.playerData.worldPositionX;
          const pz = data.playerData.worldPositionZ;
          if (px !== 0 || pz !== 0) {
            const si = useSessionInfoStore.getState();
            const pts = si.trackPoints;
            const last = pts.length > 0 ? pts[pts.length - 1] : null;
            if (!last || Math.hypot(px - last.x, pz - last.z) > 5) {
              si.addTrackPoint(px, pz);
            }
          }
        }
      }
      if (pending.lapData !== undefined) {
        useTimingStore.getState().handleLapData(pending.lapData as any);
      }
      if (pending.carStatus !== undefined) {
        useTimingStore.getState().handleCarStatus(pending.carStatus as any);
      }
      if (pending.carDamage !== undefined) {
        useTimingStore.getState().handleCarDamage(pending.carDamage as any);
      }
    }

    function scheduleFlush() {
      if (rafHandleRef.current != null) return;
      rafHandleRef.current = requestAnimationFrame(flushPending);
    }

    function connect() {
      const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = import.meta.env.DEV ? `${wsProto}://${location.host}/ws` : `${wsProto}://${location.host}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        useUIStore.getState().setConnectionStatus('live');
        reconnectAttemptsRef.current = 0;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        // Heartbeat: server ignores unknown payloads; purpose is to keep
        // the socket warm and surface dead connections promptly.
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ type: 'ping', t: Date.now() })); }
            catch { /* ignore */ }
          }
        }, 15000);
      };

      ws.onclose = () => {
        useUIStore.getState().setConnectionStatus('off');
        if (heartbeatTimerRef.current) {
          clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = null;
        }
        // Exponential backoff: 1 → 2 → 4 → 8 → 16 → 30s cap
        const attempt = reconnectAttemptsRef.current++;
        const delayMs = Math.min(30000, 1000 * Math.pow(2, attempt));
        reconnectTimerRef.current = setTimeout(connect, delayMs);
      };

      ws.onmessage = (evt: MessageEvent) => {
        useUIStore.getState().setLastDataTs(Date.now());
        useUIStore.getState().setConnectionStatus('live');

        let msg: WSMessage;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }

        const { type, data } = msg;

        // ── High-frequency: coalesce onto rAF ─────────────────────────────
        switch (type) {
          case 'telemetry':
            pendingRef.current.telemetry = data;
            scheduleFlush();
            return;
          case 'motion':
            pendingRef.current.motion = data;
            scheduleFlush();
            return;
          case 'lapData':
            pendingRef.current.lapData = data;
            scheduleFlush();
            return;
          case 'carStatus':
            pendingRef.current.carStatus = data;
            scheduleFlush();
            return;
          case 'carDamage':
            pendingRef.current.carDamage = data;
            scheduleFlush();
            return;
        }

        // ── Low-frequency: dispatch immediately ──────────────────────────
        switch (type) {
          case 'session':
            useSessionInfoStore.getState().handleSession(data);
            break;
          case 'participants':
            useTimingStore.getState().handleParticipants(data);
            break;
          case 'carSetups':
            useTimingStore.getState().handleCarSetups(data);
            break;
          case 'sessionHistory':
            useTimingStore.getState().handleSessionHistory(data);
            break;
          case 'raceEngineer':
            useRaceStore.getState().handleRaceEngineer(data);
            break;
          case 'recStatus': {
            const wasRecording = prevRecordingRef.current;
            prevRecordingRef.current = data.isRecording;
            useUIStore.getState().handleRecStatus(data);
            if (wasRecording && !data.isRecording) {
              api.getSessions().then((list) => {
                useHistoryStore.getState().setSessions(list);
              }).catch(() => { });
            }
            break;
          }
          case 'tunnel':
            useUIStore.getState().handleTunnel(data);
            break;
          case 'practiceUpdate': {
            const practiceState = usePracticeStore.getState();
            if (practiceState.selectedTrack === data.trackName) {
              practiceState.setWorkbook(data);
            }
            const trackSummary = { trackName: data.trackName, runCount: data.runs?.length || 0, lastUpdated: data.lastUpdated || Date.now() };
            const currentTracks = practiceState.tracks;
            const tIdx = currentTracks.findIndex(t => t.trackName === data.trackName);
            if (tIdx >= 0) {
              const updated = [...currentTracks];
              updated[tIdx] = trackSummary;
              practiceState.setTracks(updated);
            } else {
              practiceState.setTracks([...currentTracks, trackSummary]);
            }
            break;
          }
        }
      };

      ws.onerror = () => ws.close();
    }

    connect();

    // Watchdog: every 1s check if lastDataTs > 4s ago
    const watchdog = setInterval(() => {
      const { lastDataTs, connectionStatus } = useUIStore.getState();
      if (lastDataTs > 0 && Date.now() - lastDataTs > 4000 && connectionStatus !== 'off') {
        useUIStore.getState().setConnectionStatus('waiting');
      }
    }, 1000);

    return () => {
      clearInterval(watchdog);
      if (rafHandleRef.current != null) cancelAnimationFrame(rafHandleRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, []);
}
