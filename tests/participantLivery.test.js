import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { parsePacket, PACKET_IDS } = require('../f1-parser');

const HEADER_SIZE = 29;

// The two participant layouts the game can emit. Sizes are the ones measured off
// the wire from a live F1 25 + 2026 Season Pack install, so these numbers are
// observations, not transcriptions.
const F25 = { format: 2025, cars: 22, stride: 57, wideIds: false }; // 1284 bytes
const F26 = { format: 2026, cars: 24, stride: 60, wideIds: true };  // 1470 bytes

function packetSize(l) {
  return HEADER_SIZE + 1 + l.cars * l.stride;
}

/**
 * Build a participants packet byte by byte for the given layout, so the parser's
 * offsets are asserted against an independently-constructed struct rather than
 * against its own assumptions.
 */
function buildParticipantsPacket(layout, cars) {
  const buf = Buffer.alloc(packetSize(layout));

  buf.writeUInt16LE(layout.format, 0);
  buf.writeUInt8(25, 2);        // gameYear
  buf.writeUInt8(1, 3);
  buf.writeUInt8(24, 4);
  buf.writeUInt8(1, 5);
  buf.writeUInt8(PACKET_IDS.PARTICIPANTS, 6);
  buf.writeBigUInt64LE(1n, 7);
  buf.writeUInt8(0, 27);        // playerCarIndex

  buf.writeUInt8(cars.length, HEADER_SIZE);

  const idBytes = layout.wideIds ? 2 : 1;
  const writeId = (v, at) =>
    layout.wideIds ? buf.writeUInt16LE(v, at) : buf.writeUInt8(v, at);

  cars.forEach((car, i) => {
    const o = HEADER_SIZE + 1 + i * layout.stride;
    let p = o;
    buf.writeUInt8(1, p); p += 1;             // aiControlled
    writeId(car.driverId, p); p += idBytes;
    writeId(255, p); p += idBytes;            // networkId
    writeId(car.teamId, p); p += idBytes;
    buf.writeUInt8(0, p); p += 1;             // myTeam
    buf.writeUInt8(car.raceNumber, p); p += 1;
    buf.writeUInt8(1, p); p += 1;             // nationality

    buf.write(car.name, p, 32, 'utf8'); p += 32;   // name[32], NUL-padded

    buf.writeUInt8(0, p);            // yourTelemetry
    buf.writeUInt8(1, p + 1);        // showOnlineNames
    buf.writeUInt16LE(0, p + 2);     // techLevel
    buf.writeUInt8(1, p + 4);        // platform (Steam)
    buf.writeUInt8(car.colours.length, p + 5);
    car.colours.forEach(([r, g, b], c) => {
      const co = p + 6 + c * 3;
      buf.writeUInt8(r, co);
      buf.writeUInt8(g, co + 1);
      buf.writeUInt8(b, co + 2);
    });

    // Sanity: the fields above must exactly fill one stride.
    if (p + 6 + 12 !== o + layout.stride) {
      throw new Error(`layout ${layout.format}: struct fills ${p + 18 - o}, expected ${layout.stride}`);
    }
  });

  return buf;
}

// Real values observed on the wire. On the 2025 format the 2026 teams arrive
// truncated to a uint8 (476 - 256 = 220), which is why both id blocks exist.
const MERCEDES = [[0x27, 0xf4, 0xd2], [0xe9, 0xe9, 0xe9], [0x23, 0x23, 0x23]];
const FERRARI  = [[0xe8, 0x00, 0x2d], [0xff, 0xec, 0x40], [0x2e, 0x2e, 0x2e]];
const CADILLAC = [[0xaa, 0xaa, 0xad], [0x0a, 0x0c, 0x10], [0x04, 0x1e, 0x42]];

describe('participants — F1 25 (2025) layout', () => {
  const cars = [
    { teamId: 220, driverId: 1, raceNumber: 63, name: 'RUSSELL',  colours: MERCEDES },
    { teamId: 221, driverId: 2, raceNumber: 16, name: 'LECLERC',  colours: FERRARI },
    { teamId: 230, driverId: 3, raceNumber: 11, name: 'PÉREZ',    colours: CADILLAC },
  ];
  const packet = parsePacket(buildParticipantsPacket(F25, cars));

  it('parses', () => {
    expect(packet).not.toBeNull();
    expect(packet.type).toBe(PACKET_IDS.PARTICIPANTS);
    expect(packet.data.numActiveCars).toBe(3);
  });

  it('reads the truncated 2026 team ids', () => {
    expect(packet.data.participants.map((p) => p.teamId)).toEqual([220, 221, 230]);
  });

  it('decodes livery colours and names', () => {
    expect(packet.data.participants.map((p) => p.teamColour))
      .toEqual(['#27f4d2', '#e8002d', '#aaaaad']);
    expect(packet.data.participants.map((p) => p.name))
      .toEqual(['RUSSELL', 'LECLERC', 'PÉREZ']);
    expect(packet.data.participants.map((p) => p.raceNumber)).toEqual([63, 16, 11]);
  });
});

describe('participants — 2026 Season Pack layout', () => {
  // In the 2026 format m_teamId is a uint16, so the same teams carry their full
  // ids rather than the low byte.
  const cars = [
    { teamId: 476, driverId: 1, raceNumber: 63, name: 'RUSSELL', colours: MERCEDES },
    { teamId: 477, driverId: 2, raceNumber: 16, name: 'LECLERC', colours: FERRARI },
    { teamId: 486, driverId: 3, raceNumber: 11, name: 'PÉREZ',   colours: CADILLAC },
  ];
  const raw = buildParticipantsPacket(F26, cars);
  const packet = parsePacket(raw);

  it('is the size the game actually sends', () => {
    expect(raw.length).toBe(1470);
  });

  it('parses', () => {
    expect(packet).not.toBeNull();
    expect(packet.data.numActiveCars).toBe(3);
  });

  it('reads uint16 team ids without truncating', () => {
    expect(packet.data.participants.map((p) => p.teamId)).toEqual([476, 477, 486]);
  });

  it('reads names from the 3-byte-shifted offset', () => {
    expect(packet.data.participants.map((p) => p.name))
      .toEqual(['RUSSELL', 'LECLERC', 'PÉREZ']);
  });

  it('decodes livery colours identically to the 2025 layout', () => {
    expect(packet.data.participants[0].liveryColours).toEqual(['#27f4d2', '#e9e9e9', '#232323']);
    expect(packet.data.participants[2].liveryColours).toEqual(['#aaaaad', '#0a0c10', '#041e42']);
    expect(packet.data.participants.map((p) => p.teamColour))
      .toEqual(['#27f4d2', '#e8002d', '#aaaaad']);
  });

  it('keeps the fields that follow the widened ids aligned', () => {
    expect(packet.data.participants.map((p) => p.raceNumber)).toEqual([63, 16, 11]);
    expect(packet.data.participants.map((p) => p.driverId)).toEqual([1, 2, 3]);
    expect(packet.data.participants.every((p) => p.platform === 1)).toBe(true);
    expect(packet.data.participants.every((p) => p.nationality === 1)).toBe(true);
  });
});

describe('participants — layout resolution', () => {
  const car = { teamId: 9, driverId: 1, raceNumber: 5, name: 'X', colours: [] };

  it('does not decode a 2026 packet with the 2025 struct', () => {
    // The old size heuristic rounded 1440/22 to 65, landed inside its accepted
    // band, and produced confident garbage. Decoding must key off the real
    // layout, so a 2026 packet mislabelled as 2025 must not yield 2025 offsets.
    const raw = buildParticipantsPacket(F26, [car]);
    raw.writeUInt16LE(2025, 0);            // claim the wrong format in the header
    const parsed = parsePacket(raw);
    // Resolution falls back to an exact size match, so it still decodes — and
    // critically it decodes with the 60-byte layout, not a fabricated 65-byte one.
    expect(parsed).not.toBeNull();
    expect(parsed.data.participants[0].name).toBe('X');
  });

  it('drops a packet whose length matches no known layout', () => {
    const raw = buildParticipantsPacket(F26, [car]);
    expect(parsePacket(raw.subarray(0, raw.length - 7))).toBeNull();
  });

  it('leaves teamColour null when no colours are sent', () => {
    const parsed = parsePacket(buildParticipantsPacket(F26, [car]));
    expect(parsed.data.participants[0].liveryColours).toEqual([]);
    expect(parsed.data.participants[0].teamColour).toBeNull();
  });
});
