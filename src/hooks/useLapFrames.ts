import { useEffect, useState } from 'react';
import type { PracticeRun } from '@shared/types';
import { getLapFrames } from '@/lib/api';

/**
 * LRU cache for lap frames.
 *
 * Keyed by `${sessionId}:${sessionLapIdx}`. We cap entries at 20 so switching
 * reference / compare laps tens of times doesn't accumulate memory.
 *
 * `invalidateCache()` is exported so the split/merge code path can flush when
 * lap indices shift under us.
 */
const CACHE_CAP = 20;
const cache = new Map<string, any[]>();

function keyFor(sessionId: string, lapIdx: number): string {
  return `${sessionId}:${lapIdx}`;
}

function cacheGet(k: string): any[] | undefined {
  const v = cache.get(k);
  if (v) {
    // LRU refresh
    cache.delete(k);
    cache.set(k, v);
  }
  return v;
}

function cacheSet(k: string, v: any[]): void {
  cache.set(k, v);
  while (cache.size > CACHE_CAP) {
    // Delete the oldest (Map preserves insertion order)
    const firstKey = cache.keys().next().value as string | undefined;
    if (firstKey === undefined) break;
    cache.delete(firstKey);
  }
}

/** Drop all cached frames for a session (call after split/merge). */
export function invalidateSessionFrames(sessionId: string): void {
  for (const k of Array.from(cache.keys())) {
    if (k.startsWith(`${sessionId}:`)) cache.delete(k);
  }
}

/** Drop everything. */
export function invalidateAllFrames(): void {
  cache.clear();
}

export interface LapFramesResult {
  frames: any[];
  loading: boolean;
  error: string | null;
}

export function useLapFrames(
  run: PracticeRun | null,
  runLapArrayIdx: number | null,
): LapFramesResult {
  const [frames, setFrames] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!run || runLapArrayIdx == null || runLapArrayIdx < 0) {
      setFrames([]);
      return;
    }
    const sessionLapIdx = run.lapIndices?.[runLapArrayIdx];
    if (sessionLapIdx == null) {
      setFrames([]);
      return;
    }
    const k = keyFor(run.sessionId, sessionLapIdx);
    const cached = cacheGet(k);
    if (cached) {
      setFrames(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    getLapFrames(run.sessionId, sessionLapIdx)
      .then((res) => {
        if (cancelled) return;
        const fs = res.frames || [];
        cacheSet(k, fs);
        setFrames(fs);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setFrames([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [run?.sessionId, run?.id, runLapArrayIdx]);

  return { frames, loading, error };
}
