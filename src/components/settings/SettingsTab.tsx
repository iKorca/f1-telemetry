import React, { useState, useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useSettingsStore, FONT_PRESETS } from '@/store/settingsStore';
import * as api from '@/lib/api';
import ConnectionCard from './ConnectionCard';
import RecordingCard from './RecordingCard';
import DisplayCard from './DisplayCard';
import AnalysisCard from './AnalysisCard';
import TunnelCard from './TunnelCard';
import styles from './SettingsTab.module.css';

const shortcutsList = [
  { key: '1', label: 'Dashboard' },
  { key: '2', label: 'Timing' },
  { key: '3', label: 'Race' },
  { key: '4', label: 'History' },
  { key: '5', label: 'Settings' },
  { key: 'R', label: 'Toggle Recording' },
  { key: 'F', label: 'Fullscreen' },
  { key: '?', label: 'Show Shortcuts' },
];

function SettingsTab() {
  const activeTab = useUIStore((s) => s.activeTab);
  const setNotificationsEnabled = useUIStore((s) => s.setNotificationsEnabled);
  const handleTunnel = useUIStore((s) => s.handleTunnel);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const updateSpeedUnit = useSettingsStore((s) => s.updateSpeedUnit);

  // Local form state
  const [udpPort, setUdpPort] = useState(20777);
  const [httpPort, setHttpPort] = useState(3000);
  const [speedUnit, setSpeedUnit] = useState('kmh');
  const [autoRecord, setAutoRecord] = useState(true);
  const [captureFrames, setCaptureFrames] = useState(true);
  const [frameInterval, setFrameInterval] = useState(3);
  const [maxSessions, setMaxSessions] = useState(50);
  const [showTrackMap, setShowTrackMap] = useState(true);
  const [notifications, setNotifications] = useState(false);
  const [fontPreset, setFontPreset] = useState('modern');
  const [uiScale, setUIScale] = useState(100);
  const [subdomain, setSubdomain] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  const loadedRef = useRef(false);

  // Load settings on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const load = async () => {
      try {
        const cfg = await api.getSettings();
        applySettings(cfg);

        const tData = await api.getTunnelStatus();
        handleTunnel(tData);
      } catch (err) {
        console.error('loadSettings error:', err);
      }
    };

    load();
  }, []);

  function applySettings(cfg: any) {
    setUdpPort(cfg.udpPort ?? 20777);
    setHttpPort(cfg.httpPort ?? 3000);
    setSpeedUnit(cfg.display?.speedUnit || 'kmh');
    setAutoRecord(cfg.recording?.autoRecord ?? true);
    setCaptureFrames(cfg.recording?.captureFrames ?? true);
    setFrameInterval(cfg.recording?.frameInterval ?? 3);
    setMaxSessions(cfg.recording?.maxSessions ?? 50);
    setShowTrackMap(cfg.display?.showTrackMap !== false);
    setFontPreset(cfg.display?.fontPreset || 'modern');
    setUIScale(cfg.display?.uiScale || 100);
    setNotifications(cfg.notifications?.enabled ?? false);
    setSubdomain(cfg.tunnel?.subdomain || '');
  }

  const handleSave = async () => {
    const cfg = {
      udpPort,
      httpPort,
      tunnel: {
        enabled: false,
        subdomain,
      },
      recording: {
        autoRecord,
        captureFrames,
        frameInterval,
        maxSessions,
      },
      display: {
        speedUnit: speedUnit as 'kmh' | 'mph',
        showTrackMap,
        fontPreset: fontPreset as any,
        uiScale,
      },
      notifications: {
        enabled: notifications,
      },
    };

    try {
      await api.saveSettings(cfg);

      // Sync stores
      setSettings(cfg);
      updateSpeedUnit(cfg.display.speedUnit);
      setNotificationsEnabled(cfg.notifications.enabled);

      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('saveSettings error:', err);
      setSaveStatus('Error saving');
      setTimeout(() => setSaveStatus(''), 2000);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.layout}>
        <ConnectionCard
          udpPort={udpPort}
          httpPort={httpPort}
          speedUnit={speedUnit}
          onUdpPort={setUdpPort}
          onHttpPort={setHttpPort}
          onSpeedUnit={setSpeedUnit}
        />

        <RecordingCard
          autoRecord={autoRecord}
          captureFrames={captureFrames}
          frameInterval={frameInterval}
          maxSessions={maxSessions}
          onAutoRecord={setAutoRecord}
          onCaptureFrames={setCaptureFrames}
          onFrameInterval={setFrameInterval}
          onMaxSessions={setMaxSessions}
        />

        <AnalysisCard />

        <DisplayCard
          showTrackMap={showTrackMap}
          notifications={notifications}
          fontPreset={fontPreset}
          uiScale={uiScale}
          onShowTrackMap={setShowTrackMap}
          onNotifications={setNotifications}
          onFontPreset={(v) => {
            setFontPreset(v);
            useSettingsStore.getState().setFontPreset(v as any);
          }}
          onUIScale={(v) => {
            setUIScale(v);
            useSettingsStore.getState().setUIScale(v);
          }}
        />

        <TunnelCard
          subdomain={subdomain}
          onSubdomain={setSubdomain}
        />

        <div className={`${styles.saveRow} ${styles.fullWidth}`}>
          <button className={styles.btnPrimary} onClick={handleSave}>
            Save Settings
          </button>
          <span className={styles.saveStatus}>{saveStatus}</span>
        </div>

        <div className={`${styles.shortcutsCard} ${styles.fullWidth}`}>
          <div className={styles.cardTitle}>Keyboard Shortcuts</div>
          <div className={styles.shortcutList}>
            {shortcutsList.map((s) => (
              <div key={s.key} className={styles.shortcutItem}>
                <kbd className={styles.kbd}>{s.key}</kbd> {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsTab;
