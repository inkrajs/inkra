import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const alertDialog = read('../src/alert-dialog/index.tsx');
const alertStyles = read('../src/alert-dialog/styles.css');
const drawer = read('../src/drawer/index.tsx');
const drawerStyles = read('../src/drawer/styles.css');

test('AlertDialog owns pending state and prevents unsafe dismissal', () => {
  assert.match(alertDialog, /role="alertdialog"/);
  assert.match(alertDialog, /'onOpenChange' \| 'modal'/);
  assert.match(alertDialog, /<DialogPrimitive\.Root[\s\S]*?modal/);
  assert.match(alertDialog, /if \(!nextOpen && pending\) return/);
  assert.match(alertDialog, /onInteractOutside=\{event => \{[\s\S]*?event\.preventDefault\(\)/);
  assert.match(alertDialog, /onPointerDownOutside=\{event => \{[\s\S]*?event\.preventDefault\(\)/);
  assert.match(alertDialog, /if \(context\?\.pending\) event\.preventDefault\(\)/);
  assert.match(alertDialog, /cancel && !cancel\.disabled && cancel\.isConnected/);
  assert.match(alertDialog, /ownerDocument\?\.activeElement === cancel/);
  assert.match(alertDialog, /content\?\.isConnected/);
  assert.match(alertDialog, /closeOnAction = true/);
  assert.match(alertDialog, /closeOnAction \? <DialogPrimitive\.Close asChild>/);
  assert.match(alertDialog, /Action: AlertDialogAction/);
  assert.doesNotMatch(alertDialog, /addEventListener\(/);
});

test('AlertDialog exposes pencil sections and forced-color fallbacks', () => {
  for (const part of ['Root', 'Trigger', 'Portal', 'Backdrop', 'Content', 'Header', 'Body', 'Footer', 'Title', 'Description', 'Cancel', 'Action']) {
    assert.match(alertDialog, new RegExp(`${part}: AlertDialog${part}`));
  }
  assert.match(alertDialog, /<PencilSurface/);
  assert.match(alertDialog, /<PencilLine className="inkra-alert-dialog__divider"/);
  assert.match(alertStyles, /\.inkra-alert-dialog__body \{[\s\S]*?overflow: auto/);
  assert.match(alertStyles, /prefers-reduced-motion: reduce[\s\S]*?animation: none/);
  assert.match(alertStyles, /forced-colors: active[\s\S]*?border: 1px solid CanvasText/);
  assert.match(alertStyles, /left: 50%/);
  assert.doesNotMatch(alertStyles, /inset-inline-start: 50%/);
  assert.match(alertStyles, /\.inkra-alert-dialog__focus-ring[\s\S]*--inkra-accent-strong: var\(--inkra-focus\)/);
  assert.match(alertStyles, /\.inkra-pencil-surface\.inkra-alert-dialog__focus-ring \{ display: none !important/);
  assert.match(alertStyles, /@media \(max-height: 30rem\)[\s\S]*100dvh - var\(--inkra-space-4\)/);
  assert.match(alertStyles, /\.inkra-alert-dialog__layout:has\(> \.inkra-alert-dialog__body\) \{ overflow: hidden/);
});

test('Drawer supports four directions, explicit sizing, sections and focus primitive', () => {
  assert.match(drawer, /export type DrawerDirection = 'top' \| 'right' \| 'bottom' \| 'left'/);
  assert.match(drawer, /export type DrawerSize = 'sm' \| 'md' \| 'lg' \| number \| string/);
  assert.match(drawer, /from '@radix-ui\/react-dialog'/);
  assert.match(drawer, /'--inkra-drawer-size': drawerSize\(size\)/);
  assert.match(drawer, /CloseButton: DrawerCloseButton/);
  assert.match(drawer, /className="inkra-drawer__focus-ring"/);
  assert.match(drawer, /variant="outline"/);
  assert.match(drawerStyles, /data-direction="left"/);
  assert.match(drawerStyles, /data-direction="right"/);
  assert.match(drawerStyles, /data-direction="top"/);
  assert.match(drawerStyles, /data-direction="bottom"/);
  assert.match(drawerStyles, /\.inkra-drawer__body \{[\s\S]*?overflow: auto/);
  assert.match(drawerStyles, /inline-size: min\(var\(--inkra-drawer-size\), calc\(100vw - var\(--inkra-space-4\)\)\)/);
  assert.match(drawerStyles, /prefers-reduced-motion: reduce/);
  assert.match(drawerStyles, /forced-colors: active/);
  assert.match(drawerStyles, /\.inkra-drawer__content:focus-visible\s*\{\s*outline: 0/);
  assert.match(drawerStyles, /\.inkra-drawer__content:focus-visible > \.inkra-drawer__focus-ring \{ opacity: 1/);
  assert.match(drawerStyles, /forced-colors: active[\s\S]*?\.inkra-drawer__focus-ring \{ display: none !important/);
  assert.match(drawerStyles, /forced-colors: active[\s\S]*?\.inkra-drawer__content:focus-visible \{ outline: var\(--inkra-focus-width\) solid Highlight/);
});

test('Drawer keeps long headings, actions and footers reachable in short viewports', () => {
  assert.match(drawerStyles, /\.inkra-drawer__header,[\s\S]*?\.inkra-drawer__body,[\s\S]*?\.inkra-drawer__footer \{ box-sizing: border-box/);
  assert.match(drawer, /const hasActions = Boolean\(action \|\| showClose\)/);
  assert.match(drawer, /data-actions=\{hasActions \|\| undefined\}/);
  assert.match(drawer, /data-custom-action=\{action \? true : undefined\}/);
  assert.match(drawerStyles, /\.inkra-drawer__content \{[\s\S]*?container-name: inkra-drawer;[\s\S]*?container-type: inline-size/);
  assert.match(drawerStyles, /\.inkra-drawer__header\s*\{[\s\S]*?display: flex;[\s\S]*?max-block-size: 50%;[\s\S]*?overflow: auto/);
  assert.match(drawerStyles, /\.inkra-drawer__heading \{[\s\S]*?flex: 1 1 auto;[\s\S]*?min-width: 0;[\s\S]*?overflow-wrap: anywhere/);
  assert.match(drawerStyles, /\.inkra-drawer__header-actions \{[\s\S]*?flex: none;[\s\S]*?flex-wrap: wrap;[\s\S]*?max-inline-size: 100%;[\s\S]*?overflow: auto/);
  assert.match(drawerStyles, /@container inkra-drawer \(max-width: 24rem\)[\s\S]*?\.inkra-drawer__header\[data-custom-action\][\s\S]*?flex-direction: column/);
  assert.match(drawerStyles, /\.inkra-drawer__header\[data-custom-action\] \.inkra-drawer__header-actions[\s\S]*?order: -1/);
  assert.doesNotMatch(drawerStyles, /\.inkra-drawer__header\[data-actions\][^{]*\{[^}]*flex-direction: column/);
  assert.doesNotMatch(drawerStyles, /max-inline-size: min\(50%, 12rem\)/);
  assert.match(drawerStyles, /\.inkra-drawer__footer \{[\s\S]*?max-block-size: 40%;[\s\S]*?overflow: auto/);
  assert.match(drawerStyles, /\.inkra-drawer__body \{[\s\S]*?flex: 1 1 auto;[\s\S]*?min-height: 0;[\s\S]*?overflow: auto/);
  assert.doesNotMatch(drawer, /addEventListener\(['"](?:keydown|pointerdown|click|focus|blur)/);
});
