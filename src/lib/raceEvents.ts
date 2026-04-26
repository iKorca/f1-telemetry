import type { ToastKind } from '@/store/toastStore';

/**
 * Subset of the F1 25 event packet shape the toast formatter cares about.
 * The parser at `f1-parser.js:parseEvent` produces the full union; we
 * declare only the fields we read so the call site stays narrow.
 */
export interface RaceEvent {
  eventStringCode: string;
  eventName?: string;
  details?: {
    vehicleIdx?: number;
    otherVehicleIdx?: number;
    overtakingVehicleIdx?: number;
    beingOvertakenVehicleIdx?: number;
    vehicle1Idx?: number;
    vehicle2Idx?: number;
    lapTime?: number;                  // seconds (FTLP)
    speed?: number;                    // km/h  (SPTP)
    isOverallFastestInSession?: number;
    isDriverFastestInSession?: number;
    penaltyTypeName?: string;
    infringementTypeName?: string;
    eventTypeName?: string;
    safetyCarTypeName?: string;
    placesGained?: number;
    reason?: number;                   // RTMT
  };
}

export interface EventCtx {
  playerCarIndex: number;
  participantName(carIdx: number | undefined): string;
}

export interface EventToast {
  message: string;
  kind: ToastKind;
  timeoutMs?: number;
}

/**
 * Map an F1 25 event packet to a toast (or null to skip).
 *
 * Routing rules:
 *  - Session-level events (start/end, lights out, chequered flag, red
 *    flag, safety car) are always shown — low-frequency, big-picture.
 *  - Player-involved events (penalty against player, retirement, overtake
 *    by/against player, collision with player, drive-through served)
 *    are highlighted with appropriate severity.
 *  - Other-driver events that don't affect the player are mostly skipped
 *    to keep the toast strip from drowning the user during a race.
 *  - Pure-noise types (BUTN, FLBK, DRSE/DRSD, STLG, TMPT, SPTP for
 *    non-fastest non-player) return null.
 *
 * Pure function — easy to unit test, no hooks/stores touched.
 */
export function eventToToast(ev: RaceEvent, ctx: EventCtx): EventToast | null {
  const code = ev.eventStringCode;
  const d = ev.details ?? {};
  const isPlayer = (idx?: number) => idx !== undefined && idx === ctx.playerCarIndex;
  const nameOf = (idx?: number) => ctx.participantName(idx);

  switch (code) {
    // ── Session bookends ────────────────────────────────────────────────
    case 'SSTA':
      return { message: 'Session started', kind: 'info' };
    case 'SEND':
      return { message: 'Session ended', kind: 'info' };
    case 'LGOT':
      return { message: 'Lights out — go!', kind: 'success', timeoutMs: 6000 };
    case 'CHQF':
      return { message: 'Chequered flag', kind: 'info' };
    case 'RDFL':
      return { message: 'RED FLAG', kind: 'error', timeoutMs: 8000 };

    // ── Race winner ─────────────────────────────────────────────────────
    case 'RCWN':
      return isPlayer(d.vehicleIdx)
        ? { message: 'Race winner!', kind: 'success', timeoutMs: 8000 }
        : { message: `Race winner: ${nameOf(d.vehicleIdx)}`, kind: 'info', timeoutMs: 6000 };

    // ── Safety car / VSC ────────────────────────────────────────────────
    case 'SCAR': {
      const phase = d.eventTypeName || '';
      const car = d.safetyCarTypeName ? ` (${d.safetyCarTypeName})` : '';
      return { message: `Safety car ${phase}${car}`.trim().replace(/\s+/g, ' '), kind: 'warn' };
    }
    case 'VCAR': {
      const phase = d.eventTypeName || '';
      return { message: `Virtual safety car ${phase}`.trim().replace(/\s+/g, ' '), kind: 'warn' };
    }

    // ── Fastest lap (only the player's, or the session's overall) ──────
    case 'FTLP': {
      if (!isPlayer(d.vehicleIdx)) return null;
      const t = d.lapTime != null ? ` ${formatLap(d.lapTime)}` : '';
      return { message: `Fastest lap${t}`, kind: 'success' };
    }

    // ── Penalty (player only — others are noise during a long race) ────
    case 'PENA': {
      if (!isPlayer(d.vehicleIdx)) return null;
      const type = d.penaltyTypeName || 'Penalty';
      const cause = d.infringementTypeName ? ` (${d.infringementTypeName})` : '';
      return { message: `${type}${cause}`, kind: 'error', timeoutMs: 7000 };
    }

    // ── Retirement ──────────────────────────────────────────────────────
    case 'RTMT':
      if (isPlayer(d.vehicleIdx)) return { message: 'You retired', kind: 'error', timeoutMs: 6000 };
      return { message: `${nameOf(d.vehicleIdx)} retired`, kind: 'info' };

    // ── Overtake (only when player is involved) ────────────────────────
    case 'OVTK': {
      const overtaker = d.overtakingVehicleIdx;
      const overtaken = d.beingOvertakenVehicleIdx;
      if (isPlayer(overtaker)) return { message: `You overtook ${nameOf(overtaken)}`, kind: 'success' };
      if (isPlayer(overtaken)) return { message: `${nameOf(overtaker)} overtook you`, kind: 'warn' };
      return null;
    }

    // ── Collision (player only) ────────────────────────────────────────
    case 'COLL': {
      const v1 = d.vehicle1Idx;
      const v2 = d.vehicle2Idx;
      if (!isPlayer(v1) && !isPlayer(v2)) return null;
      const other = isPlayer(v1) ? v2 : v1;
      return { message: `Collision with ${nameOf(other)}`, kind: 'warn' };
    }

    // ── Drive-through / stop-go served (player only) ───────────────────
    case 'DTSV':
      return isPlayer(d.vehicleIdx) ? { message: 'Drive-through served', kind: 'info' } : null;
    case 'SGSV':
      return isPlayer(d.vehicleIdx) ? { message: 'Stop-go served', kind: 'info' } : null;

    // ── Speed trap (only when player IS the session-fastest) ───────────
    case 'SPTP': {
      if (!isPlayer(d.vehicleIdx)) return null;
      if (!d.isOverallFastestInSession) return null;
      const km = Math.round(d.speed ?? 0);
      return { message: `Speed trap: ${km} km/h (session best)`, kind: 'success' };
    }

    // ── Skip (too frequent / not actionable) ───────────────────────────
    // BUTN, FLBK, DRSE, DRSD, STLG, TMPT
    default:
      return null;
  }
}

/**
 * Format a lap-time-in-seconds as `M:SS.mmm` (e.g. 80.245 → "1:20.245").
 */
function formatLap(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}
