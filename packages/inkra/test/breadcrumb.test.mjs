import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { Breadcrumb } from '../dist/index.js';

test('Breadcrumb retains navigation, ordered paths and current-page semantics', () => {
  const html = render(h(Breadcrumb.Root, { 'aria-label': 'Current location', dir: 'rtl' }, h(Breadcrumb.List, null,
    h(Breadcrumb.Item, null, h(Breadcrumb.Link, { href: '/docs' }, 'Docs')),
    h(Breadcrumb.Separator), h(Breadcrumb.Item, null, h(Breadcrumb.Page, null, 'Components')))));
  assert.match(html, /<nav[^>]*aria-label="Current location"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /<ol/);
  assert.match(html, /<a[^>]*href="\/docs"/);
  assert.match(html, /role="presentation" aria-hidden="true"/);
  assert.match(html, /<span[^>]*aria-current="page"/);
  assert.doesNotMatch(html, /role="tab"|tabindex="0"/);
});

test('Breadcrumb supports custom separators, disabled links and native attributes', () => {
  const html = render(h(Breadcrumb.Root, { id: 'path' }, h(Breadcrumb.List, null,
    h(Breadcrumb.Item, null, h(Breadcrumb.Link, { href: '/private', disabled: true }, 'Private')),
    h(Breadcrumb.Separator, { className: 'custom' }, '>'),
    h(Breadcrumb.Item, null, h(Breadcrumb.Page, null, 'Here')))));
  assert.match(html, /aria-label="Breadcrumb"/);
  assert.match(html, /aria-disabled="true"/);
  assert.doesNotMatch(html, /href="\/private"/);
  assert.match(html, /inkra-breadcrumb__separator custom/);
  assert.match(html, /&gt;/);
});
