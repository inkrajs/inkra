import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = file => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');

test('Portal Presence observes actual animated content rather than a theme wrapper', () => {
  for (const file of ['dropdown-menu/index.tsx', 'overlay/Overlay.tsx', 'overlay/Popover.tsx', 'drawer/index.tsx', 'alert-dialog/index.tsx', 'tooltip/Tooltip.tsx']) {
    const source = read(file);
    assert.match(source, /mapPortalChildren\(children, child => <\w+\.Portal \{\.\.\.props\}>\{child\}<\/\w+\.Portal>\)/, file);
    assert.match(source, /usePortalThemeProps\(/, file);
    assert.doesNotMatch(source, /<PortalThemeBridge|forceMount=\{?true/, file);
  }
  const contextMenu = read('context-menu/index.tsx');
  assert.match(contextMenu, /<Primitive\.Portal>\s*<Primitive\.SubContent/);
  assert.match(contextMenu, /props = usePortalThemeProps\(props\)/);
  assert.doesNotMatch(contextMenu, /<PortalThemeBridge/);
});

test('Unwrapped portal children preserve fragment siblings and scoped theme overrides', () => {
  const bridge = read('overlay/themeBridge.tsx');
  assert.match(bridge, /Children\.map\(children, child =>/);
  assert.match(bridge, /child\.type === Fragment[\s\S]*?mapPortalChildren\(child\.props\.children, render\)/);
  assert.match(bridge, /return child == null \? null : render\(child\)/);
  const hook = bridge.slice(bridge.indexOf('export function usePortalThemeProps'), bridge.indexOf('export const PortalThemeBridge'));
  for (const attribute of ['data-inkra-theme', 'data-theme', 'dir', 'lang']) assert(hook.includes(attribute));
  assert.match(hook, /\.\.\.snapshot\.style,[\s\S]*?'--inkra-floating-layer-offset':[\s\S]*?\.\.\.props\.style/);
  assert.doesNotMatch(hook, /inkra-portal-theme-bridge|display:\s*'contents'/);
});

test('Dropdown and context-menu motion uses primitive state and compositor-only keyframes', () => {
  const css = read('dropdown-menu/styles.css');
  assert.match(css, /\.inkra-menu\[data-state="open"\].*inkra-menu-enter/);
  assert.match(css, /\.inkra-menu\[data-state="closed"\].*inkra-menu-exit.*pointer-events: none/);
  for (const side of ['top', 'left', 'right']) assert.match(css, new RegExp(`data-side="${side}"`));
  assert.match(css, /animation: inkra-menu-enter var\(--inkra-motion-normal\) var\(--inkra-ease\) both/);
  assert.match(css, /animation: inkra-menu-exit var\(--inkra-motion-fast\) var\(--inkra-ease\) both/);
  const frames = css.slice(css.indexOf('@keyframes'), css.indexOf('@media'));
  assert.match(frames, /opacity:/);
  assert.match(frames, /transform: translate/);
  assert.doesNotMatch(frames, /(?:height|width|inset|padding|margin):/);
  assert.match(read('dropdown-menu/index.tsx'), /<Primitive\.Content/);
  assert.match(read('context-menu/index.tsx'), /className=\{classes\('inkra-menu', 'inkra-context-menu__sub-content'/);
});

test('All shared floating surfaces disable closed-state animations in reduced motion', () => {
  for (const file of ['overlay/styles.css', 'drawer/styles.css', 'alert-dialog/styles.css', 'tooltip/styles.css', 'dropdown-menu/styles.css']) {
    const css = read(file);
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    assert.match(reduced, /animation: none !important/, `${file}: reduced-motion must override state/direction selector specificity`);
    assert.doesNotMatch(css, /transition:\s*all\b/);
  }
});

test('Closing floating content retains final frame and rejects pointer hits during exit', () => {
  for (const file of ['overlay/styles.css', 'drawer/styles.css', 'alert-dialog/styles.css', 'tooltip/styles.css', 'dropdown-menu/styles.css']) {
    const css = read(file);
    assert.match(css, /both/);
    assert.match(css, /\[data-state="closed"\][^{]*\{[^}]*pointer-events: none/, file);
  }
});

test('Accordion augments existing engine dimension reveal without new presence state', () => {
  const css = read('accordion/styles.css');
  assert.match(css, /height: var\(--radix-accordion-content-height\)/);
  assert.match(css, /width: var\(--radix-accordion-content-width\)/);
  assert.match(css, /inkra-accordion-body-in var\(--inkra-motion-normal\)/);
  assert.match(css, /inkra-accordion-body-out var\(--inkra-motion-normal\)/);
  const source = read('accordion/Accordion.tsx');
  assert.match(source, /<AccordionPrimitive\.Content/);
  assert.doesNotMatch(source, /setTimeout|requestAnimationFrame|forceMount=/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*inkra-accordion__content-body[\s\S]*animation: none !important/);
});

test('Tree row entry and selection use stable transforms without retaining collapsed nodes', () => {
  const css = read('tree/styles.css');
  assert.match(css, /inkra-tree-row-in var\(--inkra-motion-normal\)/);
  assert.match(css, /inkra-tree-selection-in var\(--inkra-motion-fast\)/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*inkra-tree__selection \{ animation: none !important/);
  const source = read('tree/index.tsx');
  assert.match(source, /<AriaTreeItem/);
  assert.doesNotMatch(source, /setTimeout|requestAnimationFrame|forceMount=/);
  assert.match(source, /isFocusVisible && <PencilSurface/);
  assert.match(source, /isSelected && <PencilSurface/);
});
