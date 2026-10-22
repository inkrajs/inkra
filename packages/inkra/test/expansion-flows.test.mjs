import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Steps, Timeline, Upload } from '../dist/index.js';

test('Upload renders a native picker without inventing transfer state', () => {
  const html = renderToStaticMarkup(h(Upload, { accept: 'image/*,.pdf', maxFiles: 2 }));
  assert.match(html, /role="button"/);
  assert.match(html, /type="file"/);
  assert(html.indexOf('type="file"') < html.indexOf('role="button"'), 'the hidden input stays outside the role=button dropzone');
  assert.match(html, /accept="image\/\*,\.pdf"/);
  assert.doesNotMatch(html, /Uploading|Uploaded/);
});

test('Upload source connects transport to abort and progress contracts', async () => {
  const source = await readFile(new URL('../src/upload/index.tsx', import.meta.url), 'utf8');
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /reportProgress/);
  assert.match(source, /controller\.abort\(\)/);
  assert.match(source, /if \(!item \|\| !onUpload/);
  assert.match(source, /matchesAccept/);
  assert.match(source, /file\.size > maxSize/);
  assert.match(source, /if \(!mounted\.current \|\| controller\.signal\.aborted\) return undefined/);
  assert.match(source, /itemsRef\.current\.some\(candidate => candidate\.id === item\.id\)/);
});

test('Upload disables item changes and calls a selected action Upload', () => {
  const file = { name: 'draft.pdf', size: 128 };
  const disabledHtml = renderToStaticMarkup(h(Upload, {
    disabled: true,
    defaultFiles: [{ id: 'draft', file, status: 'uploading', progress: 30 }],
    onUpload() {},
  }));
  assert.equal((disabledHtml.match(/<button[^>]+disabled=""/g) ?? []).length, 2);

  const selectedHtml = renderToStaticMarkup(h(Upload, {
    autoUpload: false,
    defaultFiles: [{ id: 'draft', file, status: 'selected' }],
    onUpload() {},
  }));
  assert.match(selectedHtml, />Upload</);
  assert.doesNotMatch(selectedHtml, />Retry</);
  assert.doesNotMatch(selectedHtml, /name="/);
});

test('Steps preserves ordered semantics and only makes configured steps interactive', () => {
  const items = [
    { id: 'one', title: 'One' },
    { id: 'two', title: 'Two', status: 'error' },
    { id: 'three', title: 'Three', disabled: true },
  ];
  const staticHtml = renderToStaticMarkup(h(Steps, { current: 0, items }));
  assert.match(staticHtml, /^<ol/);
  assert.match(staticHtml, /aria-current="step"/);
  assert.doesNotMatch(staticHtml, /<button/);

  const interactiveHtml = renderToStaticMarkup(h(Steps, { current: 0, items, onStepChange() {} }));
  assert.equal((interactiveHtml.match(/<button/g) ?? []).length, 3);
  assert.match(interactiveHtml, /disabled=""/);
  assert.match(interactiveHtml, /data-status="error"/);
});

test('Timeline renders ordered items and machine-readable dates', () => {
  const html = renderToStaticMarkup(h(Timeline, { items: [
    { id: 'draft', date: 'October 20', dateTime: '2026-10-20', title: 'Draft', description: 'First version' },
    { id: 'ready', date: 'October 22', title: 'Ready', content: h('a', { href: '#details' }, 'Details') },
  ] }));
  assert.match(html, /^<ol/);
  assert.match(html, /<time[^>]+dateTime="2026-10-20"/);
  assert.match(html, /href="#details"/);
  assert.equal((html.match(/<li/g) ?? []).length, 2);
});
