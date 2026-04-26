import React from 'react';
import BigDeltaTile from './BigDeltaTile';
import FrontWingTile from './FrontWingTile';
import BigTyreWearTile from './BigTyreWearTile';
import CompoundDeltaTile from './CompoundDeltaTile';
import styles from './SecondaryDashboard.module.css';

/**
 * Alternate "glance" dashboard — big-format tiles designed to be legible
 * while driving. Layout is a 2×2 grid that reflows to 1×4 on narrow screens.
 * Each tile pulls straight from the telemetry / timing / session stores so
 * the screen stays in sync without any prop plumbing.
 */
function SecondaryDashboard() {
  return (
    <div className={styles.grid}>
      <div className={styles.tile}><BigDeltaTile /></div>
      <div className={styles.tile}><FrontWingTile /></div>
      <div className={styles.tile}><BigTyreWearTile /></div>
      <div className={styles.tile}><CompoundDeltaTile /></div>
    </div>
  );
}

export default React.memo(SecondaryDashboard);
