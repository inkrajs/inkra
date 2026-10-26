import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = new URL('../src/loading/index.tsx', import.meta.url);
const styleUrl = new URL('../src/loading/styles.css', import.meta.url);
const localeUrl = new URL('../src/loading/locales.ts', import.meta.url);

test('Loading keeps business status, progress and timed presence separate', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  assert.match(source, /status\?: LoadingStatus/);
  assert.match(source, /progress\?: number \| null/);
  assert.match(source, /active\?: boolean/);
  assert.match(source, /delay\?: number/);
  assert.match(source, /minDuration\?: number/);
  assert.doesNotMatch(source, /setStatus|progress\s*>=\s*resolvedMax/);
});

test('Loading exposes pencil-rendered animations without duplicating honest progress', async () => {
  const [source, styles] = await Promise.all([readFile(sourceUrl, 'utf8'), readFile(styleUrl, 'utf8')]);
  assert.match(source, /export type LoadingAnimation = 'progress' \| 'orbit' \| 'dots' \| 'pulse' \| 'trail'/);
  assert.match(source, /animation\?: LoadingAnimation/);
  assert.match(source, /animation = 'progress'/);
  assert.match(source, /data-animation=\{animation\}/);
  assert.match(source, /showCustomAnimation = animation !== 'progress'[\s\S]*progress === undefined \|\| progress === null/);
  assert.match(source, /showProgress = progress !== undefined[\s\S]*animation === 'progress' \|\| progress !== null/);
  assert.match(source, /role="progressbar"/);
  assert.match(source, /LoadingAnimationVisual animation=\{animation\}/);
  assert.match(source, /<PencilSurface[\s\S]*variant=\{animation === 'pulse' \? 'outline' : 'quiet'\}/);
  assert.match(source, /<PencilLine[\s\S]*inkra-loading__animation-mark/);
  assert.doesNotMatch(source, /<span className="inkra-loading__animation-mark"/);
  assert.match(source, /showProgress \? <Progress/);
  assert.doesNotMatch(styles, /\.inkra-loading__animation-mark\s*\{[^}]*background:/s);
  assert.doesNotMatch(styles, /\.inkra-loading__animation-mark\s*\{[^}]*border:/s);
  for (const animation of ['orbit', 'dots', 'pulse', 'trail']) {
    assert.match(styles, new RegExp(`data-animation="${animation}"`));
    assert.match(styles, new RegExp(`inkra-loading-${animation === 'dots' ? 'dot' : animation}`));
  }
  assert.match(styles, /@keyframes inkra-loading-orbit \{ to \{ transform: rotate\(360deg\); \} \}/);
  assert.match(styles, /@keyframes inkra-loading-dot \{[^\n]+opacity:[^\n]+transform:[^\n]+\}/);
  assert.match(styles, /@keyframes inkra-loading-pulse \{[^\n]+opacity:[^\n]+transform:[^\n]+\}/);
  assert.match(styles, /@keyframes inkra-loading-trail \{[^\n]+opacity:[^\n]+transform:[^\n]+\}/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*inkra-loading__animation[\s\S]*animation: none !important/);
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

test('Loading registers public exports, styles and its direct runtime dependency', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const barrel = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
  const styleBuild = await readFile(new URL('../scripts/copy-styles.mjs', import.meta.url), 'utf8');
  assert.equal(manifest.dependencies['react-aria'], '3.53.1');
  assert.equal(manifest.exports['./loading'].import, './dist/loading/index.js');
  assert.equal(manifest.exports['./loading'].types, './dist/loading/index.d.ts');
  assert.equal(manifest.exports['./styles/loading.css'], './dist/styles/loading.css');
  assert.match(barrel, /export \* from '\.\/loading\/index\.js'/);
  assert.match(styleBuild, /'loading\/styles\.css'/);
});
