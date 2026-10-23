import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { Field, Input, Textarea } from '../dist/index.js';

test('Field associates label, description and error with a native Input', () => {
  const markup = renderToStaticMarkup(createElement(
    Field,
    {
      description: 'Used for delivery updates.',
      error: 'Enter a valid email.',
      id: 'email',
      label: 'Email',
      required: true,
    },
    createElement(Input, {
      'aria-describedby': 'consumer-note',
      'aria-errormessage': 'consumer-error',
      autoComplete: 'email',
      name: 'email',
      type: 'email',
    }),
  ));

  assert.match(markup, /<label class="inkra-field__label" for="email">/);
  assert.match(markup, /inkra-pencil-text__source">Email<\/span>/);
  assert.match(markup, /id="email-description"/);
  assert.match(markup, /id="email-error"/);
  assert.match(markup, /inkra-pencil-text__source">Used for delivery updates\.<\/span>/);
  assert.match(markup, /inkra-pencil-text__source">Enter a valid email\.<\/span>/);
  assert.match(markup, /<input[^>]*id="email"/);
  assert.match(markup, /<input[^>]*required=""/);
  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /aria-describedby="consumer-note email-description email-error"/);
  assert.match(markup, /aria-errormessage="consumer-error email-error"/);
  assert.match(markup, /type="email"/);
  assert.match(markup, /name="email"/);
  assert.match(markup, /autoComplete="email"/);
});

test('Field state is inherited by Input and Textarea while preserving native controls', () => {
  const disabled = renderToStaticMarkup(createElement(
    Field,
    { disabled: true, id: 'disabled-name', label: 'Name' },
    createElement(Input, { defaultValue: 'Ada' }),
  ));
  const readOnly = renderToStaticMarkup(createElement(
    Field,
    { id: 'notes', label: 'Notes', readOnly: true },
    createElement(Textarea, { defaultValue: 'Searchable editable DOM text' }),
  ));

  assert.match(disabled, /data-disabled="true"/);
  assert.match(disabled, /<input[^>]*disabled=""/);
  assert.match(readOnly, /data-readonly="true"/);
  assert.match(readOnly, /<textarea[^>]*readOnly=""/);
  assert.match(readOnly, />Searchable editable DOM text<\/textarea>/);
  assert.doesNotMatch(readOnly, /<textarea[^>]*>[\s\S]*inkra-pencil-text[\s\S]*<\/textarea>/);
});

test('Input forwards native props and renders decorative icon slots inside a pencil surface', () => {
  const icon = createElement('svg', { 'data-icon': 'mail' });
  const markup = renderToStaticMarkup(createElement(Input, {
    'aria-label': 'Search',
    'data-tracking-id': 'query',
    endIcon: icon,
    form: 'search-form',
    name: 'query',
    placeholder: 'Search',
    seed: 'search-input',
    size: 'lg',
    startIcon: icon,
  }));

  assert.match(markup, /data-size="lg"/);
  assert.match(markup, /inkra-input__underline/);
  assert.doesNotMatch(markup, /inkra-pencil-surface--outline/);
  assert.match(markup, /inkra-pencil-surface__ink/);
  assert.match(markup, /<input[^>]*aria-label="Search"/);
  assert.match(markup, /data-tracking-id="query"/);
  assert.match(markup, /form="search-form"/);
  assert.match(markup, /name="query"/);
  assert.match(markup, /placeholder="Search"/);
  assert.equal((markup.match(/aria-hidden="true" class="inkra-field-control__icon/g) ?? []).length, 2);
  assert.equal((markup.match(/data-icon="mail"/g) ?? []).length, 2);
  assert.match(markup, /class="inkra-editable-text"/);
  assert.match(markup, /data-renderer="inkra-editable-lettering"/);
});

test('Input and Textarea expose sm md lg geometry without replacing native text', () => {
  for (const size of ['sm', 'md', 'lg']) {
    const input = renderToStaticMarkup(createElement(Input, { defaultValue: size, size }));
    const textarea = renderToStaticMarkup(createElement(Textarea, { defaultValue: size, size }));
    assert.match(input, new RegExp(`data-size="${size}"`));
    assert.match(textarea, new RegExp(`data-size="${size}"`));
    assert.match(input, new RegExp(`<input[^>]*value="${size}"`));
    assert.match(textarea, new RegExp(`>${size}<\\/textarea>`));
  }
});

test('Standalone invalid controls retain consumer ARIA IDs and preserve the input underline', () => {
  const input = renderToStaticMarkup(createElement(Input, {
    'aria-describedby': 'input-help',
    'aria-errormessage': 'input-error',
    id: 'standalone-input',
    invalid: true,
  }));
  const textarea = renderToStaticMarkup(createElement(Textarea, {
    'aria-describedby': 'textarea-help',
    id: 'standalone-textarea',
    invalid: true,
  }));

  assert.match(input, /data-invalid="true"/);
  assert.match(input, /inkra-input__underline/);
  assert.doesNotMatch(input, /inkra-pencil-surface--danger/);
  assert.match(input, /aria-describedby="input-help"/);
  assert.match(input, /aria-errormessage="input-error"/);
  assert.match(input, /aria-invalid="true"/);
  assert.match(textarea, /inkra-pencil-surface--danger/);
  assert.match(textarea, /aria-describedby="textarea-help"/);
  assert.match(textarea, /aria-invalid="true"/);
});

test('Form styles keep native controls borderless and reserve solid borders for forced colors', () => {
  const styles = readFileSync(new URL('../src/form/styles.css', import.meta.url), 'utf8');
  const normal = styles.split('@media (forced-colors: active)')[0];
  assert.match(normal, /\.inkra-input,[\s\S]*\.inkra-textarea[\s\S]*border: 0;/);
  assert.match(normal, /font-family: var\(--inkra-font-body\)/);
  assert.match(normal, /\.inkra-field-control-hit:focus-within/);
  assert.match(normal, /\.inkra-input:focus-visible,[\s\S]*outline: 0;/);
  assert.doesNotMatch(normal, /border:\s*1px solid/);
  const nativeFocusRules = [...normal.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) => selector.includes(':focus')
      && /\.(?:inkra-input|inkra-textarea|inkra-input-root|inkra-field-control(?:-hit)?)(?![\w-])/.test(selector));
  assert.ok(nativeFocusRules.length > 0);
  for (const [, , declarations] of nativeFocusRules) {
    assert.doesNotMatch(declarations, /outline:\s*var\(--inkra-focus-width\)/);
  }
  assert.match(normal, /\.inkra-input__clear:focus-visible\s*\{[^}]*outline:\s*var\(--inkra-focus-width\)/);
  assert.match(normal, /data-pencil-editable-ready="true"[\s\S]*color: transparent/);
  assert.doesNotMatch(normal, /data-composing="true"/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*border: 1px solid CanvasText/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*display: none !important/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*::placeholder[\s\S]*color: GrayText !important/);
  assert.match(styles, /@media print[\s\S]*::placeholder[\s\S]*color: var\(--inkra-ink-subtle\) !important/);
  assert.match(styles, /@media print[\s\S]*::selection[\s\S]*color: var\(--inkra-ink\)/);
});

test('Editable lettering preserves native controls and password privacy contracts in source', () => {
  const source = readFileSync(new URL('../src/form/EditablePencilText.tsx', import.meta.url), 'utf8');
  const input = readFileSync(new URL('../src/form/Input.tsx', import.meta.url), 'utf8');
  const textarea = readFileSync(new URL('../src/form/Textarea.tsx', import.meta.url), 'utf8');
  const renderer = readFileSync(new URL('../src/internal/textRenderer.ts', import.meta.url), 'utf8');

  assert.match(source, /MAX_EDITABLE_LINE = 256/);
  assert.match(source, /MAX_EDITABLE_TEXT = 4096/);
  assert.match(source, /measureTextareaLines/);
  assert.match(source, /document\.createRange\(\)/);
  assert.match(source, /style\.direction/);
  assert.match(source, /complexScript\.test/);
  assert.match(source, /style\.textAlign/);
  assert.match(source, /cache: false/);
  assert.match(source, /compositionstart/);
  assert.match(source, /compositionend/);
  assert.match(source, /composingRef/);
  assert.doesNotMatch(source, /queueTextPaint|requestAnimationFrame/);
  assert.match(source, /new BoundedCache<PencilTextSprite>\(128, 4 \* 1024 \* 1024\)/);
  assert.match(source, /target\.drawImage\(buffer, 0, 0\)/);
  assert.match(source, /canvas\.width = canvas\.height = 0/);
  assert.match(source, /scheduleRef\.current\(\)/);
  assert.match(source, /control\.addEventListener\('scroll'/);
  assert.match(source, /form\?\.addEventListener\('reset'/);
  assert.match(source, /control\.scrollLeft/);
  assert.match(source, /control\.scrollTop/);
  assert.match(source, /document\.fonts/);
  assert.doesNotMatch(source, /textCache/);
  assert.doesNotMatch(source, /dispatchEvent\(new Event\('input'/);
  assert.match(input, /<input[\s\S]*<EditablePencilText/);
  assert.match(input, /editablePencilInputTypes/);
  assert.match(input, /\['text', 'search', 'email', 'url', 'tel', 'number'\]/);
  assert.match(textarea, /<textarea[\s\S]*<EditablePencilText/);
  assert.match(renderer, /cache\?: boolean/);
  assert.match(renderer, /cache \? textCache\.set/);
});

test('Password SSR remains native and never serializes a pencil copy of its value', () => {
  const markup = renderToStaticMarkup(createElement(Input, {
    defaultValue: 'private-value',
    type: 'password',
  }));

  assert.match(markup, /<input[^>]*type="password"/);
  assert.match(markup, /value="private-value"/);
  assert.doesNotMatch(markup, /class="inkra-editable-text"/);
  assert.doesNotMatch(markup, /inkra-pencil-text__source">private-value/);
  assert.doesNotMatch(markup, /data-pencil-value/);
});

test('Text and numeric inputs mount pencil enhancement without intercepting native semantics', () => {
  for (const type of [undefined, 'text', 'search', 'email', 'url', 'tel', 'number']) {
    const markup = renderToStaticMarkup(createElement(Input, { type }));
    assert.match(markup, /class="inkra-editable-text"/);
  }
  for (const type of ['password', 'date', 'file', 'color', 'range', 'checkbox']) {
    const markup = renderToStaticMarkup(createElement(Input, { type }));
    assert.doesNotMatch(markup, /class="inkra-editable-text"/);
  }
});

test('Numeric pencil text preserves native text-entry drafts without disabling focused stepping', () => {
  const source = readFileSync(new URL('../src/form/EditablePencilText.tsx', import.meta.url), 'utf8');
  assert.match(source, /control instanceof HTMLInputElement && control\.type === 'number'/);
  assert.match(source, /numericControl && \(nativeNumberEditing \|\| control\.validity\.badInput \|\| composingRef\.current\)/);
  assert.match(source, /control\.addEventListener\('beforeinput', beforeInput\)/);
  assert.match(source, /control\.addEventListener\('blur', finishNumberEditing\)/);
  assert.match(source, /control\.removeEventListener\('beforeinput', beforeInput\)/);
  assert.match(source, /control\.removeEventListener\('blur', finishNumberEditing\)/);
  assert.match(source, /const finishNumberEditing = \(\) => \{[\s\S]*?nativeNumberEditing = false;[\s\S]*?paint\(\)/);
  assert.doesNotMatch(source, /control\.addEventListener\('focus'/);
  assert.doesNotMatch(source, /control\.(?:value|type)\s*=(?!=)/);
  assert.doesNotMatch(source, /setSelectionRange\(/);
});
