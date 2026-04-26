import React from 'react';
import type { PracticeRun } from '@shared/types';
import LapSeriesChart, { avgWheels } from '@/components/common/LapSeriesChart';

function TyrePressureChart({ runs }: { runs: PracticeRun[] }) {
  return (
    <LapSeriesChart
      title="TYRE PRESSURE"
      runs={runs}
      yLabel="Pressure (psi)"
      yDeltaLabel="Δ Pressure (psi)"
      syncKey="practice-laps"
      getY={(lap) => avgWheels(lap.avgPressure)}
      getWheelY={(lap) => lap.avgPressure}
      refValueOfLap={(lap) => avgWheels(lap.avgPressure)}
      valueFormatter={(_u, v) => (v == null ? '\u2014' : `${v.toFixed(2)} psi`)}
    />
  );
}

export default React.memo(TyrePressureChart);
