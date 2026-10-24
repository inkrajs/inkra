import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const checkbox = readFileSync(new URL('../src/selection/Checkbox.tsx', import.meta.url), 'utf8');
const toggle = readFileSync(new URL('../src/selection/Switch.tsx', import.meta.url), 'utf8');
const radio = readFileSync(new URL('../src/selection/RadioGroup.tsx', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../src/selection/useNativeChecked.ts', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/selection/selection.css', import.meta.url), 'utf8');

test('Checkbox and Switch use cancel-aware native reset with dynamic form ownership', () => {
  assert.match(hook, /const defaultCheckedRef = useRef\(Boolean\(defaultChecked\)\)/);
  assert.match(hook, /const form = input\?\.form/);
  assert.match(hook, /handleReset = \(event: Event\)/);
  assert.match(hook, /if \(event\.defaultPrevented\) return/);
  assert.match(hook, /const restored = controlled \? Boolean\(checkedRef\.current\) : defaultCheckedRef\.current/);
  assert.match(hook, /input\.checked = restored/);
  assert.match(hook, /input\.indeterminate = indeterminateRef\.current/);
  assert.match(hook, /if \(!controlled\) setUncontrolledChecked\(restored\)/);
  assert.match(hook, /\[controlled, form, inputRef\]/);
  const resetBlock = hook.match(/const handleReset = \(event: Event\) => \{[\s\S]*?\n    \};/)?.[0] ?? '';
  assert.doesNotMatch(resetBlock, /onCheckedChange|onChange|focus/);
  for (const source of [checkbox, toggle]) {
    assert.match(source, /form,/);
    assert.match(source, /useNativeChecked\(\{[\s\S]*?form,/);
    assert.match(source, /form=\{form\}/);
  }
});

test('RadioGroup reset preserves controlled ownership and canceled native state', () => {
  assert.match(radio, /const initialDefaultValueRef = useRef\(defaultValue\)/);
  assert.match(radio, /const currentValueRef = useRef\(value\)/);
  assert.match(radio, /const handleReset = \(event: Event\)/);
  assert.match(radio, /if \(event\.defaultPrevented\) return/);
  assert.match(radio, /const restored = controlled \? currentValueRef\.current : initialDefaultValueRef\.current/);
  assert.match(radio, /data-inkra-radio-group="\$\{generatedId\}"/);
  assert.match(radio, /if \(input\.form !== ownerForm \|\| input\.name !== name\) return/);
  assert.match(radio, /input\.checked = input\.value === restored/);
  assert.match(radio, /if \(!controlled\) setUncontrolledValue\(restored\)/);
  assert.match(radio, /\[controlled, form, generatedId, name\]/);
  assert.match(radio, /data-inkra-radio-group=\{context\.groupId\}/);
  const resetBlock = radio.match(/const handleReset = \(event: Event\) => \{[\s\S]*?\n    \};/)?.[0] ?? '';
  assert.doesNotMatch(resetBlock, /onValueChange|onItemChange|focus/);
});

test('Selection focus uses shared PencilSurface with system and motion fallbacks', () => {
  for (const source of [checkbox, toggle, radio]) {
    assert.match(source, /className="inkra-selection-control__focus-ring"[\s\S]*?variant="outline"/);
  }
  assert.match(css, /\.inkra-selection-control__focus-ring[\s\S]*?--inkra-accent-strong: var\(--inkra-focus\)/);
  assert.match(css, /focus-visible[\s\S]*?\.inkra-selection-control__focus-ring[\s\S]*?opacity: 1/);
  assert.match(radio, /inkra-selection-control__focus-ring inkra-selection-control__focus-ring--inset/);
  assert.match(css, /\.inkra-selection-control__focus-ring--inset\s*\{[\s\S]*?inset: var\(--inkra-focus-width\)/);
  assert.match(css, /\.inkra-pencil-surface\.inkra-switch__track[\s\S]*?overflow: visible/);
  assert.match(css, /\.inkra-switch__track > \.inkra-pencil-surface__ink[\s\S]*?overflow: hidden/);
  assert.match(css, /\.inkra-radio-group__items\[data-orientation="horizontal"\][\s\S]*?overflow-y: hidden/);
  const normal = css.split('@media (forced-colors: active)')[0];
  assert.doesNotMatch(normal, /outline:[^;]*solid/);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*?\.inkra-selection-control__focus-ring/);
  assert.match(css, /forced-colors: active[\s\S]*?\.inkra-selection-control__input:focus-visible[\s\S]*?solid Highlight/);
});
