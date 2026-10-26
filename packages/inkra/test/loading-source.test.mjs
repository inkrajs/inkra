import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = new URL('../src/loading/index.tsx', import.meta.url);
const styleUrl = new URL('../src/loading/styles.css', import.meta.url);
const localeUrl = new URL('../src/loading/locales.ts', import.meta.url);
const handoffUrl = new URL('../../../.release/loading-handoff.md', import.meta.url);

test('Loading keeps business status, progress and timed presence separate', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /status\?: LoadingStatus/);
  assert.match(source, /progress\?: number \| null/);
  assert.match(source, /active\?: boolean/);
  assert.match(source, /delay\?: number/);
  assert.match(source, /minDuration\?: number/);
  assert.doesNotMatch(source, /setStatus|progress\s*>=\s*resolvedMax/);
});

test('fullscreen blocking, focus isolation and scroll lock use mature independent primitives', async () => {
  const [source, styles] = await Promise.all([readFile(sourceUrl, 'utf8'), readFile(styleUrl, 'utf8')]);
  assert.match(source, /FocusScope/);
  assert.match(source, /ariaHideOutside/);
  assert.match(source, /usePreventScroll/);
  assert.match(source, /lockScroll \?\? effectiveBlocking/);
  assert.match(source, /restoreFocusRef/);
  assert.match(source, /document\.activeElement === document\.body/);
  assert.match(source, /target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(styles, /fullscreen[^}]*:not\(\[data-blocking\]\)[^{]*\{ pointer-events: none;/s);
  assert.match(styles, /fullscreen[^}]*> :is\(\.inkra-loading__background, \.inkra-loading__veil\)[^{]*\{[^}]*position: fixed;/s);
});

test('all layouts, scene slots and tip controls are represented without duplicate components', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  for (const preset of ['brand-center', 'scene-bottom', 'intel', 'staged', 'edge', 'skeleton']) assert.match(source, new RegExp(preset));
  for (const slot of ['top-start', 'top-end', 'center', 'bottom-start', 'bottom-center', 'bottom-end']) assert.match(source, new RegExp(slot));
  for (const behavior of ['tipOrder', 'tipInterval', 'tipAutoPlay', 'tipPaused', 'onTipPausedChange', 'tipIndex', 'onTipIndexChange', 'tipTransition']) {
    assert.match(source, new RegExp(behavior));
  }
  assert.equal((source.match(/export const Loading\s*=/g) ?? []).length, 1);
});

test('scene slots use coordinated grid rows and a short-screen natural flow without physical centering transforms', async () => {
  const styles = await readFile(styleUrl, 'utf8');
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) minmax\(0, 28rem\) minmax\(0, 1fr\)/);
  assert.match(styles, /:has\(\.inkra-loading__slot\[data-slot="center"\]\)/);
  assert.match(styles, /flex-direction: column/);
  assert.match(styles, /data-slot="bottom-center"[^}]*align-self: center[^}]*order: 6/s);
  assert.doesNotMatch(styles, /inkra-loading__slot[^}]*translateX?\(/s);
});

test('component-local copy covers five locales and remains caller-overridable', async () => {
  const locales = await readFile(localeUrl, 'utf8');
  for (const locale of ['en:', "'zh-CN':", 'ja:', 'ko:', 'fr:']) assert.match(locales, new RegExp(locale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(locales, /\.\.\.overrides/);
});

test('handoff records coordinator-owned registrations and the direct runtime dependency', async () => {
  const handoff = await readFile(handoffUrl, 'utf8');
  assert.match(handoff, /react-aria@3\.53\.1/);
  assert.match(handoff, /src\/index\.ts/);
  assert.match(handoff, /componentRoutes/);
  assert.match(handoff, /No global i18n keys are required/);
});
