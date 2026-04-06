// Build React app then start Express server
const { execSync } = require('child_process');
const path = require('path');

console.log('[Build] Building React app...');
try {
  execSync(process.execPath + ' node_modules/.bin/vite build', {
    cwd: __dirname,
    stdio: 'inherit',
  });
} catch (err) {
  console.error('[Build] Failed:', err.message);
  process.exit(1);
}

console.log('[Build] Done. Starting server...');
require('./server.js');
