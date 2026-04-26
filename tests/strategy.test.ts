import { describe, it, expect } from 'vitest';
import { recommend, family, recColor, recIcon } from '../src/lib/strategy';

describe('recommend(rainPct, weatherName)', () => {
  it('picks DRY below 20 % rain in clear weather', () => {
    expect(recommend(0,  'Clear')).toBe('DRY');
    expect(recommend(10, 'Light Cloud')).toBe('DRY');
    expect(recommend(19, 'Overcast')).toBe('DRY');
  });

  it('picks INTER at 20 %–65 % rain (numeric boundary, no heavy-rain override)', () => {
    expect(recommend(20, 'Light Rain')).toBe('INTER');
    expect(recommend(40, 'Light Rain')).toBe('INTER');
    expect(recommend(65, 'Light Rain')).toBe('INTER'); // boundary: 65 is INTER, 66 is WET
    // Note: weatherName='Heavy Rain' overrides numeric thresholds and forces WET,
    // so the % boundary is asserted against 'Light Rain' to keep the override out.
  });

  it('picks WET above 65 % rain', () => {
    expect(recommend(66, 'Heavy Rain')).toBe('WET');
    expect(recommend(80, 'Storm')).toBe('WET');
    expect(recommend(100, 'Storm')).toBe('WET');
  });

  it('forces WET when weatherName is a storm or heavy rain regardless of %', () => {
    expect(recommend(0,  'Storm')).toBe('WET');
    expect(recommend(15, 'Heavy Rain')).toBe('WET');
  });

  it('prioritises numeric > 65 % over a non-heavy "rain" weather name (no override)', () => {
    // "Light Rain" doesn't match the heavy-rain regex, so this case proves
    // the > 65 numeric path actually fires (not the weather-name override).
    expect(recommend(66, 'Light Rain')).toBe('WET');
    expect(recommend(66, 'Wet')).toBe('WET');
  });

  it('falls back to INTER when weather mentions rain/wet but no % is given', () => {
    expect(recommend(0, 'Light Rain')).toBe('INTER');
    expect(recommend(0, 'Wet')).toBe('INTER');
  });

  it('is case-insensitive in weather-name matching', () => {
    expect(recommend(0, 'storm')).toBe('WET');
    expect(recommend(0, 'HEAVY RAIN')).toBe('WET');
    expect(recommend(0, 'rain')).toBe('INTER');
  });
});

describe('family(compound)', () => {
  it('returns null for missing / unknown compound', () => {
    expect(family('')).toBeNull();
    expect(family('—')).toBeNull();
  });

  it('classifies wet-weather compounds explicitly', () => {
    expect(family('WET')).toBe('WET');
    expect(family('wet')).toBe('WET');
    expect(family('INTER')).toBe('INTER');
    expect(family('INTERMEDIATE')).toBe('INTER');
    expect(family('inter')).toBe('INTER');
  });

  it('classifies any slick compound as DRY', () => {
    expect(family('SOFT')).toBe('DRY');
    expect(family('MEDIUM')).toBe('DRY');
    expect(family('HARD')).toBe('DRY');
    expect(family('SUPER SOFT')).toBe('DRY');
    expect(family('C5')).toBe('DRY');
  });
});

describe('recColor', () => {
  it('returns the brightened DRY red (≥ WCAG AA on dark tile)', () => {
    expect(recColor('DRY')).toBe('#ff3a55');
  });
  it('returns stable INTER green and WET blue', () => {
    expect(recColor('INTER')).toBe('#39d353');
    expect(recColor('WET')).toBe('#3b82f6');
  });
});

describe('recIcon', () => {
  it('maps each recommendation to a distinct glyph for colour-blind users', () => {
    expect(recIcon('DRY')).toBe('☀');
    expect(recIcon('INTER')).toBe('☂');
    expect(recIcon('WET')).toBe('☔');
    // Verify uniqueness — the whole point is non-color disambiguation.
    const set = new Set([recIcon('DRY'), recIcon('INTER'), recIcon('WET')]);
    expect(set.size).toBe(3);
  });
});
