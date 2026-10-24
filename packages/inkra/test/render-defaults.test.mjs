import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pencilRenderDefaults, maxStrokeRoughness, readRenderToken } from '../dist/internal/renderTokens.js';
import { pencilLettering } from '../dist/internal/textRenderer.js';

test('CSS and renderer defaults use the complete selected material preset', () => {
  const css = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
  const expected = {
    'letter-variation': 0.2, 'letter-breaks': 0.5, 'letter-outline': 0.9,
    'letter-fill': 0.9, 'letter-grain': 0.6,
    'stroke-width': 2, 'icon-stroke-width': 1.5, 'icon-breaks': 0.18, 'icon-break-count': 1, 'icon-pressure-variation': 0.82, 'stroke-amplitude': 1.5,
    'wash-strength': 0.8, 'wash-spacing': 2, 'wash-roughness': 3, 'wash-angle': -45,
  };
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(parseFloat(css.match(new RegExp(`--inkra-${key}:\\s*([^;]+);`))?.[1]), value, key);
  }
  assert.deepEqual(pencilLettering, { variation: 0.2, breaks: 0.5, outline: 0.9, fill: 0.9, grain: 0.6 });
  assert.deepEqual(pencilRenderDefaults, { strokeWidth: 2, iconStrokeWidth: 1.5, iconBreaks: 0.18, iconBreakCount: 1, iconPressureVariation: 0.82, strokeRoughness: 1.5, washStrength: 0.8, washSpacing: 2, washRoughness: 3, washAngle: -45 });
});

test('stroke roughness supports values above two with a bounded maximum', () => {
  assert.equal(maxStrokeRoughness, 4);
  for (const [input, expected] of [['3', 3], ['4', 4], ['20', 4], ['-1', 0], ['invalid', 1.5]]) {
    assert.equal(readRenderToken({ getPropertyValue: () => input }, '--inkra-stroke-amplitude', pencilRenderDefaults.strokeRoughness, 0, maxStrokeRoughness), expected);
  }
});
