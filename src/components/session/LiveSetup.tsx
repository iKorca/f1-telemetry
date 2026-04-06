import React from 'react';
import type { CarSetup } from '@shared/types';
import SetupGrid from '@/components/shared/SetupGrid';
import styles from './LiveSetup.module.css';

interface LiveSetupProps {
  setup: CarSetup | null;
}

function LiveSetup({ setup }: LiveSetupProps) {
  return <SetupGrid setup={setup} columns={3} className={styles.wrapper} />;
}

export default React.memo(LiveSetup);
