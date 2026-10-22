import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ContextMenu } from '../dist/context-menu/index.js';

const source = readFileSync(new URL('../src/context-menu/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/context-menu/styles.css', import.meta.url), 'utf8');

test('ContextMenu renders readable SSR trigger content without opening a portal', () => {
  const html = renderToStaticMarkup(h(ContextMenu.Root, null,
    h(ContextMenu.Trigger, { 'aria-label': 'Note actions' }, 'Open note actions'),
    h(ContextMenu.Portal, null,
      h(ContextMenu.Content, null,
        h(ContextMenu.Item, null, 'Duplicate'),
        h(ContextMenu.Item, { disabled: true }, 'Unavailable')))));

  assert.match(html, /data-context-menu-trigger=""/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /Open note actions/);
  assert.match(html, /inkra-context-menu__anchor/);
  assert.doesNotMatch(html, /inkra-context-menu__anchor[^>]*type="button"/);
  assert.doesNotMatch(html, /Duplicate|Unavailable/);
});

test('ContextMenu supports controlled state and records invocation reasons', () => {
  assert.match(source, /open\?: boolean/);
  assert.match(source, /defaultOpen\?: boolean/);
  assert.match(source, /onOpenChange\?: \(open: boolean, details: ContextMenuOpenChangeDetails\)/);
  assert.match(source, /'pointer' \| 'keyboard' \| 'long-press' \| 'dismiss'/);
  assert.match(source, /event\.key !== 'ContextMenu'/);
  assert.match(source, /event\.shiftKey && event\.key === 'F10'/);
  assert.match(source, /getBoundingClientRect\(\)/);
  assert.match(source, /clientX: event\.clientX|x: event\.clientX/);
  assert.match(source, /viewportPoint/);
});

test('ContextMenu long press observes movement and selection without taking pointer capture', () => {
  assert.match(source, /longPress\?: boolean \| ContextMenuLongPressOptions/);
  assert.match(source, /DEFAULT_LONG_PRESS_DELAY = 600/);
  assert.match(source, /Math\.hypot/);
  assert.match(source, /distance > tolerance/);
  assert.match(source, /hasTextSelectionWithin\(currentTarget\)/);
  assert.match(source, /suppressContextMenuUntil/);
  assert.doesNotMatch(source, /setPointerCapture|preventDefault\(\)[\s\S]{0,120}startLongPress/);
  assert.doesNotMatch(source, /touch-action\s*:/);
});

test('ContextMenu keeps explicit paths to the native browser menu', () => {
  assert.match(source, /ContextMenuNativePolicy = 'editable' \| 'always' \| 'never'/);
  assert.match(source, /DEFAULT_EXCLUDE = '\[data-context-menu-native\]'/);
  assert.match(source, /input, textarea, select/);
  assert.match(source, /selection\.isCollapsed/);
  assert.match(source, /if \(disabled\) return/);
  assert.match(source, /shouldUseNativeMenu/);
  assert.match(source, /openFromKeyboard[\s\S]*?shouldUseNativeMenu/);
});

test('ContextMenu composes the existing menu implementation and restores focus on close', () => {
  assert.match(source, /import \{ DropdownMenu \} from '\.\.\/dropdown-menu\/index\.js'/);
  assert.match(source, /ContextMenuItem = DropdownMenu\.Item/);
  assert.match(source, /ContextMenuCheckboxItem = DropdownMenu\.CheckboxItem/);
  assert.match(source, /ContextMenuRadioItem = DropdownMenu\.RadioItem/);
  assert.match(source, /context\.restoreFocus\(\)/);
  assert.match(source, /focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /Primitive\.SubTrigger/);
  assert.match(source, /Primitive\.SubContent/);
});

test('ContextMenu uses a viewport-aware virtual anchor and pencil submenu surface', () => {
  assert.match(styles, /position: fixed/);
  assert.match(styles, /pointer-events: none/);
  assert.match(styles, /max-block-size: var\(--radix-dropdown-menu-content-available-height\)/);
  assert.match(styles, /forced-colors: active/);
  assert.match(source, /collisionPadding = 8/);
  assert.match(source, /<PencilSurface[\s\S]*?variant="paper"/);
  assert.match(source, /side = 'right'/);
  assert.match(source, /align = 'start'/);
});
