import React from 'react';
import styles from './CenterPanel.module.css';
import RevLights from './RevLights';
import SpeedGear from './SpeedGear';
import RPMBar from './RPMBar';
import GForce from './GForce';
import InputBars from './InputBars';

function CenterPanel() {
  return (
    <div className={styles.mainPanel}>
      <RevLights />
      <SpeedGear />
      <RPMBar />
      <GForce />
      <InputBars />
    </div>
  );
}

export default React.memo(CenterPanel);
