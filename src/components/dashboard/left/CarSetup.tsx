import React from 'react';
import { useTimingStore } from '@/store/timingStore';
import SetupGrid from '@/components/shared/SetupGrid';

function CarSetup() {
  const carSetupData = useTimingStore((s) => s.carSetupData);
  return <SetupGrid setup={carSetupData} columns={2} />;
}

export default React.memo(CarSetup);
