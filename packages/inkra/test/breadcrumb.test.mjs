import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { Breadcrumb, ContextMenu, DropdownMenu } from '../dist/index.js';

const styles = readFileSync(new URL('../src/breadcrumb/styles.css', import.meta.url), 'utf8');

test('Breadcrumb retains navigation, ordered paths and current-page semantics', () => {
  const html = render(h(Breadcrumb.Root, { 'aria-label': 'Current location', dir: 'rtl' }, h(Breadcrumb.List, null,
    h(Breadcrumb.Item, null, h(Breadcrumb.Link, { href: '/docs' }, 'Docs')),
    h(Breadcrumb.Separator), h(Breadcrumb.Item, null, h(Breadcrumb.Page, null, 'Components')))));
  assert.match(html, /<nav[^>]*aria-label="Current location"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /<ol/);
  assert.match(html, /<a[^>]*href="\/docs"/);
  assert.match(html, /data-variant="link"/);
  assert.match(html, /inkra-button__underline/);
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

test('Breadcrumb links support logical start and end icons without changing anchor semantics', () => {
  const html = render(h(Breadcrumb.Link, {
    href: '/docs',
    startIcon: h('i', { 'data-icon': 'start' }),
    endIcon: h('i', { 'data-icon': 'end' }),
  }, 'Docs'));
  assert.match(html, /^<a/);
  assert.match(html, /href="\/docs"/);
  assert.match(html, /inkra-button__icon--start/);
  assert.match(html, /inkra-button__icon--end/);
  assert(html.indexOf('data-icon="start"') < html.indexOf('>Docs<'));
  assert(html.indexOf('>Docs<') < html.indexOf('data-icon="end"'));
});

test('Breadcrumb page uses the same logical icon slots as interactive items', () => {
  const html = render(h(Breadcrumb.Page, {
    startIcon: h('i', { 'data-icon': 'start' }),
    endIcon: h('i', { 'data-icon': 'end' }),
  }, 'Current'));
  assert.match(html, /aria-current="page"/);
  assert.match(html, /inkra-breadcrumb__icon--start/);
  assert.match(html, /inkra-breadcrumb__label/);
  assert.match(html, /inkra-breadcrumb__icon--end/);
  assert(html.indexOf('data-icon="start"') < html.indexOf('>Current<'));
  assert(html.indexOf('>Current<') < html.indexOf('data-icon="end"'));
});

test('Breadcrumb page, link and menu trigger share stable header geometry', () => {
  for (const token of ['item-height', 'item-padding', 'item-font-size', 'item-icon-size', 'item-gap']) {
    assert.match(styles, new RegExp(`--inkra-breadcrumb-${token}:`));
  }
  for (const property of ['visual-height', 'visual-padding', 'font-size', 'icon-size', 'content-gap']) {
    assert.match(styles, new RegExp(`--inkra-button-${property}: var\\(--inkra-breadcrumb-item-`));
  }
  assert.match(styles, /\.inkra-breadcrumb__page\s*\{[\s\S]*?font-size: var\(--inkra-breadcrumb-item-font-size\);[\s\S]*?gap: var\(--inkra-breadcrumb-item-gap\);[\s\S]*?justify-content: center;/);
  assert.match(styles, /\.inkra-breadcrumb__page\s*\{[\s\S]*?min-height: var\(--inkra-breadcrumb-item-height\);[\s\S]*?min-width: var\(--inkra-breadcrumb-item-height\);[\s\S]*?padding-inline: var\(--inkra-breadcrumb-item-padding\);/);
  assert.match(styles, /\.inkra-breadcrumb__label,\s*\.inkra-breadcrumb__label > \.inkra-pencil-text\s*\{[\s\S]*?align-items: center;[\s\S]*?display: inline-flex;/);
  assert.match(styles, /\.inkra-breadcrumb__label > \.inkra-pencil-text > \.inkra-pencil-text__source\s*\{[\s\S]*?display: block;/);
  assert.match(styles, /\.inkra-breadcrumb__icon\s*\{[\s\S]*?flex: 0 0 var\(--inkra-breadcrumb-item-icon-size\);/);
  assert.match(styles, /\.inkra-breadcrumb__link \.inkra-button__label > \.inkra-pencil-text,[\s\S]*?white-space: normal;/);
  assert.match(styles, /\.inkra-breadcrumb :is\(\.inkra-breadcrumb__link, \.inkra-breadcrumb__trigger\) \.inkra-button__surface\s*\{[\s\S]*?height: auto;[\s\S]*?min-height: var\(--inkra-breadcrumb-item-height\);[\s\S]*?min-width: var\(--inkra-breadcrumb-item-height\);/);
  assert.match(styles, /\.inkra-breadcrumb :is\(\.inkra-breadcrumb__link, \.inkra-breadcrumb__trigger\) \.inkra-button__content\s*\{[\s\S]*?max-width: 100%;[\s\S]*?min-width: 0;/);
  assert.match(styles, /\.inkra-breadcrumb :is\(\.inkra-breadcrumb__link, \.inkra-breadcrumb__trigger\) \.inkra-button__focus-ring\s*\{[\s\S]*?height: 100%;[\s\S]*?inset-inline: 0;[\s\S]*?transform: none;/);
  assert.match(styles, /\.inkra-breadcrumb :is\(\.inkra-breadcrumb__link, \.inkra-breadcrumb__trigger\):hover[\s\S]*?transform: none;/);
  assert.match(styles, /\.inkra-breadcrumb\s*\{[\s\S]*?max-width: 100%;[\s\S]*?min-width: 0;/);
  assert.match(styles, /\.inkra-breadcrumb__list\s*\{[^}]*flex-wrap: wrap;[^}]*max-width: 100%;/);
});

test('Breadcrumb menu triggers reuse DropdownMenu with native button and disabled behavior', () => {
  const enabled = render(h(DropdownMenu.Root, null, h(Breadcrumb.MenuTrigger, { endIcon: h('i', null, 'v') }, 'Workspace')));
  assert.match(enabled, /<button/);
  assert.match(enabled, /aria-haspopup="menu"/);
  assert.match(enabled, /data-variant="link"/);
  assert.match(enabled, /inkra-breadcrumb__trigger/);
  const disabled = render(h(DropdownMenu.Root, null, h(Breadcrumb.MenuTrigger, { disabled: true }, 'Workspace')));
  assert.match(disabled, /disabled=""/);
  assert.match(disabled, /data-disabled=""/);
});

test('Breadcrumb context links keep one real anchor for pointer, keyboard and long-press menus', () => {
  const html = render(h(ContextMenu.Root, null,
    h(Breadcrumb.ContextLink, { href: '/docs', longPress: true }, 'Docs')));
  assert.match(html, /<a[^>]*data-context-menu-trigger=""/);
  assert.match(html, /href="\/docs"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /inkra-breadcrumb__context-link/);
  const disabled = render(h(ContextMenu.Root, null,
    h(Breadcrumb.ContextLink, { href: '/private', disabled: true, longPress: true }, 'Private')));
  assert.match(disabled, /aria-disabled="true"/);
  assert.match(disabled, /tabindex="-1"/);
  assert.doesNotMatch(disabled, /href="\/private"/);
  const loading = render(h(ContextMenu.Root, null,
    h(Breadcrumb.ContextLink, { href: '/loading', loading: true, longPress: true }, 'Loading')));
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /aria-disabled="true"/);
  assert.match(loading, /tabindex="-1"/);
  assert.doesNotMatch(loading, /href="\/loading"/);
});
