import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { Alert, Pagination, Rating, Skeleton, Tree } from '../dist/index.js';

test('Pagination supports simple summaries, hidden single pages and independently hidden arrows', () => {
  for (const totalPages of [0, 1, NaN, -1]) {
    assert.equal(render(h(Pagination, { totalPages, hideOnSinglePage: true })), '');
  }
  const empty = render(h(Pagination, { totalPages: 0, simple: true }));
  assert.match(empty, /0 \/ 0/);
  assert.equal((empty.match(/disabled=""/g) ?? []).length, 2);
  const summary = render(h(Pagination, { totalPages: 3, page: 99, simple: true, showPreviousNext: false, showFirstLast: true,
    renderSummary: (page, total) => h('span', null, `${page} of ${total}`) }));
  assert.match(summary, /3 of 3/);
  assert.doesNotMatch(summary, /aria-current|Previous page|Next page/);
  assert.match(summary, /First page/);
  assert.match(summary, /Last page/);
  const custom = render(h(Pagination, { totalPages: 3, page: 2, showPreviousNext: false,
    renderPage: (page, { isCurrent }) => h('span', { 'data-active': isCurrent }, `0${page}`) }));
  assert.match(custom, /aria-current="page"/);
  assert.match(custom, /aria-label="Page 2"/);
  assert.match(custom, /data-active="true">02/);
  assert.equal((custom.match(/<button/g) ?? []).length, 3);
  assert.doesNotMatch(summary + custom, / simple=| renderPage=| renderSummary=| showPreviousNext=| hideOnSinglePage=/);
});

test('Alert visibility is opt-in and controlled open wins over its default', () => {
  assert.equal(render(h(Alert.Root, { defaultOpen: false }, 'Hidden')), '');
  assert.equal(render(h(Alert.Root, { open: false }, 'Hidden')), '');
  const html = render(h(Alert.Root, { open: true, defaultOpen: false, closable: true, closeLabel: 'Close notice' }, 'Details'));
  assert.match(html, /aria-label="Close notice"/);
  assert.match(html, /type="button"/);
  assert.match(html, /inkra-pencil-icon/);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, / closable=| open=| defaultOpen=| closeLabel=/);
  assert.doesNotMatch(render(h(Alert.Root, null, 'Details')), /<button/);
});

test('Rating submits only the normalized committed value and preserves form association', () => {
  const html = render(h(Rating, { name: 'quality', form: 'survey', defaultValue: 3.7, step: .5, hoverPreview: false }));
  const input = html.match(/<input[^>]*>/)?.[0] ?? '';
  for (const attribute of ['type="hidden"', 'name="quality"', 'form="survey"', 'value="3.5"']) assert(input.includes(attribute));
  assert.match(html, /aria-valuenow="3.5"/);
  assert.doesNotMatch(html, / hoverPreview=| onPreviewChange=|data-previewing/);
  const disabled = render(h(Rating, { name: 'quality', value: 2, disabled: true }));
  assert.match(disabled, /<input[^>]*disabled=""/);
  const readOnly = render(h(Rating, { name: 'quality', value: 2, readOnly: true }));
  assert.doesNotMatch(readOnly, /<input[^>]*disabled=/);
});

test('Skeleton exposes CSS dimensions with style overrides and opt-in pulse', () => {
  const html = render(h(Skeleton, { width: '60%', height: 24, animation: 'pulse', style: { height: 32 } }));
  assert.match(html, /width:60%;height:32px/);
  assert.match(html, /data-animation="pulse"/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, / width=| height=| animation=/);
});

test('Tree exposes bounded indentation and row spacing without leaking styling props', () => {
  for (const [indent, expected] of [[0, 0], [-4, 0], [40, 40], [NaN, 24], [Infinity, 24]]) {
    const html = render(h(Tree.Root, { 'aria-label': 'Folders', indent, size: 'lg' },
      h(Tree.Item, { id: 'drafts', textValue: 'Drafts' }, h(Tree.ItemContent, null, h(Tree.ItemTitle, null, 'Drafts')))));
    assert.match(html, new RegExp(`--inkra-tree-indent:${expected}px`));
    assert.match(html, /data-size="lg"/);
    assert.doesNotMatch(html, / indent=| size=/);
  }
});
