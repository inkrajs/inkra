import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  isTypewriterPunctuation,
  splitTypewriterGraphemes,
  typewriterDelayAfter,
} from '../src/typewriter/model.ts';

const source = readFileSync(new URL('../src/typewriter/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/typewriter/styles.css', import.meta.url), 'utf8');

test('Typewriter segments Unicode grapheme clusters without splitting emoji or combining text', () => {
  assert.deepEqual(
    splitTypewriterGraphemes('A👩🏽‍💻中e\u0301🇨🇳'),
    ['A', '👩🏽‍💻', '中', 'e\u0301', '🇨🇳'],
  );
  assert.deepEqual(splitTypewriterGraphemes('你好，世界。'), ['你', '好', '，', '世', '界', '。']);
});

test('punctuation receives an additive pause and invalid durations are safely clamped', () => {
  assert.equal(isTypewriterPunctuation('。'), true);
  assert.equal(isTypewriterPunctuation('!'), true);
  assert.equal(isTypewriterPunctuation('中'), false);
  assert.equal(typewriterDelayAfter('。', { speed: 40, punctuationDelay: 220 }), 260);
  assert.equal(typewriterDelayAfter('中', { speed: 40, punctuationDelay: 220 }), 40);
  assert.equal(typewriterDelayAfter('!', { speed: -10, punctuationDelay: Number.NaN }), 0);
});

test('the visual layer keeps every grapheme mounted and reveals it without repaint-driving style changes', () => {
  assert.match(source, /graphemes\.map\(\(grapheme, index\)/);
  assert.match(source, /data-revealed=\{isRevealed\}/);
  assert.match(source, /className="inkra-typewriter__grapheme"/);
  assert.doesNotMatch(source, /graphemes\.slice\(/);
  assert.doesNotMatch(source, /style=\{\{[^}]*visibility/);
  assert.match(styles, /\[data-revealed="true"\]/);
});

test('pause, resume, skip, restart, completion and reduced motion are part of the component contract', () => {
  assert.match(source, /pause: \(\) => requestPaused\(true\)/);
  assert.match(source, /resume: \(\) => requestPaused\(false\)/);
  assert.match(source, /complete: revealAll/);
  assert.match(source, /restart/);
  assert.match(source, /onCompleteRef\.current\?\.\(\)/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test('SSR markup retains final assistive content while the visual text stays selectable', () => {
  assert.match(source, /aria-hidden="true" className="inkra-typewriter__visual"/);
  assert.match(source, /className="inkra-typewriter__accessible">\{children\}/);
  assert.match(styles, /user-select:\s*text/);
  assert.match(styles, /@media print[\s\S]*visibility:\s*visible/);
  assert.match(styles, /forced-colors: active/);
  assert.doesNotMatch(source, /import ['"]\.\/styles\.css['"]/);
});
