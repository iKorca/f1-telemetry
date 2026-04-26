# F1 25 Telemetry Dashboard

Real-time telemetry, race-engineer overlays, and post-session analysis for
**F1 25** (the official EA Sports / Codemasters game). Reads the game's
UDP packet stream, surfaces it through a Node + WebSocket backend, and
renders a React dashboard tuned for sim-racing readability.

```
┌─────────────────┐  UDP ╾─────╼  WebSocket ╾─────╼  ┌──────────────────┐
│  F1 25 (game)   │ ────────────────────────────────▶ │  React dashboard │
│  port 20777     │   Express + ws + parser/recorder  │  Vite + Zustand  │
└─────────────────┘                                   └──────────────────┘
```

## What it shows you

The app has seven tabs, each owning a different slice of the data.

### Dashboard
Two swipable screens (`[` / `]` to flip):

1. **Live screen** — speed, gear, RPM, throttle/brake/ERS bars, track map,
   tyre + brake temps, sectors, fuel strategy, pit window, car setup.
2. **Glance screen** — big-format tiles for peripheral-vision reading
   while driving:
   - **Delta to PB** — distance-based interpolation against the
     stored PB lap trace (matches F1 25's own delta).
   - **Wing damage** — live FL/FR/Rear percentages.
   - **Tyre wear** — 2×2 grid with corner-coded numbers.
   - **Compound strategy** — current compound vs. recommended family
     (DRY / INTER / WET) with rain-percentage forecast strip.
   - **Rivals** — full-height third column showing the driver one
     position ahead and one behind (gap, last-lap, ERS charge + mode,
     max tyre wear, front-wing damage).

### Timing
Live timing tower with sector best highlights, gap-to-leader / gap-ahead
columns, tyre compound, pit-stop count. Drag-and-reorder columns,
session-aware sort (lap-time order in P/Q, position order in race).

### Race
Race-engineer view with fuel projection, pit-window predictor, weather
impact panel, tyre wear vs. position table.

### Session
Live lap table for the in-progress session.

### Practice (the lab)
Multi-stint practice / time-trial analysis. Lap charts, fuel-vs-pace,
ERS deployment, tyre temp + wear, brake temps, lap-by-lap consistency,
delta telemetry between two laps, pit-stop fuel calculator, friction
circle, stint comparison. Splits and merges runs without losing
aggregates (engine temp, tyre temp, wear all preserved).

### History
Session library — every recording is stored as JSON under
`data/recordings/`. Browse by date / track, drill into a session for
lap analysis, driver comparison, qualifying leaderboards, telemetry
chart overlays.

### Settings
UDP port, HTTP port, recording capture options, audio cues, keyboard
shortcuts.

## Race-event toasts

When a meaningful event fires in-game (lights out, fastest lap, penalty,
overtake involving you, safety car, red flag, collision, retirement), a
toast appears in the corner. Player-specific events (your penalty, your
overtake, your fastest lap) are highlighted; other-driver noise is
filtered out so a 50-lap race doesn't drown the strip.

## Getting started

### 1. Configure F1 25 to broadcast UDP

In the game: **Settings → Telemetry Settings**

| Setting           | Value          |
| ----------------- | -------------- |
| UDP Telemetry     | On             |
| UDP Broadcast     | Off            |
| UDP IP Address    | `127.0.0.1`    |
| UDP Port          | `20777`        |
| UDP Send Rate     | `60Hz`         |
| UDP Format        | `2025`         |
| Show Player       | On             |

### 2. Install + run

```bash
npm install
npm run dev          # dev server (Vite frontend + Node backend, hot reload)
# or
npm start            # production: build then serve
```

The dashboard opens at `http://localhost:5173/` (dev) or
`http://localhost:3000/` (production). Frontend talks to the backend over
`ws://localhost:3000/ws`.

### 3. Drive

The "○ REC" indicator turns red when packets are flowing. Recordings save
automatically to `data/recordings/` when a session ends with a chequered
flag (or you stop manually from Settings).

## Project layout

```
f1-telemetry/
├── server.js               Express + WS + UDP listener (entry point)
├── server/
│   └── analysis.js         Pure aggregation helpers (run rollup,
│                           traffic-lap detection, trace fitting)
├── f1-parser.js            UDP packet → JSON parser (one function
│                           per F1 25 packet type)
├── recorder.js             Session recorder (writes JSON to data/)
├── shared/types/           Type definitions shared by client + server
├── src/                    React frontend (Vite + TypeScript)
│   ├── App.tsx             Tab shell + global hooks (useWebSocket,
│   │                       useWeatherTracker, useKeyboardShortcuts)
│   ├── components/
│   │   ├── dashboard/      Live + glance dashboards
│   │   ├── timing/         Timing tower
│   │   ├── race/           Race engineer overlays
│   │   ├── session/        Live session view
│   │   ├── practice/       Practice Lab (charts + analysis)
│   │   ├── history/        Recording browser + analysis
│   │   ├── settings/       Config panels
│   │   └── common/         Shared primitives (DataTable, EmptyState,
│   │                       ToastStack, ErrorBoundary, charts)
│   ├── store/              Zustand stores (timing, telemetry, race,
│   │                       session, practice, history, settings,
│   │                       toast, ui)
│   ├── hooks/              useWebSocket, useToast, useWeatherTracker,
│   │                       useKeyboardShortcuts, useLapFrames, useAudio
│   └── lib/                Pure utilities (lapUtils, strategy,
│                           raceEvents, formatters, colors, …)
├── tests/                  Vitest suites (vitest run)
└── data/                   Recordings + practice workbooks (gitignored)
```

## Tests

```bash
npm test                 # vitest run — 99 cases across:
                         # • lapUtils.deltaMsAtDistance
                         # • strategy.recommend / family / recColor / recIcon
                         # • timingStore.handleLapData (atomic PB,
                         #   regression streak, lap-jump rejection)
                         # • analysis.recomputeRunAggregates
                         # • DataTable.applySort
                         # • raceEvents.eventToToast (every routed code)
```

## Key design notes

- **Distance-based PB delta.** The dashboard delta interpolates into a
  stored PB-lap trace at the player's current track distance — not a
  linear extrapolation from lap fraction. The latter is wildly wrong on
  any real circuit. The PB trace and PB time are updated atomically:
  `bestLapMs` only advances when a usable trace can be snapshotted with
  it, so the live-delta UI never compares against an unanchored PB.
- **rAF batching.** High-frequency packets (telemetry, motion, lapData,
  carStatus, carDamage stream at 30–60 Hz) are queued latest-wins and
  flushed once per animation frame. Cuts re-renders 2–4×.
- **Container queries.** Glance-dashboard tiles use `container-type:
  inline-size` so font sizing scales with tile width via `cqi` units —
  one set of clamps works for desktop quadrants, mobile single-column,
  and the variable-width forecast strip without media-query
  redeclarations.
- **Self-deduping store actions.** `trackWeatherForLap` ignores calls
  for laps it's already seen, so the consumer hook can fire it on every
  render without having to track lap rollovers.
- **Production dead-code elimination.** All `import.meta.env.DEV`
  branches (debug diag line, unhandled-WS-type log, etc.) are stripped
  by Vite from the production bundle. Bundle: 493 KB raw / 159 KB
  gzipped.

## Troubleshooting

**No telemetry / "WAITING" status**
1. Confirm UDP is enabled in the game (settings above).
2. Confirm port matches between game and Settings tab.
3. macOS: check Firewall hasn't blocked Node from receiving UDP.
4. Try the "○ REC" indicator — it turns red when packets arrive.

**Timing tab empty**
The tab needs at least one full lap data packet from the game. In
solo play, drive past the start/finish line once.

**Glance dashboard "no PB yet"**
The live delta needs a clean lap (no penalty / pit / off-track) with at
least 20 distance samples to lock in as the PB reference. First flying
lap of a session usually qualifies.
