import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const command = source('../src/command/index.tsx');
const css = source('../src/command/styles.css');

test('Command input preserves cmdk ownership while layering editable pencil lettering', () => {
  assert.match(command, /<Primitive\.Input[\s\S]*ref=\{captureRef\}/);
  assert.match(command, /inputRef\.current = node/);
  assert.match(command, /assignRef\(ref, node\)/);
  assert.match(command, /<EditablePencilText[\s\S]*controlRef=\{inputRef\}/);
  assert.match(command, /__iconData as searchIcon/);
  assert.match(command, /searchIcon\.node\.map/);
  assert.match(command, /tag === 'circle'/);
  assert.match(command, /defaultValue=\{defaultValue\}/);
  assert.match(command, /placeholder=\{placeholder\}/);
  assert.match(command, /value=\{value\}/);
  assert.match(command, /inkra-field-control-hit/);
  assert.doesNotMatch(command, /<Input\b|from ['"]\.\.\/form\/Input/);
});

test('Command search keeps one paper surface with an underline and focus-only pencil treatment', () => {
  assert.match(command, /surface \? <PencilSurface variant="paper"/);
  assert.match(command, /<div className="inkra-command__input-frame">/);
  assert.match(command, /inkra-command__input-focus-line/);
  assert.match(command, /<PencilLine className="inkra-command__input-line"/);
  assert.match(command, /<PencilLine className="inkra-command__input-focus-line"/);
  assert.doesNotMatch(command, /inkra-command__input-frame"[^>]*variant="outline"/);
  assert.match(css, /\.inkra-command__input-frame \{[^}]*box-sizing: border-box;[^}]*display: flex;[^}]*inline-size: 100%/);
  assert.doesNotMatch(css, /\.inkra-command__input-frame \{[^}]*border:/);
  assert.match(css, /\.inkra-command__input-wrap:focus-within \.inkra-command__input-focus-line/);
  assert.match(css, /caret-color: var\(--inkra-ink\)/);
  assert.match(css, /\.inkra-command__input-wrap > \.inkra-pencil-line\[data-orientation="horizontal"\] \{ width: calc\(100% - 24px\); \}/);
});

test('Command leaves keyboard, filtering and IME behavior with cmdk', () => {
  for (const part of ['Input', 'List', 'Group', 'Item', 'Empty', 'Separator']) {
    assert.match(command, new RegExp(`<Primitive\\.${part}\\b`));
  }
  assert.match(command, /loop = true/);
  assert.match(command, /composing\.current \|\| event\.nativeEvent\.isComposing \|\| event\.keyCode === 229/);
  assert.match(command, /event\.preventDefault\(\)/);
  assert.doesNotMatch(command, /addEventListener|event\.key === ['"](?:ArrowDown|ArrowUp|Home|End)['"]|fuzzy|new RegExp/);
});

test('Command narrow layout and platform fallbacks remain explicit', () => {
  assert.match(css, /\.inkra-command__item \{[^}]*display: flex;[^}]*min-inline-size: 0/);
  assert.match(css, /\.inkra-command__label \{[^}]*flex: 1 1 auto;[^}]*min-inline-size: 0;[^}]*overflow-wrap: anywhere/);
  assert.match(css, /\.inkra-command__shortcut \{[^}]*flex: 0 1 12rem;[^}]*min-inline-size: 0;[^}]*max-inline-size: 45%[^}]*overflow-wrap: anywhere/);
  assert.match(css, /max-block-size: min\(360px, 50dvh\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /\.inkra-command__input-focus-line, \.inkra-command__item-focus \{ display: none !important; \}/);
  assert.match(css, /color: FieldText !important/);
  assert.match(css, /outline: var\(--inkra-focus-width\) solid Highlight/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation: none !important; transition: none !important/);
});
