import { useWebSocket } from './hooks/useWebSocket';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useUIStore } from './store/uiStore';
import Header from './components/common/Header';
import WeatherStrip from './components/common/WeatherStrip';
import TabNavigation from './components/common/TabNavigation';
import DashboardTab from './components/dashboard/DashboardTab';
import TimingTab from './components/timing/TimingTab';
import RaceTab from './components/race/RaceTab';
import SessionTab from './components/session/SessionTab';
import HistoryTab from './components/history/HistoryTab';
import SettingsTab from './components/settings/SettingsTab';
import ShortcutsOverlay from './components/settings/ShortcutsOverlay';

const PlaceholderTab = ({ label }: { label: string }) => (
  <div style={{
    display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center',
    color: 'var(--grey)', fontFamily: 'var(--font-d)', fontSize: '1.2rem', letterSpacing: '0.2em',
  }}>
    {label}
  </div>
);

function App() {
  useWebSocket();
  useKeyboardShortcuts();

  const activeTab = useUIStore((s) => s.activeTab);

  return (
    <>
      <Header />
      <WeatherStrip />
      <TabNavigation />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none', height: '100%' }}>
          <DashboardTab />
        </div>
        <div style={{ display: activeTab === 'timing' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
          <TimingTab />
        </div>
        <div style={{ display: activeTab === 'race' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
          <RaceTab />
        </div>
        <div style={{ display: activeTab === 'session' ? 'flex' : 'none', height: '100%', flexDirection: 'column' }}>
          <SessionTab />
        </div>
        <div style={{ display: activeTab === 'history' ? 'flex' : 'none', height: '100%', flexDirection: 'column' as const }}>
          <HistoryTab />
        </div>
        <div style={{ display: activeTab === 'settings' ? 'block' : 'none', height: '100%' }}>
          <SettingsTab />
        </div>
      </div>
      <ShortcutsOverlay />
    </>
  );
}

export default App;
