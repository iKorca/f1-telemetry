export interface NetworkInfo {
  localIPs: Array<{ name: string; address: string }>;
  udpPort: number;
  httpPort: number;
  tunnelUrl: string | null;
  tunnelActive: boolean;
}

export interface TunnelStatus {
  url: string | null;
  active: boolean;
}

export interface TrackOutline {
  points: Array<{ x: number; z: number }>;
}
