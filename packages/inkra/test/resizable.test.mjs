import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';

const resizableModule = process.env.INKRA_RESIZABLE_MODULE
  ? new URL(process.env.INKRA_RESIZABLE_MODULE, import.meta.url).href
  : new URL('../dist/resizable/index.js', import.meta.url).href;

const { Resizable } = await import(resizableModule);

test('Resizable renders readable panel and separator semantics on the server', () => {
  const html = render(h(Resizable.Root, {
    id: 'workspace',
    orientation: 'horizontal',
    defaultLayout: { navigation: 30, content: 70 },
  },
  h(Resizable.Panel, { id: 'navigation', minSize: '20%', maxSize: '45%' }, h('nav', null, 'Navigation')),
  h(Resizable.Handle, { id: 'navigation-content', label: 'Resize navigation' }),
  h(Resizable.Panel, { id: 'content' }, h('main', null, 'Content')),
  ));

  assert.match(html, /data-orientation="horizontal"/);
  assert.match(html, /role="separator"/);
  assert.match(html, /aria-label="Resize navigation"/);
  assert.match(html, />Navigation</);
  assert.match(html, />Content</);
  assert.doesNotMatch(html, /window|document/);
});

test('Resizable delegates constraints, collapse and keyboard mechanics to the mature engine', () => {
  const source = readFileSync(new URL('../src/resizable/index.tsx', import.meta.url), 'utf8');
  assert.match(source, /from 'react-resizable-panels'/);
  assert.match(source, /ResizableGroupPrimitive/);
  assert.match(source, /ResizablePanelPrimitive/);
  assert.match(source, /ResizableSeparatorPrimitive/);
  assert.match(source, /group\.setLayout\(layout\)/);
  assert.match(source, /refreshControlledLayout\(\)/);
  assert.match(source, /layout\?: ResizableLayout/);
  assert.match(source, /onLayoutCommit/);
  assert.match(source, /useResizablePanelRef/);
  assert.doesNotMatch(source, /setPointerCapture|pointermove|clientX|clientY|KeyboardEvent|requestAnimationFrame/);
});

test('Resizable styles preserve stable handles and accessibility fallbacks', () => {
  const css = readFileSync(new URL('../src/resizable/styles.css', import.meta.url), 'utf8');
  assert.match(css, /flex-basis:\s*12px/);
  assert.match(css, /touch-action:\s*none/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(css, /outline:\s*2px solid Highlight/);
  assert.doesNotMatch(css, /border-radius:\s*999|background:\s*#[0-9a-f]{3,8}/i);
});
