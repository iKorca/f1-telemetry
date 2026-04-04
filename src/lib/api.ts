import type {
  SettingsConfig,
  SessionSummary,
  SessionDetail,
  NetworkInfo,
  TunnelStatus,
  TrackOutline,
  RecordedLap,
  CarSetup,
  TelemetryFrame,
} from '@shared/types';

const BASE = '/api';

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

async function fetchVoid(url: string, init?: RequestInit): Promise<void> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${res.status}: ${text}`);
  }
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function getSettings(): Promise<SettingsConfig> {
  return fetchJSON<SettingsConfig>(`${BASE}/settings`);
}

export function saveSettings(settings: Partial<SettingsConfig>): Promise<SettingsConfig> {
  return fetchJSON<SettingsConfig>(`${BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

// ─── Sessions / Recordings ───────────────────────────────────────────────────

export function getSessions(): Promise<SessionSummary[]> {
  return fetchJSON<SessionSummary[]>(`${BASE}/recordings`);
}

export function getSession(id: string): Promise<SessionDetail> {
  return fetchJSON<SessionDetail>(`${BASE}/recordings/${id}`);
}

export function getCurrentSession(): Promise<SessionDetail | null> {
  return fetchJSON<SessionDetail | null>(`${BASE}/recordings/current`);
}

export interface LapFramesResponse {
  lap: RecordedLap;
  frames: TelemetryFrame[];
  setup: CarSetup | null;
}

export function getLapFrames(
  sessionId: string,
  lapIdx: number,
): Promise<LapFramesResponse> {
  return fetchJSON<LapFramesResponse>(
    `${BASE}/recordings/${sessionId}/lap/${lapIdx}`,
  );
}

export function updateLap(
  sessionId: string,
  lapIdx: number,
  changes: Partial<RecordedLap>,
): Promise<void> {
  return fetchVoid(`${BASE}/recordings/${sessionId}/lap/${lapIdx}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  });
}

export function deleteLap(sessionId: string, lapIdx: number): Promise<void> {
  return fetchVoid(`${BASE}/recordings/${sessionId}/lap/${lapIdx}`, {
    method: 'DELETE',
  });
}

export function deleteSession(id: string): Promise<void> {
  return fetchVoid(`${BASE}/recordings/${id}`, {
    method: 'DELETE',
  });
}

export function batchDeleteSessions(
  ids: string[],
): Promise<{ deleted: number }> {
  return fetchJSON<{ deleted: number }>(`${BASE}/recordings/batch-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
}

// ─── Recording Control ───────────────────────────────────────────────────────

export function startRecording(): Promise<{ id: string }> {
  return fetchJSON<{ id: string }>(`${BASE}/recordings/start`, {
    method: 'POST',
  });
}

export function stopRecording(): Promise<{ id: string }> {
  return fetchJSON<{ id: string }>(`${BASE}/recordings/stop`, {
    method: 'POST',
  });
}

// ─── Network ─────────────────────────────────────────────────────────────────

export function getNetworkInfo(): Promise<NetworkInfo> {
  return fetchJSON<NetworkInfo>(`${BASE}/network`);
}

// ─── Track Outlines ──────────────────────────────────────────────────────────

export function getTrackOutline(trackId: number): Promise<TrackOutline> {
  return fetchJSON<TrackOutline>(`${BASE}/tracks/${trackId}`);
}

export function saveTrackOutline(
  trackId: number,
  points: Array<{ x: number; z: number }>,
): Promise<void> {
  return fetchVoid(`${BASE}/tracks/${trackId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
  });
}

// ─── Tunnel ──────────────────────────────────────────────────────────────────

export function getTunnelStatus(): Promise<TunnelStatus> {
  return fetchJSON<TunnelStatus>(`${BASE}/tunnel`);
}

export function startTunnel(subdomain?: string): Promise<TunnelStatus> {
  return fetchJSON<TunnelStatus>(`${BASE}/tunnel/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subdomain }),
  });
}

export function stopTunnel(): Promise<void> {
  return fetchVoid(`${BASE}/tunnel/stop`, {
    method: 'POST',
  });
}
