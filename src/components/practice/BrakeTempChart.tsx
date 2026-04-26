import React from 'react';
import type { PracticeRun } from '@shared/types';
import LapSeriesChart, { avgWheels } from '@/components/common/LapSeriesChart';
import { fmtTempTick, valTemp } from '@/lib/formatters';

function BrakeTempChart({ runs }: { runs: PracticeRun[] }) {
  return (
    <LapSeriesChart
      title="BRAKE TEMPERATURE"
      runs={runs}
      yLabel="Brake Temp (°C)"
      yDeltaLabel="Δ Brake Temp (°C)"
      syncKey="practice-laps"
      getY={(lap) => avgWheels(lap.avgBrakeTemp)}
      getWheelY={(lap) => lap.avgBrakeTemp}
      refValueOfLap={(lap) => avgWheels(lap.avgBrakeTemp)}
      axisTickFormatter={fmtTempTick}
      valueFormatter={valTemp}
    />
  );
}

export default React.memo(BrakeTempChart);
