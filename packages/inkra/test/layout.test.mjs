import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
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

test('Layout swipe configuration is opt-in behavior, not a leaked DOM attribute', () => {
  const layout = render(Layout.Root, { swipeNavigation: { enabled: true, open: false, side: 'end', onOpenChange() {} } }, 'Content');
  assert.doesNotMatch(layout, /swipeNavigation|onOpenChange|touch-action/);
  assert.match(layout, />Content<\/div>/);
});

test('Layout header and sidebar consume a shared root column without duplicating padding', () => {
  const layout = render(Layout.Root, { sidebarWidth: 286, dir: 'rtl' },
    h(Layout.Header, { sidebar: h('a', { href: '/' }, 'Brand'), sidebarDivided: true, divided: true, padding: 4 }, 'Navigation'),
    h(Layout.Body, null, h(Layout.Sidebar, { divided: true }, 'Sidebar'), h(Layout.Content, null, 'Content')));
  assert.match(layout, /--inkra-layout-shared-sidebar-width:286px/);
  assert.match(layout, /--inkra-layout-sidebar-width:var\(--inkra-layout-shared-sidebar-width, 240px\)/);
  assert.match(layout, /data-shared-sidebar="true"/);
  assert.match(layout, /--inkra-layout-header-padding:var\(--inkra-space-4, 16px\);padding:0/);
  assert.match(layout, /inkra-layout__header-sidebar-divider/);
  assert.match(layout, /inkra-layout__header-content">Navigation/);
  assert.doesNotMatch(layout, /sidebarWidth=|sidebarDivided=| sidebar=/);
  assert.match(layout, /dir="rtl"/);
  const css = readFileSync(new URL('../dist/styles/layout.css', import.meta.url), 'utf8');
  assert.match(css, /\.inkra-layout__header-sidebar \{[^}]*flex: 0 0 min\(var\(--inkra-layout-shared-sidebar-width, 240px\), 100%\)/);
  assert.match(css, /\.inkra-layout__header-sidebar-divider\[data-orientation="vertical"\] \{[^}]*inset-inline-end: 0/);
  assert.doesNotMatch(css.match(/\.inkra-layout__header-sidebar-divider\[data-orientation="vertical"\] \{[^}]*\}/)?.[0] ?? '', /\bleft:|\bright:/);
});

test('shared header separators use the quiet Tabs material with padding-aware centered geometry', () => {
  const css = readFileSync(new URL('../dist/styles/layout.css', import.meta.url), 'utf8');
  const tabs = readFileSync(new URL('../dist/styles/tabs.css', import.meta.url), 'utf8');
  const block = css.match(/\.inkra-layout__header-sidebar-divider\[data-orientation="vertical"\] \{([^}]*)\}/)?.[1];
  assert(block);
  for (const declaration of ['color: var(--inkra-ink-muted)', 'opacity: 0.56']) {
    assert(block.includes(declaration));
    assert(tabs.match(/\.inkra-tabs__divider \{([^}]*)\}/)?.[1].includes(declaration));
  }
  assert(block.includes('height: min(32px, max(0px, calc(100% - 2 * var(--inkra-layout-header-padding, 20px))))'));
  assert(block.includes('inset-block-start: 50%'));
  assert(block.includes('inset-inline-end: 0'));
  assert(block.includes('transform: translate(50%, -50%)'));
  assert.doesNotMatch(block, /\bwidth:|inset-block:|height: 100%/);
  assert.match(css, /\.inkra-layout__header-sidebar-divider\[data-orientation="vertical"\]:dir\(rtl\) \{ transform: translate\(-50%, -50%\); \}/);
  assert.match(css, /@media \(forced-colors: active\), print \{\s*\.inkra-layout__header-sidebar-divider\[data-orientation="vertical"\] \{ opacity: 1; \}/);
  for (const breakpoint of ['sm', 'md']) {
    assert(css.includes(`.inkra-layout[data-collapse-at="${breakpoint}"] > .inkra-layout__header > .inkra-layout__header-sidebar > .inkra-layout__header-sidebar-divider { display: none !important; }`));
  }
  assert.match(css, /\.inkra-layout__sidebar-divider\[data-orientation="vertical"\] \{[^}]*inset-block: 0;[^}]*inset-inline-end: -4px;[^}]*height: 100%;/);
});

test('zero shared width removes both navigation columns without unmounting their content', () => {
  for (const sidebarWidth of [0, '0px', '0%', ' 0.0rem ', -8]) {
    const layout = render(Layout.Root, { sidebarWidth },
      h(Layout.Header, { sidebar: h('button', null, 'Brand control'), sidebarDivided: true }, 'Navigation'),
      h(Layout.Body, null,
        h(Layout.Sidebar, null, h('button', null, 'Sidebar control')),
        h(Layout.Content, null, 'Content')));
    assert.match(layout, /class="inkra-layout__header-sidebar" hidden="" inert="" aria-hidden="true"/);
    assert.match(layout, /<aside hidden="" inert="" aria-hidden="true"/);
    assert.match(layout, /Brand control/);
    assert.match(layout, /Sidebar control/);
    assert.match(layout, /inkra-layout__header-content">Navigation/);
  }
  const css = readFileSync(new URL('../dist/styles/layout.css', import.meta.url), 'utf8');
  assert.match(css, /\.inkra-layout__header-sidebar\[hidden\],\s*\.inkra-layout__sidebar\[hidden\] \{ display: none; \}/);
});

test('explicit sidebar width wins and nested roots reset the shared column scope', () => {
  const layout = render(Layout.Root, { sidebarWidth: 0 },
    h(Layout.Sidebar, { width: 192, id: 'explicit' }, 'Explicit'),
    h(Layout.Root, { id: 'nested' },
      h(Layout.Header, { sidebar: 'Nested brand' }, 'Nested navigation'),
      h(Layout.Sidebar, { id: 'inherited' }, 'Nested sidebar')));
  assert.match(layout, /--inkra-layout-sidebar-width:192px/);
  assert.match(layout, /id="nested"[^>]*--inkra-layout-shared-sidebar-width:240px/);
  assert.doesNotMatch(layout, /hidden=""|inert=""|aria-hidden="true"/);
  for (const sidebarWidth of [NaN, Infinity, -Infinity]) {
    assert.match(render(Layout.Root, { sidebarWidth }), /--inkra-layout-shared-sidebar-width:240px/);
  }
  assert.match(render(Layout.Root, { sidebarWidth: '25%' }), /--inkra-layout-shared-sidebar-width:25%/);
});

test('legacy headers stay unwrapped and shared headers stack at the existing container breakpoints', () => {
  for (const sidebar of [undefined, null, false]) {
    const legacy = render(Layout.Header, { sidebar }, 'Header');
    assert.doesNotMatch(legacy, /data-shared-sidebar|inkra-layout__header-content|inkra-layout__header-sidebar/);
    assert.match(legacy, /padding:var\(--inkra-space-5, 20px\)/);
  }
  assert.doesNotMatch(render(Layout.Header, { sidebar: 'Brand' }, 'Navigation'), /inkra-layout__header-sidebar-divider/);
  const css = readFileSync(new URL('../dist/styles/layout.css', import.meta.url), 'utf8');
  for (const [breakpoint, width] of [['sm', 639], ['md', 767]]) {
    const query = css.slice(css.indexOf(`@container inkra-layout (max-width: ${width}px)`));
    assert(query.includes(`.inkra-layout[data-collapse-at="${breakpoint}"] > .inkra-layout__header[data-shared-sidebar] { flex-direction: column; }`));
    assert(query.includes(`.inkra-layout[data-collapse-at="${breakpoint}"] > .inkra-layout__header > .inkra-layout__header-sidebar { flex-basis: auto; width: 100%; }`));
  }
  assert.doesNotMatch(css, /data-collapse-at="never"/);
});
