import { useMemo, useState } from 'react';
import type { PracticeRun } from '@shared/types';
import { getTrackByName } from '@/lib/trackDatabase';
import { useSettingsStore } from '@/store/settingsStore';
import styles from './PracticeTab.module.css';

interface RaceFuelCalculatorProps {
  runs: PracticeRun[];
  trackName: string;
}

/** F1 25 regulation max fuel load at start of a race (FIA 2024+): 110 kg. */
const MAX_RACE_FUEL_KG = 110;

export default function RaceFuelCalculator({ runs, trackName }: RaceFuelCalculatorProps) {
  const defaultStart = useSettingsStore((s) => s.defaultStartingFuelKg);
  const marginPct = useSettingsStore((s) => s.fuelSafetyMarginPct);
  // User-editable starting fuel — default from settings. Lets the driver
  // model a conservative start load and see the resulting save target.
  const [startingFuelKg, setStartingFuelKg] = useState<number>(defaultStart);

  const calc = useMemo(() => {
    const track = getTrackByName(trackName);
    if (!track) return null;
    if (runs.length === 0) return null;

    const runsWithFuel = runs.filter((r) => r.avgFuelPerLap > 0);
    if (runsWithFuel.length === 0) return null;

    // Weighted average by valid lap count for better accuracy
    let totalFuel = 0;
    let totalLaps = 0;
    for (const r of runsWithFuel) {
      const lapsWithFuel = (r.laps || []).filter((l) => l.fuel > 0);
      for (const l of lapsWithFuel) {
        totalFuel += l.fuel;
        totalLaps++;
      }
    }

    const avgFuelPerLap = totalLaps > 0 ? totalFuel / totalLaps : 0;
    if (avgFuelPerLap <= 0) return null;

    const raceFuel = avgFuelPerLap * track.raceLaps;
    const raceFuelMargin = raceFuel * (1 + marginPct / 100);
    const raceDistance = (track.raceLaps * track.circuitLength).toFixed(1);

    // Fuel-save target: given the user's chosen starting fuel load, how
    // much fuel per lap do they actually have to burn (averaged over the
    // whole race) to finish with an empty tank? If negative, it means the
    // tank can't hold enough — they'd have to push harder the other way
    // (unlikely in F1 25 with a 110 kg cap + ~50 lap race), so we surface
    // it as a shortfall warning.
    const allowedPerLap = startingFuelKg / track.raceLaps;
    const saveDeltaPerLap = avgFuelPerLap - allowedPerLap; // positive → save this much
    const totalSaveKg = saveDeltaPerLap * track.raceLaps;

    return {
      track,
      avgFuelPerLap,
      raceFuel,
      raceFuelMargin,
      raceDistance,
      totalLaps,
      runCount: runsWithFuel.length,
      allowedPerLap,
      saveDeltaPerLap,
      totalSaveKg,
    };
  }, [runs, trackName, startingFuelKg, marginPct]);

  if (!calc) return null;

  const saveLabel = calc.saveDeltaPerLap > 0.01 ? 'Save' : calc.saveDeltaPerLap < -0.01 ? 'Spare' : 'On target';
  const saveColor =
    calc.saveDeltaPerLap > 0.15 ? 'var(--red)' :
    calc.saveDeltaPerLap > 0.01 ? 'var(--orange)' :
    calc.saveDeltaPerLap < -0.01 ? 'var(--green)' : 'var(--white)';
  const saveValue = `${Math.abs(calc.saveDeltaPerLap).toFixed(3)} kg/lap`;

  return (
    <div>
      <div className={styles.sectionTitle}>RACE FUEL CALCULATOR</div>
      <div className={styles.fuelCalcPanel}>
        <div className={styles.fuelCalcHeader}>
          {calc.track.name} &middot; {calc.track.raceLaps} laps &middot; {calc.raceDistance} km
        </div>

        <div className={styles.fuelCalcRow}>
          <span>Avg Fuel/Lap</span>
          <span className={styles.fuelCalcValue}>{calc.avgFuelPerLap.toFixed(2)} kg</span>
        </div>
        <div className={styles.fuelCalcRow}>
          <span>Race Fuel ({calc.track.raceLaps} laps)</span>
          <span className={styles.fuelCalcValue}>{calc.raceFuel.toFixed(1)} kg</span>
        </div>
        <div className={styles.fuelCalcRow}>
          <span>+{marginPct.toFixed(0)}% Safety Margin</span>
          <span className={styles.fuelCalcHighlight}>{calc.raceFuelMargin.toFixed(1)} kg</span>
        </div>

        {/* ── Fuel-save target row ─────────────────────────────────── */}
        <div className={styles.fuelCalcRow} style={{ marginTop: '0.4rem', borderTop: '1px dashed var(--border)', paddingTop: '0.4rem' }}>
          <span>
            Starting Fuel
            <input
              type="number"
              min={50}
              max={MAX_RACE_FUEL_KG}
              step={0.5}
              value={startingFuelKg}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) setStartingFuelKg(Math.min(MAX_RACE_FUEL_KG, v));
              }}
              style={{
                width: '60px',
                marginLeft: '0.4rem',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                color: 'var(--white)',
                fontFamily: 'var(--font-d)',
                fontSize: '0.58rem',
                padding: '0.1rem 0.25rem',
                textAlign: 'right',
              }}
            />
            <span style={{ marginLeft: '0.2rem', color: 'var(--grey)' }}>kg</span>
          </span>
          <span className={styles.fuelCalcValue}>{calc.allowedPerLap.toFixed(3)} kg/lap</span>
        </div>
        <div className={styles.fuelCalcRow} title="Required fuel save to finish the race on the chosen starting fuel load">
          <span>{saveLabel} per lap</span>
          <span className={styles.fuelCalcValue} style={{ color: saveColor }}>
            {calc.saveDeltaPerLap > 0.01 ? '\u2212' : calc.saveDeltaPerLap < -0.01 ? '+' : ''}
            {saveValue}
          </span>
        </div>
        {Math.abs(calc.totalSaveKg) > 0.1 && (
          <div className={styles.fuelCalcRow}>
            <span>Total {calc.saveDeltaPerLap > 0 ? 'shortfall' : 'headroom'}</span>
            <span className={styles.fuelCalcValue} style={{ color: saveColor }}>
              {Math.abs(calc.totalSaveKg).toFixed(2)} kg
            </span>
          </div>
        )}

        <div className={styles.fuelCalcFooter}>
          Based on {calc.totalLaps} laps across {calc.runCount} run{calc.runCount !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
