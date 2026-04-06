import React from 'react';
import type { CarSetup } from '@shared/types';
import SetupGrid from '@/components/shared/SetupGrid';
import styles from './SetupDisplay.module.css';

interface SetupDisplayProps {
  setup: CarSetup | null;
  lapSetups?: Record<number, CarSetup>;
}

function SetupDisplay({ setup, lapSetups }: SetupDisplayProps) {
  return (
    <SetupGrid
      setup={setup}
      columns={3}
      lapSetups={lapSetups}
      className={styles.wrapper}
    />
  );
}

export default React.memo(SetupDisplay);
