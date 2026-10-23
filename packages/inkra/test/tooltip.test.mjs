import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const tooltip = readFileSync(new URL('../src/tooltip/Tooltip.tsx', import.meta.url), 'utf8');
const index = readFileSync(new URL('../src/tooltip/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/tooltip/styles.css', import.meta.url), 'utf8');

test('Tooltip exposes the requested Radix-backed compound API', () => {
  for (const name of [
    'TooltipProvider',
    'TooltipRoot',
    'TooltipTrigger',
    'TooltipPortal',
    'TooltipContent',
  ]) {
    assert.match(index, new RegExp(`\\b${name}\\b`));
  }

  assert.match(tooltip, /from '@radix-ui\/react-tooltip'/);
  assert.match(tooltip, /Object\.freeze\(\{[\s\S]*?Provider: TooltipProvider[\s\S]*?Content: TooltipContent/);
  assert.doesNotMatch(tooltip, /addEventListener\(['"](?:mouseenter|mouseleave|focus|blur|keydown)/);
});

test('Tooltip trigger and portal preserve scoped themes and nested layer depth', () => {
  assert.match(tooltip, /<PortalThemeProvider>[\s\S]*?<TooltipPrimitive\.Root/);
  assert.match(tooltip, /usePortalTriggerRef\(forwardedRef\)/);
  assert.match(tooltip, /mapPortalChildren\(children, child => <TooltipPrimitive\.Portal \{\.\.\.props\}>\{child\}<\/TooltipPrimitive\.Portal>\)/);
  assert.match(tooltip, /props = usePortalThemeProps\(props\)/);
  assert.match(styles, /z-index: calc\(var\(--inkra-z-tooltip, 40\) \+ var\(--inkra-floating-layer-offset, 0\)\)/);
});

test('Tooltip keeps Radix semantics outside selectable pencil visuals', () => {
  assert.match(tooltip, /<TooltipPrimitive\.Content[\s\S]*?ref=\{ref\}[\s\S]*?<PencilSurface/);
  assert.match(tooltip, /surfaceRadius = 6/);
  assert.match(tooltip, /typeof children === 'string'[\s\S]*?<PencilText/);
  assert.match(styles, /\.inkra-tooltip__content-body\s*\{[\s\S]*?user-select: text/);
});

test('Tooltip styling reserves solid boundaries for forced colors and reduces motion', () => {
  const normalStyles = styles.slice(0, styles.indexOf('@media (forced-colors: active)'));
  assert.doesNotMatch(normalStyles, /border(?:-\w+)?:\s*[^;]*solid/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*?animation: none/);
  assert.match(styles, /forced-colors: active[\s\S]*?border: 1px solid CanvasText/);
});
