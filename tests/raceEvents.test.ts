import { describe, it, expect } from 'vitest';
import { eventToToast, type RaceEvent, type EventCtx } from '../src/lib/raceEvents';

const PLAYER = 0;
const RIVAL = 1;

const ctx: EventCtx = {
  playerCarIndex: PLAYER,
  participantName: (idx) => {
    if (idx === PLAYER) return 'STROLL';
    if (idx === RIVAL) return 'PIASTRI';
    return idx != null ? `#${idx}` : '—';
  },
};

const ev = (eventStringCode: string, details: RaceEvent['details'] = {}): RaceEvent => ({
  eventStringCode,
  details,
});

describe('eventToToast — session bookends', () => {
  it('shows session start / lights out / chequered / red flag / session end', () => {
    expect(eventToToast(ev('SSTA'), ctx)?.message).toBe('Session started');
    expect(eventToToast(ev('LGOT'), ctx)?.kind).toBe('success');
    expect(eventToToast(ev('CHQF'), ctx)?.message).toBe('Chequered flag');
    expect(eventToToast(ev('RDFL'), ctx)?.kind).toBe('error');
    expect(eventToToast(ev('SEND'), ctx)?.message).toBe('Session ended');
  });

  it('extends the timeout on race-start and red-flag toasts so they linger', () => {
    expect(eventToToast(ev('LGOT'), ctx)?.timeoutMs).toBe(6000);
    expect(eventToToast(ev('RDFL'), ctx)?.timeoutMs).toBe(8000);
  });
});

describe('eventToToast — race winner', () => {
  it('celebrates when the player wins', () => {
    const t = eventToToast(ev('RCWN', { vehicleIdx: PLAYER }), ctx);
    expect(t?.kind).toBe('success');
    expect(t?.message).toBe('Race winner!');
  });

  it('reports another driver winning as info', () => {
    const t = eventToToast(ev('RCWN', { vehicleIdx: RIVAL }), ctx);
    expect(t?.kind).toBe('info');
    expect(t?.message).toBe('Race winner: PIASTRI');
  });
});

describe('eventToToast — fastest lap (player only)', () => {
  it('emits a success toast with formatted lap time when player sets FTLP', () => {
    const t = eventToToast(ev('FTLP', { vehicleIdx: PLAYER, lapTime: 80.245 }), ctx);
    expect(t?.kind).toBe('success');
    expect(t?.message).toBe('Fastest lap 1:20.245');
  });

  it('omits the lap time when the parser didn\'t supply one', () => {
    const t = eventToToast(ev('FTLP', { vehicleIdx: PLAYER }), ctx);
    expect(t?.message).toBe('Fastest lap');
  });

  it('skips non-player FTLP to avoid noise during long races', () => {
    expect(eventToToast(ev('FTLP', { vehicleIdx: RIVAL, lapTime: 79.5 }), ctx)).toBeNull();
  });
});

describe('eventToToast — penalty (player only)', () => {
  it('shows penalty + cause as an error toast for the player', () => {
    const t = eventToToast(
      ev('PENA', { vehicleIdx: PLAYER, penaltyTypeName: '5 second time penalty', infringementTypeName: 'Track limits' }),
      ctx,
    );
    expect(t?.kind).toBe('error');
    expect(t?.message).toBe('5 second time penalty (Track limits)');
    expect(t?.timeoutMs).toBe(7000);
  });

  it('falls back to "Penalty" when the parser didn\'t name the type', () => {
    const t = eventToToast(ev('PENA', { vehicleIdx: PLAYER }), ctx);
    expect(t?.message).toBe('Penalty');
  });

  it('skips penalties against other drivers', () => {
    expect(eventToToast(ev('PENA', { vehicleIdx: RIVAL, penaltyTypeName: 'Stop Go' }), ctx)).toBeNull();
  });
});

describe('eventToToast — overtake (only when player involved)', () => {
  it('celebrates a player overtake', () => {
    const t = eventToToast(
      ev('OVTK', { overtakingVehicleIdx: PLAYER, beingOvertakenVehicleIdx: RIVAL }),
      ctx,
    );
    expect(t?.kind).toBe('success');
    expect(t?.message).toBe('You overtook PIASTRI');
  });

  it('warns when the player is overtaken', () => {
    const t = eventToToast(
      ev('OVTK', { overtakingVehicleIdx: RIVAL, beingOvertakenVehicleIdx: PLAYER }),
      ctx,
    );
    expect(t?.kind).toBe('warn');
    expect(t?.message).toBe('PIASTRI overtook you');
  });

  it('skips overtakes that don\'t involve the player', () => {
    expect(
      eventToToast(ev('OVTK', { overtakingVehicleIdx: 4, beingOvertakenVehicleIdx: 5 }), ctx),
    ).toBeNull();
  });
});

describe('eventToToast — collision (player only)', () => {
  it('warns on player collision and names the other car', () => {
    const t = eventToToast(ev('COLL', { vehicle1Idx: PLAYER, vehicle2Idx: RIVAL }), ctx);
    expect(t?.kind).toBe('warn');
    expect(t?.message).toBe('Collision with PIASTRI');
  });

  it('works regardless of which slot the player occupies', () => {
    const t = eventToToast(ev('COLL', { vehicle1Idx: RIVAL, vehicle2Idx: PLAYER }), ctx);
    expect(t?.message).toBe('Collision with PIASTRI');
  });

  it('skips collisions between two other drivers', () => {
    expect(eventToToast(ev('COLL', { vehicle1Idx: 3, vehicle2Idx: 5 }), ctx)).toBeNull();
  });
});

describe('eventToToast — retirement', () => {
  it('reports the player\'s own retirement as an error', () => {
    const t = eventToToast(ev('RTMT', { vehicleIdx: PLAYER }), ctx);
    expect(t?.kind).toBe('error');
    expect(t?.message).toBe('You retired');
  });

  it('reports another driver retiring as info with their name', () => {
    const t = eventToToast(ev('RTMT', { vehicleIdx: RIVAL }), ctx);
    expect(t?.kind).toBe('info');
    expect(t?.message).toBe('PIASTRI retired');
  });
});

describe('eventToToast — safety car', () => {
  it('emits a warn toast with phase + car type for SCAR', () => {
    const t = eventToToast(
      ev('SCAR', { eventTypeName: 'Deployed', safetyCarTypeName: 'Full' }),
      ctx,
    );
    expect(t?.kind).toBe('warn');
    expect(t?.message).toBe('Safety car Deployed (Full)');
  });

  it('handles VCAR without a car type', () => {
    const t = eventToToast(ev('VCAR', { eventTypeName: 'Deployed' }), ctx);
    expect(t?.message).toBe('Virtual safety car Deployed');
  });
});

describe('eventToToast — speed trap (player + session-best only)', () => {
  it('celebrates when player sets the overall session-best speed', () => {
    const t = eventToToast(
      ev('SPTP', { vehicleIdx: PLAYER, speed: 343.7, isOverallFastestInSession: 1 }),
      ctx,
    );
    expect(t?.kind).toBe('success');
    expect(t?.message).toBe('Speed trap: 344 km/h (session best)');
  });

  it('skips player-only-fastest (driver-fastest but not overall)', () => {
    expect(
      eventToToast(
        ev('SPTP', { vehicleIdx: PLAYER, speed: 320, isDriverFastestInSession: 1 }),
        ctx,
      ),
    ).toBeNull();
  });

  it('skips other drivers entirely', () => {
    expect(
      eventToToast(
        ev('SPTP', { vehicleIdx: RIVAL, speed: 350, isOverallFastestInSession: 1 }),
        ctx,
      ),
    ).toBeNull();
  });
});

describe('eventToToast — service-served', () => {
  it('confirms drive-through served for the player', () => {
    expect(eventToToast(ev('DTSV', { vehicleIdx: PLAYER }), ctx)?.message).toBe('Drive-through served');
  });
  it('confirms stop-go served for the player', () => {
    expect(eventToToast(ev('SGSV', { vehicleIdx: PLAYER }), ctx)?.message).toBe('Stop-go served');
  });
  it('skips the same events for other drivers', () => {
    expect(eventToToast(ev('DTSV', { vehicleIdx: RIVAL }), ctx)).toBeNull();
    expect(eventToToast(ev('SGSV', { vehicleIdx: RIVAL }), ctx)).toBeNull();
  });
});

describe('eventToToast — noisy types are filtered out', () => {
  // BUTN (button presses), FLBK (flashback), DRSE/DRSD (DRS toggles),
  // STLG (start lights animation), TMPT (team mate in pits) all return
  // null. They flow through the WS at high frequency and aren't
  // actionable as toasts.
  it.each(['BUTN', 'FLBK', 'DRSE', 'DRSD', 'STLG', 'TMPT'])(
    'returns null for %s',
    (code) => {
      expect(eventToToast(ev(code), ctx)).toBeNull();
    },
  );

  it('returns null for unrecognised event codes (forward-compat)', () => {
    expect(eventToToast(ev('XXXX'), ctx)).toBeNull();
  });
});
