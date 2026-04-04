import React, { useEffect, useState } from 'react';
import { getNetworkInfo } from '@/lib/api';
import type { NetworkInfo } from '@shared/types';
import styles from './ConnectionCard.module.css';

interface Props {
  udpPort: number;
  httpPort: number;
  speedUnit: string;
  onUdpPort: (v: number) => void;
  onHttpPort: (v: number) => void;
  onSpeedUnit: (v: string) => void;
}

function ConnectionCard({ udpPort, httpPort, speedUnit, onUdpPort, onHttpPort, onSpeedUnit }: Props) {
  const [ips, setIps] = useState<string[]>([]);
  const [netHttpPort, setNetHttpPort] = useState<number>(3000);

  useEffect(() => {
    getNetworkInfo()
      .then((data: NetworkInfo) => {
        setNetHttpPort(data.httpPort);
        const ipList = (data as any).ips || data.localIPs || [];
        setIps(ipList.map((i: { address: string }) => `http://${i.address}:${data.httpPort}`));
      })
      .catch((err) => console.error('loadNetworkInfo error:', err));
  }, []);

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Connection</div>

      <div className={styles.row}>
        <label className={styles.label}>UDP Port</label>
        <div className={styles.control}>
          <input
            type="number"
            className={styles.input}
            value={udpPort}
            min={1024}
            max={65535}
            onChange={(e) => onUdpPort(parseInt(e.target.value, 10) || 20777)}
          />
          <span className={styles.note}>restart required</span>
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>HTTP Port</label>
        <div className={styles.control}>
          <input
            type="number"
            className={styles.input}
            value={httpPort}
            min={1024}
            max={65535}
            onChange={(e) => onHttpPort(parseInt(e.target.value, 10) || 3000)}
          />
          <span className={styles.note}>restart required</span>
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>Speed Unit</label>
        <div className={styles.control}>
          <select
            className={styles.select}
            value={speedUnit}
            onChange={(e) => onSpeedUnit(e.target.value)}
          >
            <option value="kmh">km/h</option>
            <option value="mph">mph</option>
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>Local IPs</label>
        <div className={styles.ips}>
          {ips.length > 0 ? ips.map((ip) => <div key={ip}>{ip}</div>) : 'loading...'}
        </div>
      </div>
    </div>
  );
}

export default ConnectionCard;
