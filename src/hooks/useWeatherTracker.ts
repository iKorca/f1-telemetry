import { useEffect } from 'react';
import { useTimingStore } from '@/store/timingStore';
import { useSessionInfoStore } from '@/store/sessionInfoStore';
import { useRaceStore } from '@/store/raceStore';

/**
 * Drives the race-tab WeatherImpact panel.
 *
 * The store action `trackWeatherForLap` is self-deduping (it ignores
 * calls where `currentLap <= lastWeatherLap`), so the cheapest correct
 * wiring is to fire it whenever `currentLap` advances. We snapshot the
 * temps + weather + lastLapMs at the moment the lap rolls over and
 * append a single history entry for the *just-completed* lap.
 *
 * Mounted at app root because the race-engineer history needs to
 * accumulate while the user is on Dashboard/Timing/etc., not only when
 * they're staring at the race tab — otherwise opening the tab mid-race
 * would show an empty panel.
 */
export function useWeatherTracker(): void {
  const currentLap = useTimingStore((s) => s.currentLap);
  const lastLapMs = useTimingStore((s) => s.lastLapMs);

  useEffect(() => {
    if (!currentLap || currentLap < 2 || !lastLapMs) return;
    // Snapshot stores by `getState()` so the effect doesn't re-fire when
    // weather values shift mid-lap. Only the lap-roll boundary matters.
    const sess = useSessionInfoStore.getState();
    useRaceStore.getState().trackWeatherForLap(
      currentLap,
      lastLapMs,
      sess.trackTemperature,
      sess.airTemperature,
      sess.weatherName,
    );
  }, [currentLap, lastLapMs]);
}
