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
  assert.match(alertDialog, /context\?\.cancelRef\.current \?\? contentRef\.current/);
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
});

test('Drawer supports four directions, explicit sizing, sections and focus primitive', () => {
  assert.match(drawer, /export type DrawerDirection = 'top' \| 'right' \| 'bottom' \| 'left'/);
  assert.match(drawer, /export type DrawerSize = 'sm' \| 'md' \| 'lg' \| number \| string/);
  assert.match(drawer, /from '@radix-ui\/react-dialog'/);
  assert.match(drawer, /'--inkra-drawer-size': drawerSize\(size\)/);
  assert.match(drawer, /CloseButton: DrawerCloseButton/);
  assert.match(drawerStyles, /data-direction="left"/);
  assert.match(drawerStyles, /data-direction="right"/);
  assert.match(drawerStyles, /data-direction="top"/);
  assert.match(drawerStyles, /data-direction="bottom"/);
  assert.match(drawerStyles, /\.inkra-drawer__body \{[\s\S]*?overflow: auto/);
  assert.match(drawerStyles, /inline-size: min\(var\(--inkra-drawer-size\), calc\(100vw - var\(--inkra-space-4\)\)\)/);
  assert.match(drawerStyles, /prefers-reduced-motion: reduce/);
  assert.match(drawerStyles, /forced-colors: active/);
});
