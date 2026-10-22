import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { applyKeypadKey, getKeypadAction, getKeypadColumnCount } from '../src/keypad/model.ts';

const source = await readFile(new URL('../src/keypad/index.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/keypad/styles.css', import.meta.url), 'utf8');

const input = (value, label = value) => ({ id: `input-${value}`, label, value });
const remove = { id: 'delete', label: 'Delete', action: 'delete' };
const confirm = { id: 'confirm', label: 'Confirm', action: 'confirm' };

test('Keypad applies input, grapheme delete, confirm and maxLength without hidden mutations', () => {
  assert.deepEqual(applyKeypadKey('12', input('3')), { nextValue: '123', changed: true });
  assert.deepEqual(applyKeypadKey('12', input('00'), 3), { nextValue: '12', changed: false });
  assert.deepEqual(applyKeypadKey('A👨‍👩‍👧‍👦', remove), { nextValue: 'A', changed: true });
  assert.deepEqual(applyKeypadKey('', remove), { nextValue: '', changed: false });
  assert.deepEqual(applyKeypadKey('42', confirm), { nextValue: '42', changed: false });
  assert.equal(getKeypadAction(input('7')), 'input');
  assert.equal(getKeypadAction(confirm), 'confirm');
});

test('Keypad derives stable grid columns from explicit row spans', () => {
  assert.equal(getKeypadColumnCount([]), 1);
  assert.equal(getKeypadColumnCount([[input('1'), input('2'), input('3')], [remove, { ...confirm, span: 2 }]]), 3);
  assert.equal(getKeypadColumnCount([[{ ...confirm, span: 0 }]]), 1);
});

test('Keypad source exposes controlled and event contracts with local native buttons', () => {
  assert.match(source, /value\?: string/);
  assert.match(source, /defaultValue\?: string/);
  assert.match(source, /onValueChange\?: \(value: string, details: KeypadPressDetails\)/);
  assert.match(source, /onKeyPress\?: \(details: KeypadPressDetails\)/);
  assert.match(source, /onConfirm\?: \(value: string, details: KeypadPressDetails\)/);
  assert.match(source, /const controlled = value !== undefined/);
  assert.match(source, /role="group"/);
  assert.match(source, /<button/);
  assert.match(source, /type="button"/);
  assert.match(source, /disabled=\{keyDisabled\}/);
  assert.match(source, /aria-label=\{accessibleName\}/);
  assert.doesNotMatch(source, /import ['"]\.\/styles\.css['"]/);
  assert.doesNotMatch(source, /addEventListener\(['"]keydown|window\.onkeydown|document\.onkeydown/);
  assert.doesNotMatch(source, /preventDefault\(\)/);
  assert.doesNotMatch(source, /role="button"/);
});

test('Keypad styles keep stable grid cells, wrap labels and preserve accessibility fallbacks', () => {
  assert.match(styles, /grid-template-columns:\s*repeat\(var\(--inkra-keypad-columns\), minmax\(0, 1fr\)\)/);
  assert.match(styles, /grid-column:\s*span var\(--inkra-keypad-span\)/);
  assert.match(styles, /min-block-size:\s*var\(--inkra-control-lg\)/);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media print/);
  assert.doesNotMatch(styles, /white-space:\s*nowrap/);
});

