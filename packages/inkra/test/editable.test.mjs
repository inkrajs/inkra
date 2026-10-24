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
  assert.match(source, /finally \{\s*savingRef\.current = false;\s*setSaving\(false\)/);
  assert.match(source, /data-saving=\{saving \|\| undefined\}/);
});

test('Editable keyboard behavior is IME-safe and supports configurable blur', () => {
  assert.match(source, /export type EditableBlurBehavior = 'ignore' \| 'save' \| 'cancel'/);
  assert.match(source, /event\.nativeEvent\.isComposing \|\| event\.nativeEvent\.keyCode === 229/);
  assert.match(source, /if \(event\.key === 'Escape'\)/);
  assert.match(source, /if \(event\.key === 'Enter' && submitOnEnter/);
  assert.match(source, /rootRef\.current\?\.contains\(document\.activeElement\)/);
  assert.match(source, /rootRef\.current\?\.contains\(event\.relatedTarget as Node \| null\)/);
  assert.match(source, /onBlur=\{event => \{\s*onRootBlur\?\.\(event\);\s*handleEditorBlur\(event\);/);
  assert.match(source, /if \(blurBehavior === 'cancel'\) cancel\(false\);/);
  assert.match(source, /else void save\(false\);/);
  assert.match(source, /blurBehavior = 'ignore'/);
});

test('Editable uses Input/Textarea, custom display/editor, and separates nested interactions from the edit control', () => {
  assert.match(source, /import \{ Input \} from '..\/form\/Input\.js'/);
  assert.match(source, /import \{ Textarea \} from '..\/form\/Textarea\.js'/);
  assert.match(source, /multiline\?: boolean/);
  assert.match(source, /editor\?: EditableEditor/);
  assert.match(source, /display\?: ReactNode \| \(\(value: string\) => ReactNode\)/);
  assert.match(source, /const interactiveSelector = 'button, a, input, textarea, select, option/);
  assert.match(source, /closest\(interactiveSelector\)/);
  assert.match(source, /data-editable-display="true"/);
  assert.match(source, /data-editable-editor="true"/);
  assert.match(source, /className="inkra-editable__display-shell"/);
  assert.match(source, /<PencilText seed=\{`\$\{resolvedSeed\}-display-text`\}>\{currentValue \|\| placeholder\}<\/PencilText>/);
  assert.match(source, /className="inkra-editable__actions" role="group"/);
  assert.doesNotMatch(source, /role="button" tabIndex=/);
});

test('Editable keeps SSR-safe DOM semantics and focus return hooks', () => {
  assert.match(source, /requestAnimationFrame\(\(\) => editorRef\.current\?\.focus/);
  assert.match(source, /editButtonRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /disabled=\{disabled \|\| readOnly\}/);
  assert.match(source, /const resolvedSize = multiline \? \(textareaProps\?\.size \?\? 'md'\) : \(inputProps\?\.size \?\? 'md'\)/);
  assert.match(source, /className="inkra-editable__action" disabled=\{disabled \|\| readOnly\} loading=\{saving\}.*size=\{actionSize\}/);
  assert.match(source, /<Tooltip\.Content>\{startEditingLabel\}<\/Tooltip\.Content>/);
  assert.match(source, /role="alert"/);
  assert.doesNotMatch(source, /window\.addEventListener|document\.addEventListener/);
});

test('Editable composes input handlers and associates validation feedback with the editor', () => {
  assert.match(source, /inputProps\?\.onBlur\?\.\(event\)/);
  assert.match(source, /textareaProps\?\.onBlur\?\.\(event\)/);
  assert.match(source, /inputProps\?\.onKeyDown\?\.\(event\)/);
  assert.match(source, /textareaProps\?\.onKeyDown\?\.\(event\)/);
  assert.match(source, /if \(event\.defaultPrevented \|\| rootRef\.current\?\.contains/);
  assert.match(source, /onBlur: \(event: FocusEvent<HTMLInputElement \| HTMLTextAreaElement>\) => void/);
  assert.match(source, /aria-errormessage=\{error \? `\$\{resolvedId\}-error`/);
  assert.match(source, /'aria-describedby': error \? `\$\{resolvedId\}-error`/);
});

test('Editable styles preserve stable action geometry, responsive actions and fallbacks', () => {
  assert.match(styles, /--inkra-editable-control-height: var\(--inkra-control-md\)/);
  assert.match(styles, /data-size="sm".*var\(--inkra-control-sm\)/);
  assert.match(styles, /data-size="lg".*var\(--inkra-control-lg\)/);
  assert.match(styles, /box-sizing: border-box;\s*block-size: var\(--inkra-editable-control-height\);\s*min-block-size: var\(--inkra-editable-control-height\)/);
  assert.match(styles, /padding-inline: var\(--inkra-space-3\)/);
  assert.match(styles, /data-multiline="true".*block-size: auto/s);
  assert.match(styles, /min-block-size: max\(var\(--inkra-editable-control-height\), var\(--inkra-touch-target\)\)/);
  assert.match(styles, /grid-template-columns: repeat\(2, var\(--inkra-touch-target\)\)/);
  assert.match(styles, /\.inkra-editable__action--edit \{ grid-column: 2; \}/);
  assert.match(styles, /@media \(max-width: 24rem\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /@media print/);
  assert.doesNotMatch(styles, /linear-gradient|radial-gradient|box-shadow|color-mix/);
});
