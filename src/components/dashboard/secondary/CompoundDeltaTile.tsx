import React from 'react';
import { useSessionInfoStore } from '@/store/sessionInfoStore';
import { useTimingStore } from '@/store/timingStore';
import { getCompoundColor } from '@/lib/colors';
import { recommend, family, recColor, recIcon } from '@/lib/strategy';
import styles from './SecondaryDashboard.module.css';

/**
 * Weather / compound strategy advisor.
 *
 * Answers "am I on the right tyre right now, and when should I swap?" during
 * changing conditions. Reads the session weather forecast and recommends a
 * tyre family (DRY / INTER / WET) per upcoming slot, highlights the
 * recommended action when it differs from the current compound, and
 * colour-codes the current-condition row so the driver can read the decision
 * in one glance.
 *
 * Visual hierarchy (peripheral-vision priority):
 *   1. DRY/INTER/WET — the actionable read; biggest text in each forecast cell
 *   2. Rain % — supporting context; secondary size
 *   3. +Nm time offset — least urgent; smallest
 */
export default function CompoundDeltaTile() {
  const currentCompound = useTimingStore(
    (s) => s.allCarStatus?.playerData?.tyreCompoundName ?? '',
  );
  const weatherName = useSessionInfoStore((s) => s.weatherName);
  const forecast = useSessionInfoStore((s) => s.weatherForecast);

  const nowRain = forecast?.[0]?.rainPercentage ?? (/rain|storm|wet/i.test(weatherName) ? 40 : 0);
  const nowRec = recommend(nowRain, weatherName);
  const currentFamily = family(currentCompound);
  // Withhold the STAY/SWAP advice until we actually know what's bolted on.
  // Without this guard `family('') === 'DRY'` made the tile assert "ON —
  // STAY on DRY" before any car-status packet arrived.
  const mismatchNow = currentFamily != null && currentFamily !== nowRec;
  const compoundKnown = currentFamily != null;

  // Build a lookahead strip from weatherForecast (usually ~3–6 entries,
  // 5-min stride each). Includes slot 0 — the headline above duplicates the
  // current condition in compound-vs-recommendation form, while the strip
  // shows it in time-series form for visual continuity.
  const slots = (forecast ?? []).slice(0, 6).map((f, i) => {
    const rec = recommend(f.rainPercentage, f.weatherName);
    return {
      timeOffsetMin: f.timeOffset ?? i * 5,
      rain: f.rainPercentage,
      weather: f.weatherName || '—',
      rec,
      changeFromNow: rec !== nowRec,
    };
  });

  return (
    <>
      <div className={styles.tileHeader}>
        COMPOUND STRATEGY
        <span className={styles.tileSub}>
          NOW {nowRain}% · {weatherName || '—'}
        </span>
      </div>

      {/* Headline: now-vs-current. Kept compact so the forecast strip gets
          the lion's share of vertical space. The STAY/SWAP pill is hidden
          until we know what's bolted on — otherwise a missing car-status
          packet renders a phantom "STAY on DRY" before any real reading. */}
      <div
        className={`${styles.csHeadline} ${
          !compoundKnown
            ? styles.csHeadlineUnknown
            : mismatchNow
              ? styles.csHeadlineMismatch
              : styles.csHeadlineMatch
        }`}
      >
        <div className={styles.csHeadlineSide}>
          <div className={styles.csOnLabel}>ON</div>
          <div
            className={styles.csCompound}
            style={{ color: getCompoundColor(currentCompound) }}
          >
            {currentCompound || '—'}
          </div>
        </div>
        <div className={styles.csArrow}>→</div>
        <div className={styles.csHeadlineSide}>
          <div className={styles.csNowRec} style={{ color: recColor(nowRec) }}>
            <span className={styles.csRecIcon} aria-hidden="true">{recIcon(nowRec)}</span>
            {nowRec}
          </div>
          {compoundKnown && (
            <div
              className={`${styles.csAction} ${mismatchNow ? styles.csActionSwap : styles.csActionStay}`}
            >
              {mismatchNow ? 'SWAP' : 'STAY'}
            </div>
          )}
        </div>
      </div>

      {/* Forecast lookahead — DRY/INTER/WET dominant, rain% supporting,
          time-offset smallest. Sized for peripheral-vision reading. */}
      {slots.length > 0 && (
        <div className={styles.csForecastWrap}>
          <div className={styles.csForecastLabel}>FORECAST</div>
          <div
            className={styles.csForecastGrid}
            style={{ gridTemplateColumns: `repeat(${slots.length}, 1fr)` }}
          >
            {slots.map((s, i) => (
              <div
                key={i}
                className={`${styles.csForecastCell} ${s.changeFromNow ? styles.csForecastCellChange : ''}`}
              >
                <div className={styles.csForecastTime}>+{s.timeOffsetMin}m</div>
                {/* Icon ABOVE the word — in a 6-slot strip the cell isn't
                    wide enough for icon + 5-char word side-by-side. Stacking
                    keeps both readable, the icon supplies the
                    non-color-coded distinguisher (☀/☂/☔), and the word
                    stays the dominant peripheral read. */}
                <span className={styles.csForecastIcon} aria-hidden="true" style={{ color: recColor(s.rec) }}>
                  {recIcon(s.rec)}
                </span>
                <div className={styles.csForecastRec} style={{ color: recColor(s.rec) }}>
                  {s.rec}
                </div>
                <div className={styles.csForecastRain}>
                  {s.rain}<span className={styles.csForecastRainPct}>%</span>
                </div>
              </div>
            ))}
          </div>
          {slots.some((s) => s.changeFromNow) && (
            <div className={styles.csChangeWarning}>
              ⚠︎ TYRE CHANGE IN FORECAST
            </div>
          )}
        </div>
      )}
    </>
  );
}
