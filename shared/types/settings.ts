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
  };
  notifications: {
    enabled: boolean;
  };
}
