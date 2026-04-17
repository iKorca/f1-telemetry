import { useEffect, useRef } from 'react';
import { useTelemetryStore } from '../store/telemetryStore';
import { useSessionInfoStore } from '../store/sessionInfoStore';
import { useTimingStore } from '../store/timingStore';
import { useRaceStore } from '../store/raceStore';
import { useUIStore } from '../store/uiStore';
import { useHistoryStore } from '../store/historyStore';
import { usePracticeStore } from '../store/practiceStore';
import * as api from '../lib/api';
import type { WSMessage, CarSetupsData } from '@shared/types';

/**
 * WebSocket connection hook — side-effect only, called once in App.tsx.
 * Creates a WebSocket connection, parses incoming JSON messages,
 * and dispatches to the appropriate Zustand store actions.
 * Reconnects on close after 2 seconds.
 * Watchdog: every 1s checks if lastDataTs > 4s ago, sets status to 'waiting'.
 */
export function useWebSocket(): void {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carSetupsRef = useRef<CarSetupsData | null>(null);
  const prevRecordingRef = useRef<boolean>(false);

  useEffect(() => {
    function connect() {
      const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = import.meta.env.DEV ? `${wsProto}://${location.host}/ws` : `${wsProto}://${location.host}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        useUIStore.getState().setConnectionStatus('live');
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };

      ws.onclose = () => {
        useUIStore.getState().setConnectionStatus('off');
        reconnectTimerRef.current = setTimeout(connect, 2000);
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

        switch (type) {
          case 'telemetry':
            useTelemetryStore.getState().handleTelemetry(data);
            break;
          case 'lapData':
            useTimingStore.getState().handleLapData(data);
            break;
          case 'carStatus':
            useTimingStore.getState().handleCarStatus(data);
            break;
          case 'session':
            useSessionInfoStore.getState().handleSession(data);
            break;
          case 'participants':
            useTimingStore.getState().handleParticipants(data);
            break;
          case 'carSetups':
            carSetupsRef.current = data;
            useTimingStore.getState().handleCarSetups(data);
            break;
          case 'carDamage':
            useTimingStore.getState().handleCarDamage(data);
            break;
          case 'motion':
            useTelemetryStore.getState().handleMotion(data);
            // Accumulate track outline from player position
            if (data.playerData) {
              const px = data.playerData.worldPositionX;
              const pz = data.playerData.worldPositionZ;
              if (px !== 0 || pz !== 0) {
                const pts = useSessionInfoStore.getState().trackPoints;
                const last = pts.length > 0 ? pts[pts.length - 1] : null;
                if (!last || Math.hypot(px - last.x, pz - last.z) > 5) {
                  useSessionInfoStore.getState().addTrackPoint(px, pz);
                }
              }
            }
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
            // When recording just stopped, refresh the history session list
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
            // Live practice workbook update — refresh if we're viewing this track
            const practiceState = usePracticeStore.getState();
            if (practiceState.selectedTrack === data.trackName) {
              practiceState.setWorkbook(data);
            }
            // Also refresh the track list for run counts
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
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, []);
}
