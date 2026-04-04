import React from 'react';
import SessionList from './sidebar/SessionList';
import BatchToolbar from './sidebar/BatchToolbar';
import SessionDetail from './detail/SessionDetail';
import styles from './HistoryTab.module.css';

function HistoryTab() {
  return (
    <div className={styles.layout}>
      <div className={styles.sidebar}>
        <BatchToolbar />
        <SessionList />
      </div>
      <div className={styles.main}>
        <SessionDetail />
      </div>
    </div>
  );
}

export default React.memo(HistoryTab);
