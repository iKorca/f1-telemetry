'use strict';

const fs   = require('fs');
const path = require('path');

const DEFAULTS = {
  udpPort:  20777,
  httpPort: 3000,
  tunnel: {
    enabled:   false,
    subdomain: '',
  },
  recording: {
    autoRecord:    true,
    captureFrames: true,
    frameInterval: 3,
    maxSessions:   50,
  },
  display: {
    speedUnit: 'kmh', // 'kmh' | 'mph'
    showTrackMap: true,
  },
  notifications: {
    enabled: false,
  },
};

class Settings {
  constructor(dataDir) {
    this._file = path.join(dataDir, 'settings.json');
    this._data = JSON.parse(JSON.stringify(DEFAULTS));
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this._file)) {
        const raw = fs.readFileSync(this._file, 'utf8');
        const parsed = JSON.parse(raw);
        this._data = this._deepMerge(JSON.parse(JSON.stringify(DEFAULTS)), parsed);
      }
    } catch (err) {
      console.warn('[Settings] Failed to load, using defaults:', err.message);
    }
  }

  _deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    const result = Object.assign({}, target);
    for (const key of Object.keys(source)) {
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        typeof result[key] === 'object' &&
        result[key] !== null &&
        !Array.isArray(result[key])
      ) {
        result[key] = this._deepMerge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  get() {
    return JSON.parse(JSON.stringify(this._data));
  }

  update(partial) {
    this._data = this._deepMerge(this._data, partial);
    this.save();
    return this.get();
  }

  save() {
    try {
      fs.writeFileSync(this._file, JSON.stringify(this._data, null, 2), 'utf8');
    } catch (err) {
      console.error('[Settings] Failed to save:', err.message);
    }
  }
}

module.exports = Settings;
