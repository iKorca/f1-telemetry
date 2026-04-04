import React from 'react';
import styles from './RightPanel.module.css';
import TrackMap from './TrackMap';
import CompoundBadge from './CompoundBadge';
import TyreGrid from './TyreGrid';
import BrakeTemps from './BrakeTemps';
import EngineStats from './EngineStats';
import WingDamage from './WingDamage';

function RightPanel() {
  return (
    <div className={styles.panel}>
      <TrackMap />
      <div className="divider" />
      <CompoundBadge />
      <TyreGrid />
      <div className="divider" />
      <BrakeTemps />
      <div className="divider" />
      <EngineStats />
      <div className="divider" />
      <WingDamage />
    </div>
  );
}

export default React.memo(RightPanel);
