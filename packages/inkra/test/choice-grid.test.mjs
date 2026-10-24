import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ChoiceGrid, ChoiceGridOption } from '../dist/choice-grid/index.js';

test('ChoiceGrid delegates single selection to native RadioGroup semantics', () => {
  const markup = renderToStaticMarkup(createElement(
    ChoiceGrid,
    {
      columns: 3,
      defaultValue: 'balanced',
      description: 'Choose one density.',
      error: 'Review this choice.',
      label: 'Density',
      name: 'density',
    },
    createElement(ChoiceGridOption, {
      description: 'More room for supporting copy.',
      icon: createElement('span', { 'data-option-icon': 'spacious' }),
      label: 'Spacious',
      value: 'spacious',
    }),
    createElement(ChoiceGridOption, {
      image: { src: '/sample.png', width: 160, height: 80 },
      label: 'Balanced',
      value: 'balanced',
    }),
    createElement(ChoiceGridOption, {
      disabled: true,
      label: 'Compact',
      value: 'compact',
    }),
  ));

  assert.match(markup, /data-type="single"/);
  assert.match(markup, /data-columns="3"/);
  assert.match(markup, /<fieldset/);
  assert.equal((markup.match(/type="radio"/g) ?? []).length, 3);
  assert.equal((markup.match(/name="density"/g) ?? []).length, 3);
  assert.match(markup, /value="balanced"[^>]*checked=""|checked=""[^>]*value="balanced"/);
  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /aria-describedby="[^"]*description[^"]*error/);
  assert.match(markup, /aria-errormessage="[^"]*error/);
  assert.match(markup, /<img[^>]*src="\/sample\.png"[^>]*alt=""/);
  assert.match(markup, /aria-hidden="true" class="inkra-choice-grid__media" data-kind="image"/);
  assert.match(markup, /data-option-icon="spacious"/);
  assert.match(markup, /inkra-choice-grid__option-label[^>]*>.*inkra-pencil-text/);
  assert.match(markup, /inkra-pencil-text__source">Spacious/);
  assert.match(markup, /disabled=""/);
  assert.doesNotMatch(markup, /role="radio"|role="radiogroup"|<button/);
});

test('ChoiceGrid multiple mode reuses native checkboxes for controlled values and form names', () => {
  const markup = renderToStaticMarkup(createElement(
    ChoiceGrid,
    {
      label: 'Included sections',
      name: 'sections',
      type: 'multiple',
      values: ['notes', 'history'],
    },
    createElement(ChoiceGridOption, { label: 'Notes', value: 'notes' }),
    createElement(ChoiceGridOption, { label: 'Metadata', value: 'metadata' }),
    createElement(ChoiceGridOption, { label: 'History', value: 'history' }),
  ));

  assert.match(markup, /^<fieldset/);
  assert.match(markup, /data-type="multiple"/);
  assert.equal((markup.match(/type="checkbox"/g) ?? []).length, 3);
  assert.equal((markup.match(/name="sections"/g) ?? []).length, 3);
  assert.equal((markup.match(/checked=""/g) ?? []).length, 2);
  assert.equal((markup.match(/data-choice-grid-value=""/g) ?? []).length, 3);
  assert.match(markup, /value="notes"/);
  assert.match(markup, /value="metadata"/);
  assert.match(markup, /value="history"/);
  assert.doesNotMatch(markup, /role="checkbox"|<button/);
});

test('ChoiceGrid multiple defaults stay delegated to uncontrolled Checkbox inputs', () => {
  const markup = renderToStaticMarkup(createElement(
    ChoiceGrid,
    {
      defaultValues: ['summary'],
      description: 'Select any number.',
      label: 'Output',
      name: 'output',
      type: 'multiple',
    },
    createElement(ChoiceGridOption, { label: 'Summary', value: 'summary' }),
    createElement(ChoiceGridOption, { label: 'Details', value: 'details' }),
  ));

  assert.equal((markup.match(/checked=""/g) ?? []).length, 1);
  assert.match(markup, /value="summary"[^>]*checked=""|checked=""[^>]*value="summary"/);
  assert.match(markup, /aria-describedby="[^"]*description/);
  assert.doesNotMatch(markup, /defaultValues=|values=/);
});

test('ChoiceGrid preserves arbitrary ReactNode option labels without wrapping their content in PencilText', () => {
  const markup = renderToStaticMarkup(createElement(
    ChoiceGrid,
    { label: 'Output', name: 'output' },
    createElement(ChoiceGridOption, {
      label: createElement('strong', { 'data-custom-label': true }, 'Custom label'),
      value: 'custom',
    }),
  ));
  assert.match(markup, /data-custom-label="true">Custom label<\/strong>/);
  assert.doesNotMatch(markup, /inkra-pencil-text__source">Custom label/);
});

test('ChoiceGrid source composes selection primitives without a parallel selection store', () => {
  const source = readFileSync(new URL('../src/choice-grid/index.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/choice-grid/styles.css', import.meta.url), 'utf8');

  assert.match(source, /import \{ Checkbox \} from '\.\.\/selection\/Checkbox\.js'/);
  assert.match(source, /import \{ RadioGroup, RadioGroupItem \} from '\.\.\/selection\/RadioGroup\.js'/);
  assert.match(source, /querySelectorAll<HTMLInputElement>\('input\[type="checkbox"\]\[data-choice-grid-value\]'/);
  // Paging owns its page index; selection still belongs to native controls or
  // controlled props. The runtime tests verify off-page values and native reset.
  assert.match(source, /const \[page, setPage\] = useState\(0\)/);
  assert.equal((source.match(/\buseState\s*\(/g) ?? []).length, 1);
  assert.doesNotMatch(source, /useReducer/);
  assert.match(styles, /repeat\(auto-fit, minmax\(min\(100%, var\(--inkra-choice-grid-min-item/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /container-type:\s*inline-size/);
  assert.match(styles, /@container \(max-width: 640px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*Highlight/);
  assert.match(styles, /:has\(\.inkra-selection-control__input:focus-visible\)/);
  assert.match(source, /typeof label === 'string'[\s\S]*<PencilText seed=\{`\$\{resolvedSeed\}-label`\}>\{label\}<\/PencilText>/);
  assert.match(source, /className="inkra-choice-grid__focus"/);
  assert.match(styles, /\.inkra-choice-grid__focus \{[\s\S]*--inkra-accent-strong: var\(--inkra-focus\)/);
  assert.match(styles, /focus-visible\) \.inkra-choice-grid__focus \{\s*opacity: 1/);
  assert.match(styles, /\.inkra-choice-grid__control \.inkra-selection-control__focus-ring \{\s*display: none !important/);
  assert.doesNotMatch(styles.split('@media (forced-colors: active)')[0], /focus-visible\)[^{]*\{[^}]*outline:\s*var\(--inkra-focus-width\) solid var\(--inkra-focus\)/);
  assert.doesNotMatch(styles.split('@media (forced-colors: active)')[0], /border:\s*1px solid/);
  assert.doesNotMatch(source, /ResizeObserver/);
});

