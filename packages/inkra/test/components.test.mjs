import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('Explicit and automatic dark themes share readable pencil foregrounds', () => {
  const tokens = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
  const explicit = tokens.split('[data-inkra-theme="dark"] {')[1].split('}')[0];
  const automatic = tokens.split('@media (prefers-color-scheme: dark) {')[1].split('}')[0];
  for (const [token, value] of Object.entries({
    ink: '#f5f6ed', 'ink-muted': '#becbbb', 'ink-subtle': '#96a591',
    paper: '#191d1e', accent: '#82bdcb', 'selection-pigment': '#9bbd85',
    'success-surface': '#20372b', 'warning-surface': '#3a3020',
    'danger-surface': '#3b2727', 'info-surface': '#20343c',
    'success-foreground': '#d5efd7', 'warning-foreground': '#ffe5b3',
    'danger-foreground': '#ffd1c6', 'info-foreground': '#d8f1f5',
  })) {
    assert.ok(explicit.includes(`--inkra-${token}: ${value};`));
    assert.ok(automatic.includes(`--inkra-${token}: ${value};`));
  }
});

test('Text tiers retain distinct luminance and readable paper pairings', () => {
  const tokens = readFileSync(new URL('../src/tokens.css', import.meta.url), 'utf8');
  const luminance = hex => {
    const [r, g, b] = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return .2126 * r + .7152 * g + .0722 * b;
  };
  for (const [dark, block] of [[false, tokens.split('}')[0]], [true, tokens.split('[data-inkra-theme="dark"] {')[1].split('}')[0]]]) {
    const value = name => luminance(block.match(new RegExp(`--inkra-${name}: (#[a-f0-9]{6});`))[1]);
    const tiers = ['ink', 'ink-muted', 'ink-subtle'].map(value);
    assert.ok(dark ? tiers[0] > tiers[1] && tiers[1] > tiers[2] : tiers[0] < tiers[1] && tiers[1] < tiers[2]);
    assert.ok(Math.abs(tiers[0] - tiers[1]) >= .05);
    assert.ok(Math.abs(tiers[1] - tiers[2]) >= .04);
    for (const paper of ['paper', 'surface', 'surface-muted']) {
      const background = value(paper);
      for (const foreground of tiers) assert.ok((Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05) >= 4.5);
    }
  }
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  Button,
  ButtonGroup,
  ButtonLink,
  PencilIcon,
  PencilLine,
  PencilSurface,
  PencilText,
  createPencilPath,
} from '../dist/index.js';
import { pencilStroke } from '../dist/internal/stroke.js';
import {
  PENCIL_ACTION_WASH,
  PENCIL_FILL_WASH,
  PENCIL_QUIET_WASH,
  PENCIL_SELECTION_WASH,
  drawPencilSurface,
} from '../dist/internal/surfaceRenderer.js';
import { createPencilLinePoints, pencilLineHasDrawableSize } from '../dist/internal/line.js';

test('Button keeps native semantics while exposing pencil canvases', () => {
  const markup = renderToStaticMarkup(
    createElement(
      Button,
      {
        'aria-label': 'Save draft',
        'data-tracking-id': 'save',
        form: 'editor',
        name: 'intent',
        seed: 'save-button',
        value: 'save',
      },
      'Save',
    ),
  );

  assert.match(markup, /^<button/);
  assert.match(markup, /type="button"/);
  assert.match(markup, /aria-label="Save draft"/);
  assert.match(markup, /data-tracking-id="save"/);
  assert.match(markup, /form="editor"/);
  assert.match(markup, /name="intent"/);
  assert.match(markup, /value="save"/);
  assert.match(markup, /inkra-button__surface/);
  assert.match(markup, /inkra-pencil-surface__ink/);
  assert.match(markup, /inkra-pencil-text__source">Save<\/span>/);
  assert.doesNotMatch(markup, /inkra-pencil-surface--clipped/);
  assert.doesNotMatch(markup, /inkra-button__surface[^>]*aria-hidden/);
  assert.doesNotMatch(markup, /<svg/);
});

test('Ghost buttons separate the hover wash from the hidden border without clipping content or focus', () => {
  for (const Component of [Button, ButtonLink]) {
    for (const disabled of [false, true]) {
      const markup = renderToStaticMarkup(createElement(Component, { variant: 'ghost', disabled, href: '/notes' }, 'Notes'));
      assert.match(markup, /inkra-pencil-surface--quiet inkra-pencil-surface--clipped inkra-button__surface/);
      assert.equal((markup.match(/inkra-pencil-surface__border/g) ?? []).length, 1);
      assert.equal((markup.match(/inkra-button__focus-ring/g) ?? []).length, 1);
      assert.match(markup, /inkra-pencil-text__source">Notes<\/span>/);
    }
  }
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.inkra-button\[data-variant="ghost"\] > \.inkra-button__surface > \.inkra-pencil-surface__border\s*\{\s*display: none;/);
  assert.match(styles, /\.inkra-button\[data-variant="ghost"\] > \.inkra-button__surface > \.inkra-pencil-surface__content\s*\{\s*clip-path: none;/);
  assert.match(styles, /\.inkra-button\[data-variant="ghost"\]:hover[^{}]+\.inkra-button__surface\[data-pencil-fallback="true"\][^{]*\{\s*background: var\(--inkra-surface-muted\);\s*border-color: transparent;/);
  assert.match(styles, /\.inkra-button:focus-visible > \.inkra-button__focus-ring\s*\{\s*opacity: 1;/);
});

test('Button exposes every variant, size, icon slot and native form override', () => {
  const variants = ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'];
  const sizes = ['xs', 'sm', 'md', 'lg', 'icon-xs', 'icon-sm', 'icon', 'icon-lg'];

  for (const variant of variants) {
    const markup = renderToStaticMarkup(createElement(Button, { variant }, variant));
    assert.match(markup, new RegExp(`data-variant="${variant}"`));
    if (variant === 'ghost') assert.equal((markup.match(/inkra-pencil-surface__border/g) ?? []).length, 1);
  }

  for (const size of sizes) {
    const markup = renderToStaticMarkup(createElement(Button, { 'aria-label': size, size }));
    assert.match(markup, new RegExp(`data-size="${size}"`));
  }

  const icon = createElement('svg', { 'data-icon': 'arrow' });
  const composed = renderToStaticMarkup(createElement(Button, {
    className: 'consumer-class',
    endIcon: icon,
    form: 'checkout',
    startIcon: icon,
    style: { marginInlineStart: 4 },
    type: 'submit',
  }, 'Continue'));

  assert.match(composed, /^<button/);
  assert.match(composed, /class="inkra-button consumer-class"/);
  assert.match(composed, /style="margin-inline-start:4px"/);
  assert.match(composed, /form="checkout"/);
  assert.match(composed, /type="submit"/);
  assert.match(composed, /inkra-button__icon--start/);
  assert.match(composed, /inkra-button__icon--end/);
  assert.equal((composed.match(/aria-hidden="true" class="inkra-button__icon/g) ?? []).length, 2);

  const oversizedIcon = renderToStaticMarkup(createElement(Button, {
    'aria-label': 'Add item',
    size: 'icon-xs',
    startIcon: createElement(PencilIcon, {
      paths: [{ d: 'M 8 20 L 32 20 M 20 8 L 20 32' }],
      size: 28,
    }),
  }));
  assert.match(oversizedIcon, /data-size="icon-xs"/);
  assert.match(oversizedIcon, /inkra-button__icon--start/);
  assert.match(oversizedIcon, /style="width:28px;height:28px"/);
});

test('Button preserves its DOM label and disables interaction while loading', () => {
  const disabled = renderToStaticMarkup(createElement(Button, { disabled: true }, 'Delete'));
  const loading = renderToStaticMarkup(createElement(Button, { loading: true }, 'Save'));

  assert.match(disabled, /disabled=""/);
  assert.match(loading, /disabled=""/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /aria-label="Save"/);
  assert.match(loading, /data-loading="true"/);
  assert.match(loading, /inkra-pencil-text__source">Save<\/span>/);
  assert.match(loading, /inkra-button__spinner/);
});

test('ButtonLink retains anchor semantics and removes navigation when disabled', () => {
  const enabled = renderToStaticMarkup(createElement(ButtonLink, {
    className: 'docs-link',
    href: '/components/button',
    variant: 'link',
  }, 'Button docs'));
  const disabled = renderToStaticMarkup(createElement(ButtonLink, {
    disabled: true,
    href: '/dangerous-navigation',
  }, 'Unavailable'));
  const loading = renderToStaticMarkup(createElement(ButtonLink, {
    href: '/pending',
    loading: true,
  }, 'Pending'));

  assert.match(enabled, /^<a/);
  assert.match(enabled, /href="\/components\/button"/);
  assert.match(enabled, /class="inkra-button docs-link"/);
  assert.doesNotMatch(enabled, /role="button"/);
  assert.match(disabled, /^<a/);
  assert.match(disabled, /aria-disabled="true"/);
  assert.match(disabled, /tabindex="-1"/);
  assert.doesNotMatch(disabled, /href=/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /aria-disabled="true"/);
  assert.doesNotMatch(loading, /href=/);
});

test('ButtonGroup is a labelled group without toolbar keyboard semantics', () => {
  const group = renderToStaticMarkup(createElement(
    ButtonGroup,
    { 'aria-label': 'Editor actions', orientation: 'vertical' },
    createElement(Button, null, 'Save'),
    createElement(ButtonLink, { href: '/preview' }, 'Preview'),
  ));

  assert.match(group, /^<div/);
  assert.match(group, /role="group"/);
  assert.match(group, /aria-label="Editor actions"/);
  assert.match(group, /data-orientation="vertical"/);
  assert.doesNotMatch(group, /role="toolbar"/);
  assert.equal((group.match(/<button/g) ?? []).length, 1);
  assert.equal((group.match(/<a /g) ?? []).length, 1);
  assert.equal((group.match(/inkra-button-group__divider/g) ?? []).length, 2);
  assert.match(group, /inkra-pencil-surface--outline inkra-button-group/);
});

test('Button layout and loading props preserve native labels and reserved icon slots', () => {
  for (const Component of [Button, ButtonLink]) {
    for (const position of ['start', 'center', 'end']) {
      const options = { fullWidth: true, align: 'end', loadingPosition: position, loadingIndicator: createElement('i', { 'data-custom-loader': true }), href: Component === ButtonLink ? '/next' : undefined };
      const idle = renderToStaticMarkup(createElement(Component, options, 'Save'));
      const busy = renderToStaticMarkup(createElement(Component, { ...options, loading: true }, 'Save'));
      assert.match(busy, /data-full-width="true"/);
      assert.match(busy, /data-align="end"/);
      assert.match(busy, /data-custom-loader="true"/);
      assert.match(busy, /aria-busy="true"/);
      assert.match(busy, /inkra-pencil-text__source">Save<\/span>/);
      assert.doesNotMatch(busy, /loadingPosition=|loadingIndicator=|fullWidth=/);
      if (position !== 'center') {
        assert.match(idle, /data-loading-slot="true"/);
        assert.match(busy, /data-loading-slot="true"/);
      }
    }
  }
  const icon = renderToStaticMarkup(createElement(Button, { size: 'icon', fullWidth: true, loadingPosition: 'end', loading: true, 'aria-label': 'Save' }));
  assert.match(icon, /data-loading-position="center"/);
  assert.doesNotMatch(icon, /data-full-width/);
});

test('ButtonGroup shares appearance and size while enforcing group disablement', () => {
  const html = renderToStaticMarkup(createElement(ButtonGroup, { size: 'sm', variant: 'outline', disabled: true, fullWidth: true, equalWidth: true },
    createElement(Button, { disabled: false }, 'Save'),
    createElement(ButtonLink, { href: '/next', size: 'lg', variant: 'link', disabled: false }, 'Next'),
  ));
  assert.match(html, /data-equal-width="true"/);
  assert.match(html, /data-full-width="true"/);
  assert.match(html, /data-size="sm"/);
  assert.match(html, /data-size="lg"/);
  assert.match(html, /data-variant="outline"/);
  assert.match(html, /data-variant="link"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /tabindex="-1"/);
  assert.doesNotMatch(html, /href=/);
});

test('Surface renderer reports an unavailable context so the component can fall back and retry', () => {
  const unavailableCanvas = {
    height: 0,
    width: 0,
    getContext() { return null; },
  };

  assert.throws(() => drawPencilSurface(
    unavailableCanvas,
    null,
    120,
    44,
    'action',
    71,
    1,
    { paper: '#fcfcfa', dark: false, ink: '#234e39', wash: '#2e634a' },
  ), /Canvas 2D is unavailable/);
});

test('Surface radius changes pencil geometry without leaking a DOM attribute', () => {
  const context = new Proxy({}, { get: (target, key) => key in target ? target[key] : () => {} });
  const canvas = { width: 0, height: 0, getContext: () => context };
  const theme = { paper: '#ffffff', dark: false, ink: '#293d33', wash: '#4b96aa' };
  const draw = radius => drawPencilSurface(canvas, null, 128, 72, 'outline', 23, 1, theme, radius);
  const square = draw(0);
  assert.deepEqual(square[0], [125.5, 2.5]);
  assert.notDeepEqual(square, draw(3));
  assert.notDeepEqual(draw(3), draw(6));
  assert.deepEqual(draw(8), draw(100));
  assert.deepEqual(draw(-1), square);
  assert.deepEqual(draw(undefined), draw(Number.NaN));
  const markup = renderToStaticMarkup(createElement(PencilSurface, { radius: 3 }, 'Radius'));
  assert.doesNotMatch(markup, / radius=/);
});

test('Surface stroke settings preserve default outlines and customize weight and roughness', () => {
  const renderOutline = settings => {
    const commands = [];
    const context = new Proxy({ globalAlpha: 1 }, {
      get: (target, key) => key in target ? target[key] : (...args) => commands.push([key, ...args]),
      set: (target, key, value) => { target[key] = value; commands.push([key, value]); return true; },
    });
    const canvas = { width: 0, height: 0, getContext: () => context };
    drawPencilSurface(canvas, null, 100, 44, 'outline', 23, 1, {
      paper: '#ffffff', dark: false, ink: '#293d33', wash: '#4b96aa', ...settings,
    });
    return commands;
  };
  const original = renderOutline({});
  assert.deepEqual(renderOutline({ strokeWidth: 2, strokeRoughness: 1.5 }), original);
  assert.notDeepEqual(renderOutline({ strokeWidth: 3 }), original);
  assert.notDeepEqual(renderOutline({ strokeRoughness: 2 }), original);
});

test('Pencil primitives render readable SSR markup before browser enhancement', () => {
  const surface = renderToStaticMarkup(
    createElement(PencilSurface, { as: 'section', seed: 'surface', variant: 'action' }, 'Content'),
  );
  const text = renderToStaticMarkup(
    createElement(PencilText, { as: 'strong', ellipsis: true, seed: 'text', title: 'Custom title' }, 'Searchable text'),
  );
  const icon = renderToStaticMarkup(createElement(PencilIcon, {
    paths: [{ d: 'M 8 8 L 24 24 M 24 8 L 8 24' }],
    seed: 'close',
  }));
  const line = renderToStaticMarkup(createElement(PencilLine, { seed: 'divider' }));

  assert.match(surface, /^<section/);
  assert.match(surface, />Content<\/section>$/);
  assert.match(text, /^<strong/);
  assert.match(text, /title="Custom title"/);
  assert.match(text, /inkra-pencil-text__source">Searchable text<\/span>/);
  assert.match(icon, /^<canvas/);
  assert.match(icon, /aria-hidden="true"/);
  assert.match(line, /^<canvas/);
  assert.match(line, /data-renderer="inkra-pressure-pencil"/);
});

test('Composite icons expose one semantic image without leaking badge props to DOM', () => {
  const paths = [{ d: 'M 2 12 H 22' }];
  const markup = renderToStaticMarkup(createElement(PencilIcon, {
    paths, badge: { paths, scale: 0.55, position: 'bottom-end' },
    decorative: false, 'aria-label': 'Add folder', dir: 'rtl', size: 48, strokeWidth: 1.2, intensity: 0.5, breaks: 0.8, breakCount: 3, pressureVariation: 0.6,
  }));
  assert.equal((markup.match(/<canvas/g) ?? []).length, 1);
  assert.match(markup, /role="img"/);
  assert.match(markup, /aria-label="Add folder"/);
  assert.match(markup, /data-composite="true"/);
  assert.match(markup, /dir="rtl"/);
  assert.match(markup, /width:48px;height:48px/);
  assert.doesNotMatch(markup, / badge=| paths=| scale=| position=|strokeWidth=|intensity=|breaks=|breakCount=|pressureVariation=|aria-hidden/);
  const empty = renderToStaticMarkup(createElement(PencilIcon, { paths, badge: { paths: [] } }));
  assert.doesNotMatch(empty, /data-composite/);
  assert.match(empty, /aria-hidden="true"/);
});

test('Surface washes preserve pencil geometry with readability-adjusted theme strengths', () => {
  const selection = renderToStaticMarkup(
    createElement(PencilSurface, { seed: 'selected-tab', variant: 'selection' }, 'Selected'),
  );

  assert.deepEqual(PENCIL_ACTION_WASH, {
    lightStrength: 0.15,
    darkStrength: 0.09,
  });
  assert.deepEqual(PENCIL_QUIET_WASH, {
    lightStrength: 0.12,
    darkStrength: 0.08,
  });
  assert.equal(PENCIL_FILL_WASH.angle, -45);
  for (const key of Object.keys(PENCIL_FILL_WASH)) {
    assert.equal(PENCIL_FILL_WASH[key], PENCIL_SELECTION_WASH[key]);
  }
  assert.deepEqual(PENCIL_SELECTION_WASH, {
    angle: -45,
    lightStrength: 0.15,
    darkStrength: 0.09,
    spacing: 2,
    roughness: 3,
    inset: 2,
    radius: 8,
    edgeReach: 0,
  });
  assert.match(selection, /inkra-pencil-surface--selection/);
  assert.match(selection, />Selected<\/div>$/);
});

test('Button focus uses a pencil contour with a forced-colors fallback', () => {
  const html = renderToStaticMarkup(createElement(Button, null, 'Edit'));
  assert.match(html, /aria-hidden="true" class="[^"]*inkra-button__focus-ring/);
  const styles = readFileSync(new URL('../dist/styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.inkra-button:focus-visible\s*\{\s*outline: 0/);
  assert.match(styles, /\.inkra-button:focus-visible > \.inkra-button__focus-ring\s*\{\s*opacity: 1/);
  assert.match(styles, /forced-colors: active[\s\S]*?\.inkra-button:focus-visible\s*\{\s*outline: var\(--inkra-focus-width\) solid Highlight/);
});

test('PencilLine defaults horizontal and exposes a vertical SSR contract', () => {
  const horizontal = renderToStaticMarkup(createElement(PencilLine, { seed: 'horizontal' }));
  const vertical = renderToStaticMarkup(createElement(PencilLine, {
    className: 'sidebar-divider',
    orientation: 'vertical',
    seed: 'vertical',
  }));

  assert.match(horizontal, /data-orientation="horizontal"/);
  assert.match(vertical, /data-orientation="vertical"/);
  assert.match(vertical, /sidebar-divider/);
  assert.match(vertical, /data-renderer="inkra-pressure-pencil"/);
});

test('PencilLine samples directly along the selected axis', () => {
  const horizontal = createPencilLinePoints(120, 8, 'horizontal', 0.6);
  const vertical = createPencilLinePoints(8, 120, 'vertical', 0.6);

  assert.deepEqual(horizontal[0], [2, 4]);
  assert.deepEqual(horizontal.at(-1), [118, 4]);
  assert.ok(Math.abs(horizontal[1][0] - 40.8) < 1e-9);
  assert.notEqual(horizontal[1][1], horizontal[2][1]);
  assert.deepEqual(vertical[0], [4, 2]);
  assert.deepEqual(vertical.at(-1), [4, 118]);
  assert.ok(Math.abs(vertical[1][1] - 40.8) < 1e-9);
  assert.notEqual(vertical[1][0], vertical[2][0]);
  assert.equal(pencilLineHasDrawableSize(2, 120, 'vertical'), true);
  assert.equal(pencilLineHasDrawableSize(120, 2, 'horizontal'), true);
  assert.equal(pencilLineHasDrawableSize(120, 2, 'vertical'), false);
  assert.equal(pencilLineHasDrawableSize(2, 120, 'horizontal'), false);
});

function recordingContext() {
  const operations = [];
  const context = {
    globalAlpha: 1,
    lineCap: 'butt',
    lineWidth: 1,
    strokeStyle: '',
    beginPath() { operations.push(['begin']); },
    lineTo(x, y) { operations.push(['line', x.toFixed(4), y.toFixed(4)]); },
    moveTo(x, y) { operations.push(['move', x.toFixed(4), y.toFixed(4)]); },
    restore() { operations.push(['restore']); },
    save() { operations.push(['save']); },
    stroke() { operations.push(['stroke', this.globalAlpha.toFixed(4), this.lineWidth.toFixed(4)]); },
  };
  return { context, operations };
}

test('Pressure-pencil deposits are deterministic for a seed', () => {
  const draw = seed => {
    const { context, operations } = recordingContext();
    pencilStroke(context, [[0, 4], [40, 3], [80, 5], [100, 4]], '#234e39', 1.2, seed, 0.6, 3, false, {
      variation: 0.82,
      breaks: 0.18,
      grain: 0.68,
      gain: 2.6,
      step: 0.5,
    });
    return operations;
  };

  assert.deepEqual(draw(71), draw(71));
  assert.notDeepEqual(draw(71), draw(72));
  assert.ok(draw(71).length > 100);
});

test('Legacy path helper remains deterministic', () => {
  const first = createPencilPath({ seed: 'stable', width: 100, height: 8 });
  const second = createPencilPath({ seed: 'stable', width: 100, height: 8 });
  const other = createPencilPath({ seed: 'other', width: 100, height: 8 });

  assert.equal(first, second);
  assert.notEqual(first, other);
});

test('Built styles and font assets expose the real pencil enhancement', () => {
  const styles = readFileSync(new URL('../dist/styles.css', import.meta.url), 'utf8');
  const tokens = readFileSync(new URL('../dist/tokens.css', import.meta.url), 'utf8');
  const buttonImplementation = readFileSync(new URL('../dist/Button.js', import.meta.url), 'utf8');
  const lineImplementation = readFileSync(new URL('../dist/PencilLine.js', import.meta.url), 'utf8');
  const surfaceImplementation = readFileSync(new URL('../dist/internal/surfaceRenderer.js', import.meta.url), 'utf8');

  assert.match(styles, /@font-face/);
  assert.match(styles, /ui-hand-yozai\.woff2/);
  assert.match(styles, /\.inkra-button\s*\{[\s\S]*?background: transparent/);
  assert.doesNotMatch(styles, /repeating-linear-gradient/);
  assert.match(styles, /\.inkra-button\s*\{[\s\S]*?min-height: var\(--inkra-touch-target\)[\s\S]*?padding: 0;/);
  assert.match(styles, /\.inkra-button__surface\s*\{[\s\S]*?height: var\(--inkra-button-visual-height\)[\s\S]*?padding: 0 var\(--inkra-button-visual-padding\)[\s\S]*?pointer-events: none/);
  assert.match(styles, /data-size="xs"[\s\S]*?--inkra-control-xs, 32px[\s\S]*?--inkra-space-3[\s\S]*?--inkra-text-xs/);
  assert.match(styles, /data-size="sm"[\s\S]*?--inkra-control-sm[\s\S]*?--inkra-space-4[\s\S]*?--inkra-text-sm/);
  assert.match(styles, /--inkra-button-visual-height: var\(--inkra-control-md\)[\s\S]*?--inkra-button-visual-padding: var\(--inkra-space-5\)[\s\S]*?--inkra-button-font-size: var\(--inkra-text-md\)/);
  assert.match(styles, /data-size="lg"[\s\S]*?--inkra-control-lg[\s\S]*?--inkra-space-6[\s\S]*?--inkra-text-lg/);
  assert.match(styles, /data-size\^="icon"[\s\S]*?padding-inline: 0[\s\S]*?width: var\(--inkra-button-visual-height\)/);
  assert.match(styles, /\.inkra-button__icon-content > :is\(svg, canvas\)[\s\S]*?height: 100% !important[\s\S]*?width: 100% !important/);
  assert.match(styles, /\.inkra-button:focus-visible\s*\{/);
  assert.match(styles, /transition: opacity 200ms cubic-bezier\(0\.4, 0, 0\.2, 1\)/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*?\.inkra-button__surface > \.inkra-pencil-surface__ink[\s\S]*?transition-duration: 0ms/);
  assert.doesNotMatch(styles, /filter: contrast\(1\.08\)/);
  assert.doesNotMatch(styles, /\.inkra-button \.inkra-pencil-text\[data-pencil-ready="true"\]/);
  assert.match(styles, /\.inkra-pencil-text\[data-pencil-ready="true"\] > \.inkra-pencil-text__source\s*\{\s*color: transparent;/);
  assert.match(styles, /\.inkra-pencil-text\[data-pencil-ready="true"\] canvas\s*\{\s*display: block;/);
  assert.match(styles, /forced-colors: active[\s\S]*?\.inkra-pencil-text\[data-pencil-ready="true"\] > \.inkra-pencil-text__source\s*\{\s*color: inherit;/);
  assert.match(styles, /data-variant="ghost"[\s\S]*?data-pencil-fallback="true"[\s\S]*?background: transparent/);
  assert.match(styles, /forced-colors: active[\s\S]*?data-variant="link"[\s\S]*?text-decoration-line: underline/);
  assert.match(renderToStaticMarkup(createElement(Button, { variant: 'link' }, 'Details')), /inkra-button__underline/);
  assert.match(renderToStaticMarkup(createElement(ButtonLink, { variant: 'link', href: '#details' }, 'Details')), /inkra-button__underline/);
  assert.match(styles, /data-variant="destructive"[\s\S]*?--inkra-on-danger/);
  assert.match(styles, /data-loading="true"[\s\S]*?opacity: 0/);
  assert.match(styles, /\.inkra-button-group\s*\{[^}]*gap: 0/);
  assert.match(styles, /data-orientation="vertical"[\s\S]*?flex-direction: column/);
  assert.doesNotMatch(styles, /\.inkra-button::(?:before|after)/);
  assert.match(tokens, /--inkra-text-xs: 12px/);
  assert.match(tokens, /--inkra-text-sm: 13px/);
  assert.match(tokens, /--inkra-text-md: 15px/);
  assert.match(tokens, /--inkra-text-lg: 17px/);
  assert.match(tokens, /--inkra-control-xs: 32px/);
  assert.match(tokens, /--inkra-control-sm: 36px/);
  assert.match(tokens, /--inkra-control-md: 44px/);
  assert.match(tokens, /--inkra-control-lg: 48px/);
  assert.match(tokens, /--inkra-icon-xs: 14px/);
  assert.match(styles, /--inkra-selection-foreground, #244b37/);
  assert.match(styles, /--inkra-selection-foreground, #e5e2cf/);
  assert.match(styles, /\.inkra-pencil-surface\s*\{[\s\S]*?isolation: isolate/);
  assert.match(styles, /\.inkra-pencil-surface > \.inkra-pencil-surface__ink\s*\{[\s\S]*?z-index: -1/);
  assert.match(styles, /\.inkra-pencil-surface__content\s*\{[\s\S]*?z-index: 1/);
  assert.match(styles, /\.inkra-pencil-surface > \.inkra-pencil-surface__border\s*\{[\s\S]*?z-index: 2/);
  assert.match(styles, /data-orientation="horizontal"\][\s\S]*?height: 8px;[\s\S]*?width: 100%/);
  assert.match(styles, /data-orientation="vertical"\][\s\S]*?height: 100%;[\s\S]*?width: 8px/);
  assert.match(styles, /@media \(forced-colors: active\), print[\s\S]*?\.inkra-pencil-line\s*\{[\s\S]*?background: CanvasText/);
  assert.match(styles, /data-orientation="horizontal"\][\s\S]*?height: 1px/);
  assert.match(styles, /data-orientation="vertical"\][\s\S]*?width: 1px/);
  assert.match(lineImplementation, /PENCIL_RENDERER_VERSION, orientation, width, height/);
  assert.match(lineImplementation, /\[orientation, roughness, seed, weight\]/);
  assert.match(buttonImplementation, /interactionDisabled \? undefined : href/);
  assert.match(buttonImplementation, /event\.preventDefault\(\)/);
  assert.match(buttonImplementation, /event\.stopPropagation\(\)/);
  assert.match(buttonImplementation, /onAuxClick: handleAuxClick/);
  assert.doesNotMatch(buttonImplementation, /role: "button"/);
  assert.match(surfaceImplementation, /danger: \{ radius: 7, width: 0\.75, passes: 2, strength: 0\.18 \}/);
  assert.match(surfaceImplementation, /lightStrength: 0\.15/);
  assert.match(surfaceImplementation, /darkStrength: 0\.09/);
  assert.ok(existsSync(new URL('../dist/assets/ui-hand-yozai.woff2', import.meta.url)));
  assert.ok(existsSync(new URL('../Yozai-OFL.txt', import.meta.url)));
});
