import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dropdown = readFileSync(new URL('../src/dropdown-menu/index.tsx', import.meta.url), 'utf8');
const dropdownStyles = readFileSync(new URL('../src/dropdown-menu/styles.css', import.meta.url), 'utf8');
const context = readFileSync(new URL('../src/context-menu/index.tsx', import.meta.url), 'utf8');
const contextStyles = readFileSync(new URL('../src/context-menu/styles.css', import.meta.url), 'utf8');

test('Menus stay inside Radix available width and height with local scrolling', () => {
  assert.match(dropdownStyles, /--radix-dropdown-menu-content-available-width/);
  assert.match(dropdownStyles, /--radix-dropdown-menu-content-available-height/);
  assert.match(dropdownStyles, /max-height: min\([\s\S]*?100dvh - 16px/);
  assert.match(dropdownStyles, /overflow-y: auto/);
  assert.match(dropdownStyles, /overscroll-behavior: contain/);
  assert.match(dropdownStyles, /scrollbar-gutter: stable/);
  assert.match(contextStyles, /max-inline-size: min\(320px, var\(--radix-dropdown-menu-content-available-width/);
});

test('Long menu content wraps readably without displacing indicators', () => {
  assert.match(dropdown, /copy\(children\)/);
  assert.doesNotMatch(dropdown, /PencilText ellipsis/);
  assert.doesNotMatch(context, /PencilText ellipsis/);
  assert.match(dropdownStyles, /\.inkra-menu__label \{ flex: 1 1 auto;[\s\S]*?overflow-wrap: anywhere/);
  assert.match(dropdownStyles, /\.inkra-menu__icon \{[\s\S]*?flex: none/);
  assert.match(contextStyles, /\.inkra-context-menu__sub-indicator \{[\s\S]*?flex: none[\s\S]*?margin-inline-start: auto/);
});

test('Forced colors remove decorative highlight and preserve semantic item states', () => {
  assert.match(dropdownStyles, /forced-colors: active[\s\S]*?\.inkra-menu__highlight \{ display: none !important; \}/);
  assert.match(dropdownStyles, /data-highlighted[\s\S]*?background: Highlight[\s\S]*?color: HighlightText/);
  assert.match(dropdownStyles, /data-disabled[\s\S]*?color: GrayText/);
  assert.match(dropdownStyles, /\.inkra-menu__icon \.inkra-pencil-icon \{ display: none !important; \}/);
  assert.match(dropdownStyles, /data-state="checked"[\s\S]*?content: "✓"/);
  assert.match(dropdownStyles, /data-state="indeterminate"[\s\S]*?content: "—"/);
});

test('Context submenu keyboard and RTL remain delegated to Radix', () => {
  assert.match(context, /Primitive\.SubTrigger/);
  assert.match(context, /Primitive\.SubContent/);
  assert.match(context, /dir\?: 'ltr' \| 'rtl'/);
  assert.match(contextStyles, /\[dir="rtl"\] \.inkra-context-menu__sub-indicator[\s\S]*?scaleX\(-1\)/);
  assert.doesNotMatch(context, /addEventListener\(['"]keydown|onKeyDown=.*SubTrigger/);
});
