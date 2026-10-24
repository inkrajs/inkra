import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  detectHotkeyPlatform,
  formatHotkey,
  getHotkeyTokens,
  hotkeyFromKeyboardEvent,
  hotkeySignature,
  isHotkeyClear,
  isHotkeyEscape,
  normalizeHotkey,
} from '../src/hotkey/model.ts';

const componentSource = await readFile(new URL('../src/hotkey/index.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/hotkey/styles.css', import.meta.url), 'utf8');

test('Hotkey normalizes modifier order and formats Mac and Windows labels', () => {
  const value = normalizeHotkey({ key: 'k', code: 'KeyK', modifiers: ['meta', 'shift', 'control', 'meta'] });
  assert.deepEqual(value, { key: 'K', code: 'KeyK', modifiers: ['control', 'shift', 'meta'] });
  assert.deepEqual(getHotkeyTokens(value, 'mac'), ['⌃', '⇧', '⌘', 'K']);
  assert.deepEqual(getHotkeyTokens(value, 'windows'), ['Ctrl', 'Shift', 'Win', 'K']);
  assert.equal(formatHotkey(value, 'mac'), '⌃⇧⌘K');
  assert.equal(formatHotkey(value, 'windows'), 'Ctrl + Shift + Win + K');
  assert.equal(hotkeySignature(value), 'control+shift+meta|KeyK|K');
});

test('Hotkey uses platform-specific key glyphs and conservative auto detection', () => {
  assert.equal(formatHotkey({ key: 'Backspace', modifiers: ['meta'] }, 'mac'), '⌘⌫');
  assert.equal(formatHotkey({ key: 'Backspace', modifiers: ['control'] }, 'windows'), 'Ctrl + Backspace');
  assert.equal(formatHotkey({ key: 'ArrowLeft', modifiers: ['alt'] }, 'windows'), 'Alt + ←');
  assert.equal(detectHotkeyPlatform('MacIntel'), 'mac');
  assert.equal(detectHotkeyPlatform('iPad'), 'mac');
  assert.equal(detectHotkeyPlatform('Win32'), 'windows');
  assert.equal(detectHotkeyPlatform(), 'windows');
});

test('keyboard capture ignores composition and modifier-only events', () => {
  assert.equal(hotkeyFromKeyboardEvent({ key: 'k', code: 'KeyK', metaKey: true, isComposing: true }), null);
  assert.equal(hotkeyFromKeyboardEvent({ key: 'k', code: 'KeyK', metaKey: true, keyCode: 229 }), null);
  assert.equal(hotkeyFromKeyboardEvent({ key: 'Shift', code: 'ShiftLeft', shiftKey: true }), null);
  assert.equal(hotkeyFromKeyboardEvent({ key: 'Dead', code: 'Quote', altKey: true }), null);
});

test('keyboard capture preserves the primary key, code and active modifiers', () => {
  assert.deepEqual(
    hotkeyFromKeyboardEvent({ key: 'k', code: 'KeyK', ctrlKey: true, altKey: true, shiftKey: true }),
    { key: 'K', code: 'KeyK', modifiers: ['control', 'alt', 'shift'] },
  );
  assert.deepEqual(hotkeyFromKeyboardEvent({ key: ' ', code: 'Space' }), { key: ' ', code: 'Space' });
});

test('Escape cancels and unmodified Delete or Backspace clears without masking modified shortcuts', () => {
  assert.equal(isHotkeyEscape({ key: 'Escape' }), true);
  assert.equal(isHotkeyEscape({ key: 'Escape', isComposing: true }), false);
  assert.equal(isHotkeyClear({ key: 'Backspace' }), true);
  assert.equal(isHotkeyClear({ key: 'Delete' }), true);
  assert.equal(isHotkeyClear({ key: 'Backspace', metaKey: true }), false);
  assert.deepEqual(hotkeyFromKeyboardEvent({ key: 'Backspace', code: 'Backspace', metaKey: true }), {
    key: 'Backspace', code: 'Backspace', modifiers: ['meta'],
  });
});

test('HotkeyInput keeps capture local and exposes controlled, uncontrolled, conflict and accessibility paths', () => {
  const keydownSource = componentSource.slice(
    componentSource.indexOf('const handleKeyDown'),
    componentSource.indexOf('const handleFocus'),
  );
  assert.match(componentSource, /value\?: HotkeyValue \| null/);
  assert.match(componentSource, /defaultValue\?: HotkeyValue \| null/);
  assert.match(componentSource, /const isControlled = value !== undefined/);
  assert.match(componentSource, /validateHotkey\?\.\(nextValue\)/);
  assert.match(componentSource, /onConflict\?\.\(nextValue, message\)/);
  assert.match(componentSource, /onCancel\?\.\(\)/);
  assert.match(componentSource, /recordingLabel\?: string/);
  assert.match(componentSource, /const recording = focused && !state\.disabled && !state\.readOnly/);
  assert.match(componentSource, /data-recording=\{recording \|\| undefined\}/);
  assert.match(componentSource, /aria-live="polite"/);
  assert.match(componentSource, /onCompositionStart/);
  assert.match(componentSource, /onCompositionEnd/);
  assert.match(componentSource, /aria-errormessage/);
  assert.doesNotMatch(componentSource, /aria-keyshortcuts/);
  assert.match(componentSource, /role="alert"/);
  assert.match(componentSource, /disabled=\{state\.disabled\}/);
  assert.match(componentSource, /readOnly=\{state\.readOnly\}/);
  assert.doesNotMatch(componentSource, /addEventListener\(['"]keydown|window\.onkeydown|document\.onkeydown/);
  assert.doesNotMatch(keydownSource, /preventDefault\(\)/);
});

test('Hotkey styles preserve a native focus target and forced-colors fallback', () => {
  assert.match(styles, /\.inkra-hotkey-input__native/);
  assert.match(styles, /block-size:\s*var\(--inkra-hotkey-input-height\)/);
  assert.match(styles, /margin-block:\s*max\(0px, calc\(\(var\(--inkra-touch-target\) - var\(--inkra-hotkey-input-height\)\) \/ 2\)\)/);
  assert.match(styles, /inset-block:\s*min\(0px, calc\(\(var\(--inkra-hotkey-input-height\) - var\(--inkra-touch-target\)\) \/ 2\)\)/);
  assert.match(styles, /\.inkra-hotkey-input__control > \.inkra-pencil-surface__content \{\s*overflow: visible;\s*clip-path: none;/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /outline:\s*2px solid Highlight/);
  assert.match(styles, /\.inkra-hotkey-input__focus-ring/);
  assert.match(styles, /\.inkra-hotkey-input\[data-recording="true"\].*opacity:\s*1/s);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media print/);
});
