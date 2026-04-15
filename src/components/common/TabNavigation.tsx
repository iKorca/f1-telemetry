import { useUIStore, type TabId } from '../../store/uiStore';
import { useSessionInfoStore } from '../../store/sessionInfoStore';
import styles from './TabNavigation.module.css';

const TABS: { id: TabId; label: string; raceOnly?: boolean }[] = [
  { id: 'dashboard', label: 'DASHBOARD' },
  { id: 'timing', label: 'TIMING' },
  { id: 'race', label: 'RACE', raceOnly: true },
  { id: 'session', label: 'SESSION' },
  { id: 'practice', label: 'PRACTICE' },
  { id: 'history', label: 'HISTORY' },
  { id: 'settings', label: 'SETTINGS' },
];

export default function TabNavigation() {
  const activeTab = useUIStore((s) => s.activeTab);
  const switchTab = useUIStore((s) => s.switchTab);
  const sessionType = useSessionInfoStore((s) => s.sessionTypeName);

  const isRaceSession = /race|sprint/i.test(sessionType || '');

  return (
    <nav className={styles.tabs}>
      {TABS.filter((tab) => !tab.raceOnly || isRaceSession).map((tab) => (
        <button
          key={tab.id}
          className={`${styles.tabBtn} ${activeTab === tab.id ? styles.active : ''}`}
          onClick={() => switchTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
