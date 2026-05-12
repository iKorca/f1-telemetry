import React, { useState, useEffect } from 'react';
import styles from './DashboardTab.module.css';
import LeftPanel from './left/LeftPanel';
import CenterPanel from './center/CenterPanel';
import RightPanel from './right/RightPanel';
import RelativeBar from './RelativeBar';
import SecondaryDashboard from './secondary/SecondaryDashboard';
import TyreTempAlert from './TyreTempAlert';
import { useUIStore } from '@/store/uiStore';

type Screen = 0 | 1;

/**
 * Main dashboard tab. Two screens:
 *   0 — "Glance" big-format tiles (delta, wing, tyre wear, compound,
 *       rivals). Default — this is what the user wants in front of them
 *       while driving.
 *   1 — 3-column "Live" dashboard (LeftPanel | CenterPanel | RightPanel)
 *       with the detailed telemetry stack.
 *
 * Swipe / arrow-key / click-dot navigation. The active screen lives in local
 * state; keyboard `[` / `]` cycle between them when the Dashboard tab is
 * active (so the binding doesn't fight with the practice-tab shortcuts).
 */
function DashboardTab() {
  const [screen, setScreen] = useState<Screen>(0);
  const activeTab = useUIStore((s) => s.activeTab);

  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target?.tagName)) return;
      if (e.key === '[' || e.key === 'ArrowLeft') setScreen(0);
      else if (e.key === ']' || e.key === 'ArrowRight') setScreen(1);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeTab]);

  return (
    <div className={styles.wrapper}>
      {screen === 0 ? (
        <SecondaryDashboard />
      ) : (
        <>
          <div className={styles.dashboardGrid}>
            <LeftPanel />
            <CenterPanel />
            <RightPanel />
          </div>
          <RelativeBar />
        </>
      )}
      <TyreTempAlert />
      <DashboardScreenNav screen={screen} onChange={setScreen} />
    </div>
  );
}

function DashboardScreenNav({ screen, onChange }: { screen: Screen; onChange: (s: Screen) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Dashboard screen"
      style={{
        position: 'absolute',
        right: '1rem',
        top: '0.6rem',
        display: 'flex',
        gap: 4,
        alignItems: 'center',
        zIndex: 20,
        background: 'rgba(10, 10, 20, 0.85)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '3px 8px',
      }}
    >
      <button
        type="button"
        aria-label="Previous dashboard screen"
        onClick={() => onChange(0)}
        disabled={screen === 0}
        style={navBtn(screen === 0)}
      >
        ‹
      </button>
      <ScreenDot active={screen === 0} label="Glance" onClick={() => onChange(0)} />
      <ScreenDot active={screen === 1} label="Live" onClick={() => onChange(1)} />
      <button
        type="button"
        aria-label="Next dashboard screen"
        onClick={() => onChange(1)}
        disabled={screen === 1}
        style={navBtn(screen === 1)}
      >
        ›
      </button>
    </div>
  );
}

function ScreenDot({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={`Show ${label} screen`}
      onClick={onClick}
      title={label}
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: active ? 'var(--white)' : 'rgba(255,255,255,0.25)',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    />
  );
}

function navBtn(disabled: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    border: 'none',
    color: disabled ? 'rgba(255,255,255,0.25)' : 'var(--white)',
    fontSize: '1rem',
    lineHeight: 1,
    cursor: disabled ? 'default' : 'pointer',
    padding: '0 4px',
  };
}

export default React.memo(DashboardTab);
