import React from 'react';
import BigDeltaTile from './BigDeltaTile';
import FrontWingTile from './FrontWingTile';
import BigTyreWearTile from './BigTyreWearTile';
import CompoundDeltaTile from './CompoundDeltaTile';
import RivalsTile from './RivalsTile';
import RelativeBar from '../RelativeBar';
import styles from './SecondaryDashboard.module.css';

/**
 * Alternate "glance" dashboard — big-format tiles designed to be legible
 * while driving. Three-column layout on desktop:
 *
 *   ┌──────────────┬──────────────┬──────────────┐
 *   │ DELTA TO PB  │ WING DAMAGE  │              │
 *   ├──────────────┼──────────────┤   RIVALS     │
 *   │ TYRE WEAR    │ COMPOUND     │              │
 *   └──────────────┴──────────────┴──────────────┘
 *
 * The third column spans full height (one tile, two stacked rivals: the
 * driver one position ahead and the driver one position behind). Reflows
 * to a single column on narrow screens.
 */
function SecondaryDashboard() {
  return (
    <div className={styles.grid}>
      <div className={`${styles.tile} ${styles.gridDelta}`}><BigDeltaTile /></div>
      <div className={`${styles.tile} ${styles.gridWing}`}><FrontWingTile /></div>
      <div className={`${styles.tile} ${styles.gridTyre}`}><BigTyreWearTile /></div>
      <div className={`${styles.tile} ${styles.gridCompound}`}><CompoundDeltaTile /></div>
      <div className={`${styles.tile} ${styles.gridRivals}`}><RivalsTile /></div>
      <div className={styles.gridRelative}><RelativeBar /></div>
    </div>
  );
}

export default React.memo(SecondaryDashboard);
