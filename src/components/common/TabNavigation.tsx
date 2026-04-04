import { useUIStore, type TabId } from '../../store/uiStore';
import styles from './TabNavigation.module.css';

const TABS: { id: TabId; label: string }[] = [
  { id: 'dashboard', label: 'DASHBOARD' },
  { id: 'timing', label: 'TIMING' },
  { id: 'race', label: 'RACE' },
  { id: 'session', label: 'SESSION' },
  { id: 'history', label: 'HISTORY' },
  { id: 'settings', label: 'SETTINGS' },
];

export default function TabNavigation() {
  const activeTab = useUIStore((s) => s.activeTab);
  const switchTab = useUIStore((s) => s.switchTab);

  return (
    <nav className={styles.tabs}>
      {TABS.map((tab) => (
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
