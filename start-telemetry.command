#!/bin/bash
#
# Double-clickable launcher for the F1 telemetry dashboard on macOS.
#
# Finder runs a .command file in Terminal, so this can be started without a
# terminal session or any editor tooling — just double-click it. It installs
# dependencies on first run, rebuilds the UI when sources have changed, prints
# the URLs (including the LAN one, for viewing on a phone or tablet), opens a
# browser and then runs the server in the foreground so Ctrl-C stops it.
#
# Everything is relative to this file's own directory, so the project folder can
# be moved or renamed freely.

set -euo pipefail

cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"
HTTP_PORT="${PORT:-3000}"

printf '\n\033[1m F1 Telemetry Dashboard \033[0m\n'
printf ' %s\n\n' "$PROJECT_DIR"

# ── Locate node ───────────────────────────────────────────────────────────────
# A GUI-launched shell doesn't always inherit the PATH from a login shell, so
# fall back to the usual install locations (Homebrew on both architectures, the
# official installer, and the active nvm version) before giving up.
if ! command -v node >/dev/null 2>&1; then
  for candidate in \
    /opt/homebrew/bin /usr/local/bin \
    "$HOME/.nvm/versions/node"/*/bin \
    /usr/bin
  do
    if [ -x "$candidate/node" ]; then
      export PATH="$candidate:$PATH"
      break
    fi
  done
fi

if ! command -v node >/dev/null 2>&1; then
  printf ' \033[31mNode.js was not found.\033[0m\n'
  printf ' Install it from https://nodejs.org (LTS), then run this again.\n\n'
  read -r -p ' Press Return to close…' _
  exit 1
fi

printf ' node %s\n' "$(node -v)"

# ── Is the port already taken? ────────────────────────────────────────────────
# Usually means a copy is already running; point at it instead of failing with a
# raw EADDRINUSE stack trace.
if lsof -nP -iTCP:"$HTTP_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  printf '\n \033[33mPort %s is already in use — the dashboard may already be running.\033[0m\n' "$HTTP_PORT"
  printf ' Opening http://localhost:%s\n\n' "$HTTP_PORT"
  open "http://localhost:$HTTP_PORT"
  read -r -p ' Press Return to close…' _
  exit 0
fi

# ── Dependencies ──────────────────────────────────────────────────────────────
if [ ! -d node_modules ]; then
  printf '\n Installing dependencies (first run only)…\n'
  npm install
fi

# ── Build ─────────────────────────────────────────────────────────────────────
# dist/ is gitignored, so a fresh checkout has no build at all. Otherwise only
# rebuild when something under src/ or shared/ is newer than the built bundle —
# a clean start then costs about a second instead of a full rebuild every time.
needs_build=0
if [ ! -f dist/index.html ]; then
  needs_build=1
elif [ -n "$(find src shared index.html vite.config.ts -newer dist/index.html 2>/dev/null | head -n 1)" ]; then
  needs_build=1
fi

if [ "$needs_build" -eq 1 ]; then
  printf '\n Building the dashboard…\n'
  npm run --silent build >/dev/null || npx vite build
  printf ' Build complete.\n'
else
  printf ' Build is up to date.\n'
fi

# ── Go ────────────────────────────────────────────────────────────────────────
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"

printf '\n \033[32mStarting…\033[0m\n'
printf '   Local    http://localhost:%s\n' "$HTTP_PORT"
[ -n "$LAN_IP" ] && printf '   Network  http://%s:%s\n' "$LAN_IP" "$HTTP_PORT"
printf '   UDP      port 20777  (set this as the telemetry target in-game)\n'
printf '\n In F1 25: Settings -> Telemetry Settings -> UDP Telemetry: On,\n'
printf ' IP Address %s, Port 20777.\n' "${LAN_IP:-<the IP of this Mac>}"
printf '\n Press Ctrl-C to stop.\n\n'

# Give the server a moment to bind before the browser hits it.
( sleep 2; open "http://localhost:$HTTP_PORT" ) &

exec node server.js
