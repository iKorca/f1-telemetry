import React from 'react';
import type { SessionSummary } from '@shared/types';
import { fmtTime, fmtDate } from '@/lib/formatters';
import styles from './SessionItem.module.css';

interface SessionItemProps {
  session: SessionSummary;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: (id: string) => void;
  onToggleCheck: (id: string) => void;
}

function SessionItem({
  session,
  isSelected,
  isChecked,
  onSelect,
  onToggleCheck,
}: SessionItemProps) {
  const bestStr = session.bestLapMs ? fmtTime(session.bestLapMs) : '\u2014';
  const raceIcon = session.hasRaceData ? ' \uD83C\uDFC1' : '';

  const itemClass = [styles.item, isSelected ? styles.active : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={itemClass} onClick={() => onSelect(session.id)}>
      <div className={styles.row}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={isChecked}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleCheck(session.id)}
        />
        <div className={styles.content}>
          <div className={styles.track}>
            {session.track}
            {raceIcon}
          </div>
          <div className={styles.type}>{session.sessionType}</div>
          <div className={styles.date}>{fmtDate(session.startTime)}</div>
          <div className={styles.stats}>
            {session.lapCount} laps &nbsp;|&nbsp; Best: {bestStr}
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(SessionItem);
