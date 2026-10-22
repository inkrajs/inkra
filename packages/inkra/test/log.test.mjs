import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { isLogAppend, isNearLogBottom, shouldFollowLogUpdate } from '../src/log/model.ts';

const componentSource = readFileSync(new URL('../src/log/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/log/styles.css', import.meta.url), 'utf8');
const sharedStyles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const logModule = process.env.INKRA_LOG_MODULE
  ? new URL(process.env.INKRA_LOG_MODULE, import.meta.url).href
  : null;

test('Log append detection requires stable ids and preserves caller order', () => {
  assert.equal(isLogAppend(['a', 'b'], ['a', 'b', 'c']), true);
  assert.equal(isLogAppend(['a', 'b'], ['b', 'a', 'c']), false);
  assert.equal(isLogAppend(['a', 'b'], ['a', 'b']), false);
  assert.equal(isLogAppend(['a', 'b'], ['a']), false);
});

test('Log follows only initial or append updates while active and near the bottom', () => {
  const base = {
    initial: false,
    nearBottom: true,
    paused: false,
    previousItemIds: ['a'],
    nextItemIds: ['a', 'b'],
    previousVisibleIds: ['a'],
    nextVisibleIds: ['a', 'b'],
  };
  assert.equal(shouldFollowLogUpdate(base), true);
  assert.equal(shouldFollowLogUpdate({ ...base, paused: true }), false);
  assert.equal(shouldFollowLogUpdate({ ...base, nearBottom: false }), false);
  assert.equal(shouldFollowLogUpdate({ ...base, nextItemIds: ['b', 'a'] }), false);
  assert.equal(shouldFollowLogUpdate({ ...base, nextVisibleIds: ['a'] }), false);
  assert.equal(shouldFollowLogUpdate({ ...base, initial: true, previousItemIds: [], previousVisibleIds: [] }), true);
});

test('Log bottom proximity uses a clamped threshold', () => {
  assert.equal(isNearLogBottom({ scrollHeight: 1000, scrollTop: 750, clientHeight: 220 }, 32), true);
  assert.equal(isNearLogBottom({ scrollHeight: 1000, scrollTop: 700, clientHeight: 220 }, 32), false);
  assert.equal(isNearLogBottom({ scrollHeight: 100, scrollTop: 0, clientHeight: 100 }, -10), true);
  assert.equal(isNearLogBottom({ scrollHeight: 1000, scrollTop: 700, clientHeight: 220 }, Number.NaN), false);
});

test('Log source keeps the long list out of live regions and exposes keyboard recovery', () => {
  assert.match(componentSource, /<ol className="inkra-log__list">/);
  assert.match(componentSource, /<PencilLine className="inkra-log__toolbar-divider"/);
  assert.match(componentSource, /index > 0 \? <PencilLine className="inkra-log__item-divider"/);
  assert.doesNotMatch(componentSource, /aria-live|role="log"/);
  assert.match(componentSource, /event\.key === 'Home'/);
  assert.match(componentSource, /event\.key === 'End'/);
  assert.match(componentSource, /aria-pressed=\{resolvedPaused\}/);
  assert.match(componentSource, /filteredLevels === undefined/);
  assert.match(componentSource, /key=\{item\.id\}/);
});

test('Log CSS provides a bounded scroll region, focus visibility and forced-color fallback', () => {
  assert.match(styles, /\.inkra-log__viewport[\s\S]*overflow: auto/);
  assert.match(styles, /\.inkra-log__viewport:focus-visible/);
  assert.match(styles, /scrollbar-gutter: stable/);
  assert.match(styles, /\.inkra-log__toolbar-divider,[\s\S]*position: absolute/);
  assert.doesNotMatch(styles, /border-block-(?:start|end)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(sharedStyles, /@media \(forced-colors: active\), print[\s\S]*\.inkra-pencil-line[\s\S]*background: CanvasText/);
});

test('Log SSR preserves list order, optional text, time semantics, filtering and empty states', { skip: !logModule }, async () => {
  const { Log } = await import(logModule);
  const items = [
    { id: 'second', level: 'warning', time: '10:02', dateTime: '2026-10-23T10:02:00+08:00', content: 'Second record' },
    { id: 'first', level: 'info', content: createElement('strong', null, 'Custom body') },
  ];
  const levels = [
    { value: 'info', label: 'Information', tone: 'info' },
    { value: 'warning', label: 'Warning', tone: 'warning' },
  ];
  const markup = renderToStaticMarkup(createElement(Log, {
    items,
    levels,
    filteredLevels: ['warning'],
    paused: true,
    labels: { list: 'Build output', empty: 'Empty', noMatches: 'No matches' },
  }));
  assert.match(markup, /role="region"/);
  assert.match(markup, /aria-label="Build output"/);
  assert.match(markup, /tabindex="0"/);
  assert.match(markup, /<time dateTime="2026-10-23T10:02:00\+08:00"/);
  assert.match(markup, /Second record/);
  assert.doesNotMatch(markup, /Custom body/);
  assert.match(markup, /aria-pressed="true"/);
  assert.doesNotMatch(markup, /aria-live|role="log"/);

  const customBody = renderToStaticMarkup(createElement(Log, {
    items: [items[1]],
    levels,
    showFollowControl: false,
    showLevelFilter: false,
  }));
  assert.match(customBody, /<strong>Custom body<\/strong>/);

  const emptyMarkup = renderToStaticMarkup(createElement(Log, {
    items: [],
    labels: { empty: 'Nothing yet' },
    showFollowControl: false,
  }));
  assert.match(emptyMarkup, /Nothing yet/);
});
