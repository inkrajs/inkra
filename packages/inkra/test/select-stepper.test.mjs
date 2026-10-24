import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const stepper = readFileSync(new URL('../src/select/StepperSelect.tsx', import.meta.url), 'utf8');
const searchable = readFileSync(new URL('../src/select/SearchableSelect.tsx', import.meta.url), 'utf8');
const select = readFileSync(new URL('../src/select/Select.tsx', import.meta.url), 'utf8');
const index = readFileSync(new URL('../src/select/index.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/select/styles.css', import.meta.url), 'utf8');
const formStyles = readFileSync(new URL('../src/form/styles.css', import.meta.url), 'utf8');
const modelSource = readFileSync(new URL('../src/select/stepperModel.ts', import.meta.url), 'utf8');
const modelJavaScript = ts.transpileModule(modelSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { findAdjacentStepperItem, findEdgeStepperItem, resolveStepperNativeValue } = await import(`data:text/javascript,${encodeURIComponent(modelJavaScript)}`);

test('Select.Stepper is a data-driven standalone select mode', () => {
  assert.match(stepper, /items: readonly SelectStepperItem\[\]/);
  assert.match(stepper, /value\?: string \| null/);
  assert.match(stepper, /defaultValue\?: string \| null/);
  assert.match(stepper, /onValueChange\?: \(value: string\) => void/);
  assert.match(select, /Stepper: SelectStepper/);
  assert.match(index, /export \{ SelectStepper \}/);
  assert.match(index, /SelectStepperItem, SelectStepperProps/);
});

test('Stepper navigation skips disabled items, supports boundaries and can loop', () => {
  const items = [
    { value: 'private' },
    { value: 'team', disabled: true },
    { value: 'public' },
  ];
  assert.equal(findAdjacentStepperItem(items, 'private', 1, false)?.value, 'public');
  assert.equal(findAdjacentStepperItem(items, 'public', -1, false)?.value, 'private');
  assert.equal(findAdjacentStepperItem(items, 'public', 1, false), undefined);
  assert.equal(findAdjacentStepperItem(items, 'public', 1, true)?.value, 'private');
  assert.equal(findAdjacentStepperItem([{ value: 'only' }], 'only', 1, true), undefined);
  assert.equal(findAdjacentStepperItem(items, null, 1, false)?.value, 'private');
  assert.equal(findAdjacentStepperItem(items, null, -1, false)?.value, 'public');
  assert.equal(findAdjacentStepperItem(items, 'removed', 1, false)?.value, 'private');
  assert.equal(findAdjacentStepperItem(items, 'removed', -1, false)?.value, 'public');
  assert.equal(findEdgeStepperItem(items, 'first')?.value, 'private');
  assert.equal(findEdgeStepperItem(items, 'last')?.value, 'public');
  assert.equal(findAdjacentStepperItem([], null, 1, false), undefined);
  assert.equal(findEdgeStepperItem([], 'first'), undefined);
  const disabledItems = items.map(item => ({ ...item, disabled: true }));
  assert.equal(findAdjacentStepperItem(disabledItems, 'private', 1, true), undefined);
  assert.equal(findAdjacentStepperItem(disabledItems, null, -1, false), undefined);
  assert.equal(findEdgeStepperItem(disabledItems, 'last'), undefined);
  assert.equal(findAdjacentStepperItem([...items, { value: 'archive' }], 'public', 1, false)?.value, 'archive');
  assert.equal(resolveStepperNativeValue(items, 'public'), 'public');
  assert.equal(resolveStepperNativeValue(items, 'removed'), '');
  assert.equal(resolveStepperNativeValue([], 'public'), '');
  assert.match(stepper, /const previous = adjacentItem\(-1\)/);
  assert.match(stepper, /const next = adjacentItem\(1\)/);
  assert.match(stepper, /disabled=\{interactionDisabled \|\| previous == null\}/);
  assert.match(stepper, /disabled=\{interactionDisabled \|\| next == null\}/);
});

test('Stepper keyboard behavior covers logical arrows and first or last enabled values', () => {
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
    assert.match(stepper, new RegExp(`event\\.key === '${key}'`));
  }
  assert.match(stepper, /getComputedStyle\(event\.currentTarget\)\.direction === 'rtl'/);
  assert.match(stepper, /event\.preventDefault\(\);[\s\S]*?change\(next\)/);
  assert.match(styles, /:dir\(rtl\)[\s\S]*?transform: scaleX\(-1\)/);
});

test('Stepper uses one input-sized pencil surface with named arrow actions', () => {
  assert.match(stepper, /inkra-field-control-hit/);
  assert.match(stepper, /inkra-field-control inkra-field-control--input inkra-select-stepper__control/);
  assert.match(stepper, /<InputAction[\s\S]*?position="start"/);
  assert.match(stepper, /<InputAction[\s\S]*?seed=\{`\$\{seed\}-next`\}/);
  assert.match(stepper, /aria-label=\{previousLabel\}/);
  assert.match(stepper, /aria-label=\{nextLabel\}/);
  assert.match(stepper, /<PencilText ellipsis/);
  assert.match(styles, /font-size: var\(--inkra-field-control-font-size\)/);
  assert.match(formStyles, /--inkra-field-control-height: var\(--inkra-control-md\)/);
  assert.match(formStyles, /data-size="sm"[\s\S]*?--inkra-field-control-height: var\(--inkra-control-sm\)/);
  assert.match(formStyles, /data-size="lg"[\s\S]*?--inkra-field-control-height: var\(--inkra-control-lg\)/);
  assert.match(formStyles, /min-height: var\(--inkra-touch-target\)/);
});

test('Searchable Select action buttons follow sm, md and lg visual sizing', () => {
  assert.match(searchable, /const actionSize = size === 'sm' \? 'icon-sm' : size === 'lg' \? 'icon-lg' : 'icon'/);
  assert.match(searchable, /Combobox\.Trigger[\s\S]*?Button variant="ghost" size=\{actionSize\}/);
  assert.match(searchable, /Combobox\.Clear[\s\S]*?Button variant="ghost" size=\{actionSize\}/);
  assert.match(formStyles, /min-height: var\(--inkra-touch-target\)/);
});

test('Stepper preserves Field state and native form submission or reset', () => {
  assert.match(stepper, /useResolvedControlProps\(/);
  assert.match(stepper, /<button[\s\S]*?id=\{controlId\}[\s\S]*?role="spinbutton"/);
  assert.match(stepper, /aria-readonly=\{state\.readOnly \|\| undefined\}/);
  assert.match(stepper, /aria-required=\{state\.required \|\| undefined\}/);
  assert.match(stepper, /<select[\s\S]*?form=\{form\}[\s\S]*?name=\{name\}/);
  assert.match(stepper, /const nativeValue = resolveStepperNativeValue\(items, currentValue\)/);
  assert.match(stepper, /required=\{state\.required && !state\.readOnly\}/);
  assert.match(stepper, /value=\{nativeValue\}/);
  assert.match(stepper, /select\.value = resolveStepperNativeValue\(itemsRef\.current, restored\);[\s\S]*?setUncontrolledValue\(restored\)/);
  assert.match(stepper, /onInvalid=\{event => \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?controlRef\.current\?\.focus/);
  assert.match(stepper, /formElement\.addEventListener\('reset', reset\)/);
  assert.match(stepper, /if \(controlled\) \{[\s\S]*?resolveStepperNativeValue\(itemsRef\.current, latestValueRef\.current\)/);
});
