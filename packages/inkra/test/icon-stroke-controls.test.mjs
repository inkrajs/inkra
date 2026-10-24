import assert from 'node:assert/strict';
import test from 'node:test';
import { strokeProfile } from '../dist/internal/stroke.js';

test('short icon pressure has a complete gesture with continuously adjustable width contrast', () => {
  for (const length of [4, 8, 14, 18, 23]) for (let seed = 1; seed <= 20; seed++) {
    const range = variation => {
      const values = Array.from({ length: 101 }, (_, i) => strokeProfile(length * i / 100, length, seed, { variation, fitPressure: true }).pressure);
      return Math.max(...values) - Math.min(...values);
    };
    assert.equal(range(0), 0);
    assert(range(1) > 0.6, `full pressure contrast on ${length}-unit path`);
    assert(Math.abs(range(0.5) * 2 - range(1)) < 0.001);
  }
  for (let at = 0; at <= 100; at++) {
    assert.deepEqual(strokeProfile(at, 100, 42, { fitPressure: true }), strokeProfile(at, 100, 42), 'long-stroke profile stays unchanged');
  }
});

test('gap count is a length-aware maximum without changing pressure or endpoints', () => {
  for (const length of [4, 8, 11.9, 12, 14, 23, 24, 48, 80, 144, 240]) for (const count of [0, 1, 2, 3, 6, 12]) {
    for (const seed of [1, 11, 42]) {
      let gaps = 0;
      let inGap = false;
      for (let i = 0; i <= 2400; i++) {
        const at = length * i / 2400;
        const profile = strokeProfile(at, length, seed, { continuousBreaks: true, breakCount: count, breaks: 0.6 });
        const gap = profile.contact < 0.01;
        if (gap && !inGap) gaps++;
        inGap = gap;
        assert.equal(profile.pressure, strokeProfile(at, length, seed).pressure);
        if (count >= Math.floor(length / 12)) {
          assert.deepEqual(profile, strokeProfile(at, length, seed, { continuousBreaks: true, breakCount: 12, breaks: 0.6 }), 'raising the cap above path capacity leaves identical pixels');
        }
      }
      assert.equal(gaps, Math.min(count, Math.floor(length / 12)), `maximum=${count}, length=${length}, seed=${seed}`);
      for (const at of [0, length]) {
        assert.equal(strokeProfile(at, length, seed, { continuousBreaks: true, breakCount: count, breaks: 1 }).contact, 1, 'full gap strength preserves endpoints');
      }
    }
  }
});

test('displayed length increases gap capacity while the configured maximum stays authoritative', () => {
  for (const size of [16, 24, 40, 64, 96, 128]) for (const maximum of [0, 1, 3, 12]) {
    const length = 16;
    const settings = { continuousBreaks: true, breakCount: maximum, breakScale: size / 40, breaks: 1 };
    let count = 0, inside = false;
    for (let i = 0; i <= 2400; i++) {
      const at = length * i / 2400;
      const profile = strokeProfile(at, length, 11, settings);
      const gap = profile.contact < 0.01;
      if (gap && !inside) count++;
      inside = gap;
      assert.equal(profile.pressure, strokeProfile(at, length, 11).pressure, 'display scale does not change pressure');
    }
    assert.equal(count, Math.min(maximum, Math.floor(length * size / 40 / 12)), `size=${size}, maximum=${maximum}`);
  }
  for (const breakScale of [NaN, Infinity, -1, 0]) {
    assert.deepEqual(strokeProfile(6, 16, 11, { continuousBreaks: true, breakCount: 12, breakScale }),
      strokeProfile(6, 16, 11, { continuousBreaks: true, breakCount: 12 }), 'invalid scales fall back to path units');
  }
});

test('continuous icon breaks grow through the entire range without random activation thresholds', () => {
  const coverage = breaks => {
    let missing = 0;
    for (let seed = 1; seed <= 12; seed++) {
      for (let at = 0; at < 370; at += 0.1) {
        missing += 1 - strokeProfile(at, 370, seed, { breaks, continuousBreaks: true }).contact;
      }
    }
    return missing;
  };
  assert.equal(coverage(0), 0);
  const full = coverage(1);
  for (const breaks of [0.01, 0.1, 0.25, 0.49, 0.5, 0.51, 0.75]) {
    assert(Math.abs(coverage(breaks) / full - breaks) < 0.012, `gap coverage tracks ${breaks}`);
  }
  for (let seed = 1; seed <= 20; seed++) for (let at = 0; at < 74; at += 0.1) {
    const before = strokeProfile(at, 74, seed, { breaks: 0.5, continuousBreaks: true }).contact;
    const after = strokeProfile(at, 74, seed, { breaks: 0.500001, continuousBreaks: true }).contact;
    assert(after <= before, 'increasing breaks cannot refill a gap');
    assert(before - after < 0.0001, 'there is no threshold jump at 50%');
  }
});

test('pressure variation is independent from gaps and zero produces constant pressure', () => {
  const pressures = new Set();
  for (let at = 0; at <= 100; at++) {
    const flat = strokeProfile(at, 100, 11, { variation: 0, breaks: 0, continuousBreaks: true });
    const varied = strokeProfile(at, 100, 11, { variation: 1, breaks: 0, continuousBreaks: true });
    assert.equal(flat.pressure, 0.72);
    assert.equal(flat.contact, varied.contact);
    pressures.add(varied.pressure);
  }
  assert(pressures.size > 50);
});

test('short icon strokes have progressive gaps without sacrificing their endpoints', () => {
  for (const length of [4, 8, 12, 18, 24]) for (let seed = 1; seed <= 20; seed++) {
    const contact = (at, breaks) => strokeProfile(at, length, seed, { breaks, continuousBreaks: true }).contact;
    const missing = breaks => Array.from({ length: 100 }, (_, i) => 1 - contact(length * i / 100, breaks)).reduce((a, b) => a + b, 0);
    assert(missing(0.1) > 0, 'even a low break amount is represented on short paths');
    assert(missing(0.25) < missing(0.5));
    assert(missing(0.5) < missing(1));
    assert(contact(0, 1) > 0);
    assert(contact(length, 1) > 0);
  }
});
