import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  createDefaultTag,
  defaultTagValueKey,
  hasTagValue,
  normalizeTagInputValue,
  splitTagInputValue,
} from '../src/tag-input/model.ts';

const componentSource = await readFile(new URL('../src/tag-input/index.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/tag-input/styles.css', import.meta.url), 'utf8');
const tagInputModule = process.env.INKRA_TAG_INPUT_MODULE
  ? new URL(process.env.INKRA_TAG_INPUT_MODULE, import.meta.url).href
  : null;

test('TagInput normalizes draft values without changing entered case', () => {
  assert.equal(normalizeTagInputValue('  Inkra UI  '), 'Inkra UI');
  assert.equal(defaultTagValueKey('  Inkra UI  '), 'inkra ui');
  assert.deepEqual(createDefaultTag('  Inkra UI  '), { id: 'Inkra UI', value: 'Inkra UI' });
});

test('TagInput splits configured paste delimiters without regular-expression escaping hazards', () => {
  assert.deepEqual(splitTagInputValue('alpha,beta;gamma\ndelta'), {
    parts: ['alpha', 'beta', 'gamma', 'delta'],
    hasDelimiter: true,
  });
  assert.deepEqual(splitTagInputValue('alpha||beta|gamma', ['||', '|']), {
    parts: ['alpha', 'beta', 'gamma'],
    hasDelimiter: true,
  });
  assert.deepEqual(splitTagInputValue('alpha', []), { parts: ['alpha'], hasDelimiter: false });
});

test('TagInput duplicate checks use machine values and allow an application key function', () => {
  const tags = [{ id: 'framework', value: 'React' }, { id: 'language', value: 'TypeScript' }];
  assert.equal(hasTagValue(tags, ' react '), true);
  assert.equal(hasTagValue(tags, 'REACT'), true);
  assert.equal(hasTagValue(tags, 'React', value => value), true);
  assert.equal(hasTagValue(tags, 'react', value => value), false);
});

test('TagInput source exposes separate controlled tag and draft state with validation feedback', () => {
  assert.match(componentSource, /value\?: readonly TagInputTag\[\]/);
  assert.match(componentSource, /defaultValue\?: readonly TagInputTag\[\]/);
  assert.match(componentSource, /inputValue\?: string/);
  assert.match(componentSource, /defaultInputValue\?: string/);
  assert.match(componentSource, /const tagsControlled = value !== undefined/);
  assert.match(componentSource, /const draftControlled = inputValue !== undefined/);
  assert.match(componentSource, /validateTag\?\.\(candidate, context\)/);
  assert.match(componentSource, /createTag \? createTag\(candidate, context\) : createDefaultTag/);
  assert.match(componentSource, /working\.length >= limit/);
  assert.match(componentSource, /hasTagValue\(working, candidate, getTagValueKey\)/);
  assert.match(componentSource, /role="alert"/);
  assert.match(componentSource, /aria-errormessage=\{state\.errorMessage\}/);
  assert.match(componentSource, /inputRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
});

test('TagInput source guards IME, parses paste, and defines keyboard removal and focus navigation', () => {
  assert.match(componentSource, /composingRef\.current \|\| nativeEvent\.isComposing \|\| nativeEvent\.keyCode === 229/);
  assert.match(componentSource, /splitTagInputValue\(combined, delimiters\)/);
  assert.match(componentSource, /commitCandidates\(parsed\.parts, 'paste'\)/);
  assert.match(componentSource, /event\.key === 'Backspace' && currentDraft\.length === 0/);
  assert.match(componentSource, /event\.key === 'Home'/);
  assert.match(componentSource, /event\.key === 'End'/);
  assert.match(componentSource, /direction === 'rtl'/);
  assert.match(componentSource, /setPendingFocus\(nextFocus\)/);
  assert.doesNotMatch(componentSource, /addEventListener\(['"]keydown|window\.onkeydown|document\.onkeydown/);
  assert.doesNotMatch(componentSource, /Mention|suggestion|combobox|@trigger/i);
});

test('TagInput source keeps id, value, label and repeated form values distinct', () => {
  assert.match(componentSource, /export interface TagInputTag extends TagInputIdentity/);
  assert.match(componentSource, /label\?: string/);
  assert.match(componentSource, /data-tag-id=\{tag\.id\}/);
  assert.match(componentSource, /tag\.label \?\? tag\.value/);
  assert.match(componentSource, /name=\{name\} type="hidden" value=\{tag\.value\}/);
  assert.match(componentSource, /ownerForm\.addEventListener\('reset', reset\)/);
  assert.match(componentSource, /readOnly=\{state\.readOnly\}/);
  assert.match(componentSource, /disabled=\{state\.disabled\}/);
});

test('TagInput styles use shared tokens, stable touch targets and system fallbacks', () => {
  assert.match(styles, /min-block-size:\s*var\(--inkra-touch-target\)/);
  assert.match(styles, /inline-size:\s*var\(--inkra-touch-target\)/);
  assert.match(styles, /flex-wrap:\s*wrap/);
  assert.match(styles, /overflow:\s*hidden/);
  assert.match(styles, /text-overflow:\s*ellipsis/);
  assert.match(styles, /@media \(max-width: 30rem\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /@media print/);
  assert.doesNotMatch(styles, /border-radius:\s*999|#[0-9a-f]{3,8}/i);
});

test('TagInput SSR keeps native input, semantic tag list, labels, hidden values and read-only state', { skip: !tagInputModule }, async () => {
  const { TagInput } = await import(tagInputModule);
  const markup = renderToStaticMarkup(createElement(TagInput, {
    'aria-label': 'Project tags',
    name: 'tags',
    readOnly: true,
    value: [
      { id: 'frontend', value: 'fe', label: 'Frontend' },
      { id: 'react', value: 'react' },
    ],
  }));
  assert.match(markup, /<ul[^>]*aria-label="Selected tags"/);
  assert.match(markup, /data-tag-id="frontend"/);
  assert.match(markup, />Frontend</);
  assert.match(markup, /<input[^>]*readonly=""/);
  assert.equal((markup.match(/type="hidden"/g) ?? []).length, 2);
  assert.match(markup, /name="tags"[^>]*value="fe"/);
  assert.doesNotMatch(markup, /inkra-tag-input__remove|inkra-tag-input__clear/);
});
