import React from 'react';
import styles from './StintBadge.module.css';

const COMPOUND_COLORS: Record<string, string> = {
  SOFT: '#ff3333',
  MEDIUM: '#ffcc00',
  HARD: '#ffffff',
  INTER: '#33cc33',
  WET: '#3399ff',
  UNKNOWN: '#888888',
};

interface Stint {
  compound: string;
  startLap: number;
  endLap: number;
}

interface StintBadgeProps {
  stints: Stint[];
  currentCompound: string;
  currentLap: number;
}

const StintBadge = React.memo(function StintBadge({
  stints,
  currentCompound,
  currentLap,
}: StintBadgeProps) {
  const compColor = COMPOUND_COLORS[currentCompound] || '#888';
  const totalLaps = currentLap || 1;

  if (stints.length === 0 && currentCompound) {
    return (
      <div className={styles.stintBar}>
        <div
          className={styles.stintSeg}
          style={{ width: '100%', background: compColor }}
        />
      </div>
    );
  }

  if (stints.length === 0) return null;

  const lastEnd = stints[stints.length - 1].endLap + 1;
  const currWidth = Math.max(5, ((currentLap - lastEnd + 1) / totalLaps) * 100);

  return (
    <div className={styles.stintBar}>
      {stints.map((stint, i) => {
        const width = Math.max(
          5,
          ((stint.endLap - stint.startLap + 1) / totalLaps) * 100,
        );
        const color = COMPOUND_COLORS[stint.compound] || '#888';
        return (
          <div
            key={i}
            className={styles.stintSeg}
            style={{ width: `${width}%`, background: color }}
            title={`${stint.compound} L${stint.startLap}-${stint.endLap}`}
          />
        );
      })}
      <div
        className={styles.stintSeg}
        style={{ width: `${currWidth}%`, background: compColor }}
        title={`${currentCompound} L${lastEnd}-now`}
      />
    </div>
  );
});

export default StintBadge;
