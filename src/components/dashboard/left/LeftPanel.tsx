import React from 'react';
import styles from './LeftPanel.module.css';
import LapTimes from './LapTimes';
import DeltaBar from './DeltaBar';
import Sectors from './Sectors';
import Stats from './Stats';
import PitWindow from './PitWindow';
import FuelStrategy from './FuelStrategy';
import CarSetup from './CarSetup';

function LeftPanel() {
  return (
    <div className={styles.panel}>
      <LapTimes />
      <div className="divider" />
      <DeltaBar />
      <div className="divider" />
      <Sectors />
      <div className="divider" />
      <Stats />
      <PitWindow />
      <FuelStrategy />
      <CarSetup />
    </div>
  );
}

export default React.memo(LeftPanel);
