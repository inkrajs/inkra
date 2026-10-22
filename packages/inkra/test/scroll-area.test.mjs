import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';

const source = readFileSync(new URL('../src/scroll-area/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/scroll-area/styles.css', import.meta.url), 'utf8');

test('ScrollArea delegates scroll geometry and input mechanics to Base UI', () => {
  assert.match(source, /from '@base-ui\/react\/scroll-area'/);
  assert.match(source, /ScrollAreaPrimitive\.Viewport/);
  assert.match(source, /ScrollAreaPrimitive\.Scrollbar/);
  assert.match(source, /ScrollAreaPrimitive\.Thumb/);
  assert.match(source, /ScrollAreaPrimitive\.Corner/);
  assert.doesNotMatch(source, /setPointerCapture|pointermove|clientX|clientY|requestAnimationFrame|scrollTop\s*=/);
});

test('ScrollArea exposes the bounded two-axis and visibility contract', () => {
  assert.match(source, /type ScrollAreaVisibility = 'auto' \| 'always'/);
  assert.match(source, /orientation="vertical"/);
  assert.match(source, /orientation="horizontal"/);
  assert.match(source, /overflowEdgeThreshold/);
  assert.match(source, /data-type=\{type\}/);
  assert.match(styles, /data-type="always"/);
  assert.match(styles, /:hover .*inkra-scroll-area__scrollbar/);
  assert.match(styles, /:focus-within .*inkra-scroll-area__scrollbar/);
});

test('ScrollArea styles hide only the local viewport scrollbar and preserve fallback modes', () => {
  assert.match(styles, /\.inkra-scroll-area__viewport::-webkit-scrollbar/);
  assert.match(styles, /scrollbar-width: none/);
  assert.match(styles, /overscroll-behavior: contain/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /@media print/);
  assert.doesNotMatch(styles, /html\s*\{|body\s*\{|:root\s*\{/);
});

test('ScrollArea keeps readable SSR markup without browser globals', async t => {
  let module;
  try {
    module = await import('../dist/scroll-area/index.js');
  } catch {
    t.skip('Run after integration builds the package.');
    return;
  }
  const markup = render(h(module.ScrollArea, {
    'aria-label': 'Document preview',
    viewportLabel: 'Scrollable document preview',
    type: 'always',
  }, h('p', null, 'Readable content')));
  assert.match(markup, /Scrollable document preview/);
  assert.match(markup, /Readable content/);
  assert.match(markup, /data-type="always"/);
  assert.doesNotMatch(markup, /(?:window|document)\s*[.[]/);
});
