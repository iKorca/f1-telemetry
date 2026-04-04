import React from 'react';
import styles from './DashboardTab.module.css';
import LeftPanel from './left/LeftPanel';
import CenterPanel from './center/CenterPanel';
import RightPanel from './right/RightPanel';
import RelativeBar from './RelativeBar';

/**
 * Main dashboard tab container.
 * 3-column CSS grid: LeftPanel (260px) | CenterPanel (1fr) | RightPanel (260px)
 * Below the grid: RelativeBar showing nearby cars.
 */
function DashboardTab() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.dashboardGrid}>
        <LeftPanel />
        <CenterPanel />
        <RightPanel />
      </div>
      <RelativeBar />
    </div>
  );
}

export default React.memo(DashboardTab);
