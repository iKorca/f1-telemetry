export interface SettingsConfig {
  udpPort: number;
  httpPort: number;
  tunnel: {
    enabled: boolean;
    subdomain: string;
  };
  recording: {
    autoRecord: boolean;
    captureFrames: boolean;
    frameInterval: number;
    maxSessions: number;
  };
  display: {
    speedUnit: 'kmh' | 'mph';
    showTrackMap: boolean;
    fontPreset: 'modern' | 'racing' | 'mono' | 'classic';
    uiScale: number; // 80-130, percentage
  };
  notifications: {
    enabled: boolean;
  };
}
