import React, { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import * as api from '@/lib/api';
import styles from './TunnelCard.module.css';

interface Props {
  subdomain: string;
  onSubdomain: (v: string) => void;
}

function TunnelCard({ subdomain, onSubdomain }: Props) {
  const tunnelUrl = useUIStore((s) => s.tunnelUrl);
  const tunnelActive = useUIStore((s) => s.tunnelActive);
  const handleTunnel = useUIStore((s) => s.handleTunnel);

  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (tunnelActive) {
        await api.stopTunnel();
        handleTunnel({ active: false, url: null });
      } else {
        const data = await api.startTunnel(subdomain.trim() || undefined);
        handleTunnel(data);
      }
    } catch (err) {
      console.error('tunnel toggle error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Remote Access (Internet Tunnel)</div>

      <div className={styles.row}>
        <label className={styles.label}>Subdomain (optional)</label>
        <div className={styles.control}>
          <input
            type="text"
            className={styles.input}
            placeholder="my-f1-dash"
            value={subdomain}
            onChange={(e) => onSubdomain(e.target.value)}
          />
          <span className={styles.note}>.loca.lt</span>
        </div>
      </div>

      <div className={styles.row}>
        <label className={styles.label}>Tunnel</label>
        <div className={styles.control}>
          <button
            className={styles.btnSecondary}
            disabled={loading}
            onClick={handleToggle}
          >
            {loading ? 'Starting\u2026' : tunnelActive ? 'Stop Tunnel' : 'Start Tunnel'}
          </button>
          {tunnelActive && tunnelUrl && (
            <span className={styles.tunnelUrl}>
              <a href={tunnelUrl} target="_blank" rel="noreferrer">{tunnelUrl}</a>
            </span>
          )}
        </div>
      </div>

      <div className={styles.row}>
        <div />
        <div className={styles.noteWide}>
          The tunnel makes your dashboard accessible from anywhere on the internet via a public URL.
          Uses <a href="https://localtunnel.me" target="_blank" rel="noreferrer">localtunnel.me</a> &mdash; no account required.
        </div>
      </div>
    </div>
  );
}

export default TunnelCard;
