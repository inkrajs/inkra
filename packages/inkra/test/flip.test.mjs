import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';

const flipModule = process.env.INKRA_FLIP_MODULE
  ? new URL(process.env.INKRA_FLIP_MODULE, import.meta.url).href
  : new URL('../dist/flip/index.js', import.meta.url).href;
const { Flip, FlipToggle, Tilt, calculateTiltRotation } = await import(flipModule);
const source = readFileSync(new URL('../src/flip/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/flip/styles.css', import.meta.url), 'utf8');

test('Tilt maps the pointer to matching visual corners and honors axis limits', () => {
  const bounds = { left: 10, top: 20, width: 200, height: 100 };
  assert.deepEqual(calculateTiltRotation(210, 20, bounds, 9), { rotateX: -9, rotateY: -9 });
  assert.deepEqual(calculateTiltRotation(10, 120, bounds, 9), { rotateX: 9, rotateY: 9 });
  assert.deepEqual(calculateTiltRotation(110, 70, bounds, 9), { rotateX: 0, rotateY: 0 });
  assert.deepEqual(calculateTiltRotation(210, 20, bounds, 9, 'x'), { rotateX: -9, rotateY: 0 });
  assert.deepEqual(calculateTiltRotation(210, 20, bounds, 9, 'y'), { rotateX: 0, rotateY: -9 });
  assert.deepEqual(calculateTiltRotation(210, 20, { ...bounds, width: 0 }, 9), { rotateX: 0, rotateY: 0 });
});

test('Tilt is SSR-safe, neutral by default and exposes stable timing variables', () => {
  const html = render(h(Tilt, { axis: 'x', maxAngle: 12, response: 90, resetDuration: 240 }, h('a', { href: '/notes' }, 'Notes')));
  assert.match(html, /^<div/);
  assert.match(html, /class="inkra-tilt"/);
  assert.match(html, /data-axis="x"/);
  assert.match(html, /--inkra-tilt-response:90ms/);
  assert.match(html, /--inkra-tilt-reset-duration:240ms/);
  assert.match(html, /--inkra-tilt-rotate-x:0deg/);
  assert.match(html, /<a href="\/notes">Notes<\/a>/);
  assert.doesNotMatch(html, /data-tilting|role="button"|tabindex/);
});

test('Flip keeps arbitrary face content and hides the inactive face from focus and accessibility', () => {
  const front = h('section', null, h('a', { href: '/front' }, 'Front link'));
  const back = h('section', null, h('button', null, 'Back action'));
  const initial = render(h(Flip, { front, back }));
  assert.match(initial, /<div(?=[^>]*class="inkra-flip__face inkra-flip__face--front")(?=[^>]*data-active="true")[^>]*>/);
  assert.match(initial, /<div(?=[^>]*class="inkra-flip__face inkra-flip__face--back")(?=[^>]*inert="")(?=[^>]*aria-hidden="true")[^>]*>/);
  assert.match(initial, /<a href="\/front">Front link<\/a>/);
  assert.match(initial, /<button>Back action<\/button>/);
  assert.doesNotMatch(initial, /data-flipped="true"/);

  const flipped = render(h(Flip, { flipped: true, front, back }));
  assert.match(flipped, /data-flipped="true"/);
  assert.match(flipped, /<div(?=[^>]*class="inkra-flip__face inkra-flip__face--front")(?=[^>]*inert="")(?=[^>]*aria-hidden="true")[^>]*>/);
  assert.match(flipped, /<div(?=[^>]*class="inkra-flip__face inkra-flip__face--back")(?=[^>]*data-active="true")[^>]*>/);
});

test('FlipToggle is the only built-in activator and uses native Button semantics', () => {
  const html = render(h(Flip, {
    defaultFlipped: true,
    flipEnabled: false,
    front: h(FlipToggle, null, 'Show back'),
    back: h(FlipToggle, { flipped: false }, 'Show front'),
  }));
  assert.equal((html.match(/class="inkra-button inkra-flip-toggle"/g) ?? []).length, 2);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 2);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 2);
  assert.doesNotMatch(source, /onClick=\{\(\) => setFlipped/);
});

test('Flip and Tilt CSS preserve geometry, pointer semantics and motion preferences', () => {
  assert.match(styles, /\.inkra-flip__face\s*\{[\s\S]*grid-area:\s*1 \/ 1/);
  assert.match(styles, /\.inkra-flip__face\s*\{[\s\S]*pointer-events:\s*none/);
  assert.match(styles, /\.inkra-flip__face\[data-active="true"\][\s\S]*pointer-events:\s*auto/);
  assert.match(styles, /@media \(hover: none\), \(pointer: coarse\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition:\s*none/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(styles, /scale\(|box-shadow|filter:|linear-gradient|radial-gradient/);
  assert.match(source, /event\.pointerType === 'mouse'/);
  assert.match(source, /focus\(\{ preventScroll: true \}\)/);
});
