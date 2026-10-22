import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/editable/index.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/editable/styles.css', import.meta.url), 'utf8');

test('Editable exposes controlled and uncontrolled value/editing contracts', () => {
  assert.match(source, /value\?: string;/);
  assert.match(source, /defaultValue\?: string;/);
  assert.match(source, /editing\?: boolean;/);
  assert.match(source, /defaultEditing\?: boolean;/);
  assert.match(source, /const controlledValue = value !== undefined/);
  assert.match(source, /const controlledEditing = editing !== undefined/);
  assert.match(source, /onValueChange\?: \(value: string\) => void/);
  assert.match(source, /onEditingChange\?: \(editing: boolean\) => void/);
});

test('Editable supports sync and async validation/save with failure retention', () => {
  assert.match(source, /export type EditableSaveResult = boolean \| string \| void \| null \| undefined/);
  assert.match(source, /export type EditableSaveHandler = .*Promise<EditableSaveResult>/);
  assert.match(source, /const validation = validate \? await validate\(next, previous\) : undefined/);
  assert.match(source, /const saved = onSave \? await onSave\(next, previous\) : undefined/);
  assert.match(source, /setError\(validationMessage\)/);
  assert.match(source, /setError\(saveMessage\)/);
  assert.match(source, /catch \(caught\)/);
  assert.match(source, /finally \{\s*setSaving\(false\)/);
  assert.match(source, /data-saving=\{saving \|\| undefined\}/);
});

test('Editable keyboard behavior is IME-safe and supports configurable blur', () => {
  assert.match(source, /export type EditableBlurBehavior = 'ignore' \| 'save' \| 'cancel'/);
  assert.match(source, /event\.nativeEvent\.isComposing \|\| event\.nativeEvent\.keyCode === 229/);
  assert.match(source, /if \(event\.key === 'Escape'\)/);
  assert.match(source, /if \(event\.key === 'Enter' && submitOnEnter/);
  assert.match(source, /if \(blurBehavior === 'cancel'\) cancel\(\);/);
  assert.match(source, /else void save\(\);/);
  assert.match(source, /blurBehavior = 'ignore'/);
});

test('Editable uses Input/Textarea, custom display/editor, and filters nested interactions', () => {
  assert.match(source, /import \{ Input \} from '..\/form\/Input\.js'/);
  assert.match(source, /import \{ Textarea \} from '..\/form\/Textarea\.js'/);
  assert.match(source, /multiline\?: boolean/);
  assert.match(source, /editor\?: EditableEditor/);
  assert.match(source, /display\?: ReactNode \| \(\(value: string\) => ReactNode\)/);
  assert.match(source, /const interactiveSelector = 'button, a, input, textarea, select, option/);
  assert.match(source, /closest\(interactiveSelector\)/);
  assert.match(source, /data-editable-display="true"/);
  assert.match(source, /data-editable-editor="true"/);
});

test('Editable keeps SSR-safe DOM semantics and focus return hooks', () => {
  assert.match(source, /requestAnimationFrame\(\(\) => editorRef\.current\?\.focus/);
  assert.match(source, /displayRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /role="button" tabIndex=\{disabled \|\| readOnly \? -1 : 0\}/);
  assert.match(source, /aria-disabled=\{disabled \|\| readOnly \|\| undefined\}/);
  assert.match(source, /role="alert"/);
  assert.doesNotMatch(source, /window\.addEventListener|document\.addEventListener/);
});

test('Editable styles preserve touch geometry, responsive actions and fallbacks', () => {
  assert.match(styles, /min-block-size: var\(--inkra-touch-target\)/);
  assert.match(styles, /min-inline-size: 2\.75rem/);
  assert.match(styles, /@media \(max-width: 30rem\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /@media print/);
  assert.doesNotMatch(styles, /linear-gradient|radial-gradient|box-shadow/);
});
