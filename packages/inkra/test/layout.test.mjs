import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { Container, Flex, Grid, Layout, Stack } = await import(process.env.INKRA_LAYOUT_MODULE || '../dist/layout/index.js');
const render = (component, props, ...children) => renderToStaticMarkup(h(component, props, ...children));

test('Flex and Stack share token spacing and preserve semantic attributes', () => {
  const flex = render(Flex, { as: 'nav', gap: 5, align: 'center', justify: 'between', wrap: true, dir: 'rtl', 'aria-label': 'Tools' }, 'content');
  assert.match(flex, /^<nav/);
  assert.match(flex, /dir="rtl"/);
  assert.match(flex, /aria-label="Tools"/);
  assert.match(flex, /flex-direction:row/);
  assert.match(flex, /gap:var\(--inkra-space-5, 20px\)/);
  assert.match(flex, /align-items:center/);
  assert.match(flex, /justify-content:space-between/);
  assert.match(flex, /flex-wrap:wrap/);
  const stack = render(Stack, { as: 'ol', gap: 0 }, h('li', null, 'First'), h('li', null, 'Second'));
  assert.match(stack, /^<ol/);
  assert.match(stack, /flex-direction:column/);
  assert.match(stack, /<li>First<\/li><li>Second<\/li>/);
  assert.doesNotMatch(flex, / gap=| align=| justify=| wrap=/);
});

test('Grid bounds column counts and carries omitted responsive values forward', () => {
  const grid = render(Grid, { columns: { base: 2, md: 3, lg: 30 }, rowGap: 5, columnGap: 2 });
  assert.match(grid, /--inkra-grid-base:2/);
  assert.match(grid, /--inkra-grid-sm:2/);
  assert.match(grid, /--inkra-grid-md:3/);
  assert.match(grid, /--inkra-grid-lg:12/);
  assert.match(grid, /row-gap:var\(--inkra-space-5, 20px\)/);
  assert.match(grid, /column-gap:var\(--inkra-space-2, 8px\)/);
  assert.match(render(Grid, { columns: NaN }), /--inkra-grid-base:1/);
  assert.match(render(Grid, { columns: 0 }), /--inkra-grid-base:1/);
  assert.match(render(Grid, { columns: 2.5 }), /--inkra-grid-base:2/);
  assert.doesNotMatch(grid, / columns=| rowGap=| columnGap=/);
});

test('Container constrains width without adding block spacing', () => {
  const container = render(Container, { as: 'article', size: 'sm', centered: false, padding: 4 });
  assert.match(container, /^<article/);
  assert.match(container, /max-width:640px/);
  assert.match(container, /padding-inline:var\(--inkra-space-4, 16px\)/);
  assert.match(container, /margin-inline:0/);
  assert.doesNotMatch(container, /padding-block|margin-block/);
  assert.match(render(Container, { size: 'full' }), /max-width:none/);
});

test('Layout exposes regions without creating an unexpected main landmark', () => {
  const layout = render(Layout.Root, { collapseAt: 'md', gap: 2 },
    h(Layout.Header, { divided: true }, 'Header'),
    h(Layout.Body, null,
      h(Layout.Sidebar, { width: 180, divided: true }, 'Sidebar'),
      h(Layout.Content, { padding: 0 }, 'Content')),
    h(Layout.Footer, { divided: true }, 'Footer'));
  assert.match(layout, /data-collapse-at="md"/);
  assert.match(layout, /<header/);
  assert.match(layout, /<aside/);
  assert.match(layout, /<footer/);
  assert.match(layout, /--inkra-layout-sidebar-width:180px/);
  assert.match(layout, /inkra-layout__sidebar-divider/);
  assert.doesNotMatch(layout, /<main/);
  assert.match(render(Layout.Content, { as: 'main' }, 'Main'), /^<main/);
  assert.doesNotMatch(render(Layout.Header, {}, 'Header'), /inkra-layout__divider/);
});

test('Native style overrides remain available without replacing custom classes', () => {
  const flex = render(Flex, { className: 'consumer', gap: 2, style: { gap: 7 } });
  assert.match(flex, /class="inkra-flex consumer"/);
  assert.match(flex, /gap:7px/);
});
