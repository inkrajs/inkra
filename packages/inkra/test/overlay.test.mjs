import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Overlay } from '../dist/index.js';

const overlay = readFileSync(new URL('../src/overlay/Overlay.tsx', import.meta.url), 'utf8');
const popover = readFileSync(new URL('../src/overlay/Popover.tsx', import.meta.url), 'utf8');
const themeBridge = readFileSync(new URL('../src/overlay/themeBridge.tsx', import.meta.url), 'utf8');
const index = readFileSync(new URL('../src/overlay/index.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/overlay/styles.css', import.meta.url), 'utf8');

test('Overlay exposes the complete Radix-backed compound API', () => {
  for (const name of [
    'OverlayRoot',
    'OverlayTrigger',
    'OverlayPortal',
    'OverlayBackdrop',
    'OverlayContent',
    'OverlayTitle',
    'OverlayDescription',
    'OverlayClose',
    'OverlayHeader',
    'OverlayBody',
    'OverlayFooter',
    'OverlayCloseButton',
  ]) {
    assert.match(index, new RegExp(`\\b${name}\\b`));
  }

  assert.match(overlay, /from '@radix-ui\/react-dialog'/);
  assert.match(overlay, /DialogPrimitive\.Root/);
  assert.match(overlay, /DialogPrimitive\.Portal/);
  assert.match(overlay, /Object\.freeze\(\{[\s\S]*?Root: OverlayRoot[\s\S]*?Close: OverlayClose/);
});

test('Overlay sections render default separators and a named non-submitting close button', () => {
  const html = renderToStaticMarkup(h(Overlay.Root, null,
    h(Overlay.Header, { closeLabel: 'Dismiss note', 'data-owner': 'note' },
      h(Overlay.Title, null, 'Edit note'), h(Overlay.Description, null, 'Note details')),
    h(Overlay.Body, { id: 'note-body' }, 'Editable content'),
    h(Overlay.Footer, { align: 'start' }, 'Actions')));
  assert.match(html, /data-owner="note"/);
  assert.match(html, /aria-label="Dismiss note"/);
  assert.match(html, /type="button"/);
  assert.match(html, /id="note-body"/);
  assert.match(html, /data-align="start"/);
  assert.equal((html.match(/class="inkra-pencil-line inkra-overlay__section-divider"/g) ?? []).length, 2);
});

test('Overlay headers and footers can omit separators and automatic close controls', () => {
  const html = renderToStaticMarkup(h(Overlay.Root, null,
    h(Overlay.Header, { divided: false, showClose: false, action: h('button', { type: 'button' }, 'Help') }, 'Title'),
    h(Overlay.Footer, { divided: false, align: 'center' }, 'Actions')));
  assert.doesNotMatch(html, /inkra-overlay__section-divider|inkra-overlay__close-button/);
  assert.match(html, /Help/);
  assert.match(html, /data-align="center"/);
});

test('Overlay section layout keeps legacy padding opt-in and scroll ownership explicit', () => {
  assert.match(overlay, /layout = 'plain'/);
  assert.match(styles, /data-layout="sections"[\s\S]*?overflow: hidden;[\s\S]*?padding: 0/);
  assert.match(styles, /\.inkra-overlay__body\s*\{[\s\S]*?min-height: 0;[\s\S]*?overflow: auto/);
  assert.match(styles, /\.inkra-overlay__header,\s*\.inkra-overlay__footer\s*\{[\s\S]*?flex: none/);
});

test('Overlay content keeps Radix semantics outside the PencilSurface visual layer', () => {
  assert.match(overlay, /<DialogPrimitive\.Content[\s\S]*?ref=\{ref\}/);
  assert.match(overlay, /<PencilSurface[\s\S]*?variant=\{surfaceVariant\}/);
  assert.match(overlay, /surfaceRadius = 8/);
  assert.doesNotMatch(overlay, /addEventListener\(['"](?:keydown|pointerdown|click)/);
});

test('Overlay and Popover titles keep Radix semantics around PencilText lettering', () => {
  assert.match(overlay, /import \{ PencilText \} from '\.\.\/PencilText\.js'/);
  assert.match(overlay, /interface OverlayTitleProps[\s\S]*?children: string;[\s\S]*?seed\?: string \| number/);
  assert.match(overlay, /<DialogPrimitive\.Title[\s\S]*?<PencilText[\s\S]*?>\{children\}<\/PencilText>/);
  assert.match(overlay, /<DialogPrimitive\.Description[\s\S]*?<PencilText[\s\S]*?>\{children\}<\/PencilText>/);
  assert.match(popover, /<PopoverPrimitive\.Title[\s\S]*?<PencilText[\s\S]*?>\{children\}<\/PencilText>/);
  assert.match(popover, /<PopoverPrimitive\.Description[\s\S]*?<PencilText[\s\S]*?>\{children\}<\/PencilText>/);
});

test('Popover forwards placement props and owns safe direct-child arrow placement', () => {
  for (const name of [
    'PopoverRoot',
    'PopoverAnchor',
    'PopoverTrigger',
    'PopoverPortal',
    'PopoverContent',
    'PopoverTitle',
    'PopoverDescription',
    'PopoverClose',
  ]) {
    assert.match(index, new RegExp(`\\b${name}\\b`));
  }

  assert.match(index, /PopoverArrowProps/);
  assert.doesNotMatch(index, /export \{[\s\S]*?PopoverArrow,/);
  assert.match(popover, /from '@radix-ui\/react-popover'/);
  assert.match(popover, /<PopoverPrimitive\.Content[\s\S]*?\{\.\.\.props\}/);
  assert.match(popover, /interface PopoverContentProps extends PopoverPrimitive\.PopoverContentProps/);
  assert.match(popover, /showArrow\?: boolean/);
  assert.match(popover, /showArrow = false/);
  assert.match(popover, /<\/PencilSurface>\s*\{showArrow \? \(\s*<PopoverPrimitive\.Arrow/);
  assert.doesNotMatch(popover, /addEventListener\(['"](?:keydown|pointerdown|click)/);
});

test('Portal bridge snapshots scoped tokens and refreshes from every trigger ancestor', () => {
  assert.match(themeBridge, /property\.startsWith\('--inkra-'\)/);
  assert.match(themeBridge, /getComputedStyle\(node\)/);
  assert.match(themeBridge, /data-inkra-theme=\{snapshot\.inkraTheme\}/);
  assert.match(themeBridge, /data-theme=\{snapshot\.theme\}/);
  assert.match(themeBridge, /dir=\{snapshot\.direction\}/);
  assert.match(themeBridge, /prefers-color-scheme: dark/);
  assert.match(themeBridge, /for \(let target: HTMLElement \| null = trigger; target; target = target\.parentElement\)/);
  assert.match(themeBridge, /attributeFilter: \['class', 'data-theme', 'data-inkra-theme', 'dir', 'lang', 'style'\]/);
  assert.match(themeBridge, /const captureTrigger = useContext\(PortalThemeContext\)\?\.captureTrigger/);
  assert.doesNotMatch(themeBridge, /\[context, forwardedRef\]/);
  assert.match(styles, /\.inkra-portal-theme-bridge\s*\{[\s\S]*?display: contents/);
});

test('Portal bridge bypasses semantic inline tokens in forced colors and offsets nested layers', () => {
  assert.match(themeBridge, /matchMedia\('\(forced-colors: active\)'\)/);
  assert.match(themeBridge, /if \(!forcedColors\) \{[\s\S]*?property\.startsWith\('--inkra-'\)/);
  assert.match(themeBridge, /forcedColors\.addEventListener\('change', refresh\)/);
  assert.match(themeBridge, /PortalLayerDepthContext = createContext\(-1\)/);
  assert.match(themeBridge, /'--inkra-floating-layer-offset': `\$\{depth \* 20\}`/);
  assert.match(styles, /--inkra-z-modal, 30\)[^;]*--inkra-floating-layer-offset, 0\)/);
  assert.match(styles, /--inkra-z-popover, 20\)[^;]*--inkra-floating-layer-offset, 0\)/);
});

test('Overlay styling uses pencil surfaces and reserves solid borders for forced colors', () => {
  const normalStyles = styles.slice(0, styles.indexOf('@media (forced-colors: active)'));
  assert.match(styles, /\.inkra-overlay__surface[\s\S]*?color: var\(--inkra-ink\)/);
  assert.match(styles, /\.inkra-popover__surface[\s\S]*?color: var\(--inkra-ink\)/);
  assert.match(styles, /\.inkra-overlay__content:focus-visible[\s\S]*?--inkra-focus-width/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*?animation: none/);
  assert.match(styles, /\.inkra-overlay__description,[\s\S]*?\.inkra-popover__description[\s\S]*?margin: 0/);
  assert.doesNotMatch(normalStyles, /border(?:-\w+)?:\s*[^;]*solid/);
  assert.match(styles, /forced-colors: active[\s\S]*?border: 1px solid CanvasText/);
});
