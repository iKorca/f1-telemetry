import React from 'react';
import type { PracticeRun } from '@shared/types';
import LapSeriesChart from '@/components/common/LapSeriesChart';
import { fmtFuelTick, valFuel } from '@/lib/formatters';

function FuelChart({ runs }: { runs: PracticeRun[] }) {
  return (
    <LapSeriesChart
      title="FUEL CONSUMPTION"
      runs={runs}
      yLabel="Fuel (kg/lap)"
      yDeltaLabel="Δ Fuel (kg/lap)"
      syncKey="practice-laps"
      floorZero
      getY={(lap) => (lap.fuel > 0 ? lap.fuel : null)}
      refValueOfLap={(lap) => (lap.fuel > 0 ? lap.fuel : null)}
      axisTickFormatter={fmtFuelTick}
      valueFormatter={valFuel}
    />
  );
}

export default React.memo(FuelChart);
