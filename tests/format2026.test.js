import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { parsePacket, PACKET_IDS } = require('../f1-parser');

const H = 29;

/**
 * Regression cover for the 2026 Season Pack wire format.
 *
 * Every packet size below was measured off a live F1 25 + 2026 DLC session, and
 * each struct layout was derived from those same packets and then cross-checked
 * against the published spec. These tests pin the offsets so a future edit can't
 * quietly reintroduce the failure mode this format originally caused — decoding
 * "successfully" into plausible nonsense.
 */
function header(buf, { format = 2026, packetId, playerCarIndex = 0 }) {
  buf.writeUInt16LE(format, 0);
  buf.writeUInt8(25, 2);
  buf.writeUInt8(1, 3);
  buf.writeUInt8(24, 4);
  buf.writeUInt8(1, 5);
  buf.writeUInt8(packetId, 6);
  buf.writeBigUInt64LE(1n, 7);
  buf.writeUInt8(playerCarIndex, 27);
  return buf;
}

describe('2026 format — observed packet sizes are the ones we decode', () => {
  const SIZES = {
    MOTION: [1325, 0, 54], SESSION: [926, null, null], LAP_DATA: [1399, 2, 57],
    PARTICIPANTS: [1470, 1, 60], CAR_SETUPS: [1233, 4, 50], CAR_TELEMETRY: [1448, 3, 59],
    CAR_STATUS: [1445, 0, 59], CAR_DAMAGE: [1133, 0, 46], CAR_TELEMETRY2: [269, 0, 10],
  };

  it('every per-car size reconciles as 29 + extra + 24 × stride', () => {
    for (const [name, [total, extra, stride]] of Object.entries(SIZES)) {
      if (stride === null) continue;
      expect(`${name}:${H + extra + 24 * stride}`).toBe(`${name}:${total}`);
    }
  });
});

describe('2026 CarStatusData — 59 bytes, ersHarvestLimitPerLap inserted at 50', () => {
  const STRIDE = 59;
  const buf = header(Buffer.alloc(H + 24 * STRIDE), { packetId: PACKET_IDS.CAR_STATUS });

  // Car 0: garaged. Car 1: running. Values mirror what the live packets carried.
  const write = (i, { store, mode, mguk, harvestLimit, deployed, paused, fuel }) => {
    const o = H + i * STRIDE;
    buf.writeUInt8(2, o); buf.writeUInt8(1, o + 1);
    buf.writeFloatLE(fuel, o + 5);
    buf.writeFloatLE(110, o + 9);
    buf.writeUInt16LE(13099, o + 17);
    buf.writeUInt16LE(4000, o + 19);
    buf.writeUInt8(9, o + 21);
    buf.writeUInt8(18, o + 25); buf.writeUInt8(17, o + 26);
    buf.writeFloatLE(store, o + 37);
    buf.writeUInt8(mode, o + 41);
    buf.writeFloatLE(mguk, o + 42);
    buf.writeFloatLE(0, o + 46);            // MGU-H retained but zero under 2026 regs
    buf.writeFloatLE(harvestLimit, o + 50); // NEW
    buf.writeFloatLE(deployed, o + 54);
    buf.writeUInt8(paused, o + 58);
  };
  write(0, { store: 4_000_000, mode: 0, mguk: 0, harvestLimit: 8_500_000, deployed: 0, paused: 0, fuel: 20 });
  write(1, { store: 3_210_608, mode: 1, mguk: 1_462_031, harvestLimit: 9_000_000, deployed: 1_740_003, paused: 1, fuel: 6.5 });

  const cars = parsePacket(buf).data.allCars;

  it('keeps every field before offset 50 at its 2025 position', () => {
    expect(cars[0].maxRPM).toBe(13099);
    expect(cars[0].idleRPM).toBe(4000);
    expect(cars[0].maxGears).toBe(9);
    expect(cars[0].fuelCapacity).toBeCloseTo(110, 3);
    expect(cars[0].ersStoreEnergy).toBeCloseTo(4_000_000, 0);
    expect(cars[0].ersDeployMode).toBe(0);
    expect(cars[1].ersHarvestedThisLapMGUK).toBeCloseTo(1_462_031, 0);
  });

  it('exposes the new per-lap harvest limit', () => {
    expect(cars[0].ersHarvestLimitPerLap).toBeCloseTo(8_500_000, 0);
    expect(cars[1].ersHarvestLimitPerLap).toBeCloseTo(9_000_000, 0);
  });

  it('reads deployed and networkPaused from their shifted offsets', () => {
    // The whole point: a garaged car must show zero deployed. Under the 2025
    // offsets this field would read the harvest limit instead.
    expect(cars[0].ersDeployedThisLap).toBe(0);
    expect(cars[1].ersDeployedThisLap).toBeCloseTo(1_740_003, 0);
    expect(cars[0].networkPaused).toBe(0);
    expect(cars[1].networkPaused).toBe(1);
  });

  it('decodes all 24 slots', () => {
    expect(cars).toHaveLength(24);
  });
});

describe('2026 CarTelemetryData — 59 bytes, engineTemperature narrowed to uint8', () => {
  const STRIDE = 59;
  const buf = header(Buffer.alloc(H + 24 * STRIDE + 3), { packetId: PACKET_IDS.CAR_TELEMETRY });
  const o = H;
  buf.writeUInt16LE(168, o);
  buf.writeFloatLE(1, o + 2);      // throttle
  buf.writeFloatLE(0, o + 10);     // brake
  buf.writeInt8(4, o + 15);        // gear
  buf.writeUInt16LE(10728, o + 16);
  buf.writeUInt8(110, o + 38);     // engineTemperature — uint8 in 2026
  [21.9, 21.9, 23.3, 23.3].forEach((v, i) => buf.writeFloatLE(v, o + 39 + i * 4));
  [0, 0, 0, 0].forEach((v, i) => buf.writeUInt8(v, o + 55 + i));

  const car = parsePacket(buf).data.allCars[0];

  it('decodes the shifted fields coherently', () => {
    expect(car.speed).toBe(168);
    expect(car.throttle).toBeCloseTo(1, 5);
    expect(car.gear).toBe(4);
    expect(car.engineRPM).toBe(10728);
    expect(car.engineTemperature).toBe(110);
    expect(car.tyresPressure.map((v) => Math.round(v * 10) / 10)).toEqual([21.9, 21.9, 23.3, 23.3]);
    expect(car.surfaceType).toEqual([0, 0, 0, 0]);
  });
});

describe('2026 MotionData — 54 bytes, g-forces quantised to thousandths of a g', () => {
  const STRIDE = 54;
  const buf = header(Buffer.alloc(H + 24 * STRIDE), { packetId: PACKET_IDS.MOTION });
  const o = H;
  buf.writeFloatLE(23.2, o); buf.writeFloatLE(4.0, o + 4); buf.writeFloatLE(-840.9, o + 8);
  buf.writeFloatLE(81.3, o + 12);
  buf.writeInt16LE(-3654, o + 36);  // lateral  -> -3.654 g
  buf.writeInt16LE(147, o + 38);
  buf.writeInt16LE(-186, o + 40);
  buf.writeFloatLE(1.684, o + 42);  // yaw
  buf.writeFloatLE(-0.008, o + 46);
  buf.writeFloatLE(-0.011, o + 50);

  const car = parsePacket(buf).data.allCars[0];

  it('converts quantised g-forces back to g', () => {
    expect(car.gForceLateral).toBeCloseTo(-3.654, 3);
    expect(car.gForceLongitudinal).toBeCloseTo(0.147, 3);
    expect(car.gForceVertical).toBeCloseTo(-0.186, 3);
  });

  it('reads yaw/pitch/roll from their shifted offsets', () => {
    expect(car.yaw).toBeCloseTo(1.684, 3);
    expect(car.pitch).toBeCloseTo(-0.008, 3);
    expect(car.roll).toBeCloseTo(-0.011, 3);
    expect(car.worldPositionZ).toBeCloseTo(-840.9, 1);
    expect(car.worldVelocityX).toBeCloseTo(81.3, 1);
  });
});

describe('2026 packet 16 — CarTelemetry2 (active aero + overtake)', () => {
  const STRIDE = 10;
  const buf = header(Buffer.alloc(H + 24 * STRIDE), { packetId: PACKET_IDS.CAR_TELEMETRY2 });
  const o = H;
  buf.writeUInt8(1, o);              // activeAeroMode
  buf.writeUInt8(1, o + 1);          // activeAeroAvailable
  buf.writeUInt16LE(187, o + 2);
  buf.writeUInt8(1, o + 4);          // overtakeAvailable
  buf.writeUInt8(1, o + 5);          // overtakeActive
  buf.writeUInt16LE(42, o + 6);
  buf.writeUInt8(1, o + 8);          // regulations2026Applicable
  buf.writeUInt8(0, o + 9);

  const parsed = parsePacket(buf);

  it('is recognised as a packet type', () => {
    expect(parsed).not.toBeNull();
    expect(parsed.type).toBe(16);
    expect(parsed.data.allCars).toHaveLength(24);
  });

  it('decodes the 2026 aero and overtake mechanics', () => {
    const car = parsed.data.allCars[0];
    expect(car.activeAeroMode).toBe(1);
    expect(car.activeAeroAvailable).toBe(1);
    expect(car.activeAeroActivationDistance).toBe(187);
    expect(car.overtakeAvailable).toBe(1);
    expect(car.overtakeActive).toBe(1);
    expect(car.overtakeActivationDistance).toBe(42);
    expect(car.regulations2026Applicable).toBe(1);
    expect(car.isDrivingWrongWay).toBe(0);
  });
});

describe('unknown layouts are dropped, not guessed', () => {
  it('returns null for a car-status packet of an unrecognised size', () => {
    const buf = header(Buffer.alloc(H + 24 * 57), { packetId: PACKET_IDS.CAR_STATUS });
    expect(parsePacket(buf)).toBeNull();
  });

  it('returns null for a motion packet of an unrecognised size', () => {
    const buf = header(Buffer.alloc(H + 23 * 60), { packetId: PACKET_IDS.MOTION });
    expect(parsePacket(buf)).toBeNull();
  });
});
