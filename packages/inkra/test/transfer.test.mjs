import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  moveTransferKeys,
  normalizeTargetKeys,
  resolveTransferFocusIntent,
  splitTransferItems,
  transferKeysEqual,
  uniqueTransferItems,
} from '../src/transfer/model.ts';

const componentSource = await readFile(new URL('../src/transfer/index.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/transfer/styles.css', import.meta.url), 'utf8');
const transferModule = process.env.INKRA_TRANSFER_MODULE
  ? new URL(process.env.INKRA_TRANSFER_MODULE, import.meta.url).href
  : null;

const items = [
  { id: 'alpha', label: 'Alpha' },
  { id: 'beta', label: 'Beta' },
  { id: 'gamma', label: 'Gamma' },
  { id: 'delta', label: 'Delta' },
];

test('Transfer normalizes known target keys to item order and preserves unknown controlled data', () => {
  assert.deepEqual(normalizeTargetKeys(items, ['gamma', 'external', 'alpha', 'external']), ['alpha', 'gamma', 'external']);
  assert.deepEqual(splitTransferItems(items, ['gamma', 'alpha']), {
    source: [items[1], items[3]],
    target: [items[0], items[2]],
  });
});

test('Transfer movement preserves item order for single and batch actions', () => {
  assert.deepEqual(moveTransferKeys(items, ['gamma'], ['delta', 'alpha'], 'to-target'), ['alpha', 'gamma', 'delta']);
  assert.deepEqual(moveTransferKeys(items, ['alpha', 'gamma', 'external'], ['gamma'], 'to-source'), ['alpha', 'external']);
  assert.deepEqual(moveTransferKeys(items, ['gamma'], [], 'to-target'), ['gamma']);
});

test('Transfer uses the first stable id and does not render duplicate records twice', () => {
  assert.deepEqual(uniqueTransferItems([...items, { id: 'beta', label: 'Duplicate beta' }]), items);
});

test('Transfer focus waits for controlled acceptance and respects user focus changes', () => {
  assert.equal(resolveTransferFocusIntent('unchanged', true, false), 'wait');
  assert.equal(resolveTransferFocusIntent('unchanged', false, true), 'wait');
  assert.equal(resolveTransferFocusIntent('unchanged', false, false), 'cancel');
  assert.equal(resolveTransferFocusIntent('accepted', true, false), 'focus');
  assert.equal(resolveTransferFocusIntent('accepted', false, true), 'focus');
  assert.equal(resolveTransferFocusIntent('accepted', false, false), 'cancel');
  assert.equal(resolveTransferFocusIntent('mismatch', true, true), 'cancel');
  assert.equal(transferKeysEqual(['alpha', 'beta'], ['alpha', 'beta']), true);
  assert.equal(transferKeysEqual(['alpha'], ['beta']), false);
});

test('Transfer source exposes controlled state, visible batch semantics, disabled guards and focus recovery', () => {
  assert.match(componentSource, /targetKeys\?: readonly string\[\]/);
  assert.match(componentSource, /defaultTargetKeys\?: readonly string\[\]/);
  assert.match(componentSource, /const controlled = targetKeys !== undefined/);
  assert.match(componentSource, /if \(!controlled\) setUncontrolledTargetKeys\(next\)/);
  assert.match(componentSource, /selectableVisible\('source'\)/);
  assert.match(componentSource, /selectableVisible\('target'\)/);
  assert.match(componentSource, /filter\(item => !item\.disabled && !disabled\)/);
  assert.match(componentSource, /previousTargetKeys: \[\.\.\.currentTargetKeys\]/);
  assert.match(componentSource, /expectedTargetKeys: next/);
  assert.match(componentSource, /if \(valueResolution !== 'accepted'\)[\s\S]*?addEventListener\('focusin', cancel\)/);
  assert.match(componentSource, /valueResolution = transferKeysEqual\(currentTargetKeys, pendingFocus\.expectedTargetKeys\)/);
  assert.match(componentSource, /originUnavailable = pendingFocus\.origin != null[\s\S]*?matches\(':disabled'\)/);
  assert.match(componentSource, /resolveTransferFocusIntent\(valueResolution, originStillOwnsFocus, originUnavailable\) !== 'wait'/);
  assert.match(componentSource, /resolveTransferFocusIntent\('accepted', originStillOwnsFocus, originUnavailable\) !== 'focus'/);
  assert.match(componentSource, /documentFallback && unavailable/);
  assert.doesNotMatch(componentSource, /setTimeout\([^)]*setPendingFocus/);
  assert.match(componentSource, /control \?\? panelRefs\.current\[pendingFocus\.side\]/);
  assert.match(componentSource, /<Input/);
  assert.match(componentSource, /<Checkbox/);
  assert.match(componentSource, /<Button/);
  assert.doesNotMatch(componentSource, /export \{[^}]*resolveTransferFocusIntent/);
  assert.doesNotMatch(componentSource, /export type \{[^}]*TransferFocusIntent/);
  assert.doesNotMatch(componentSource, /DndContext|useSortable|draggable|onDrag/);
});

test('Transfer styles provide stable panels, mobile stacking, readable wrapping and system fallbacks', () => {
  assert.match(styles, /\.inkra-transfer__layout[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  assert.match(styles, /grid-template-rows:\s*auto auto auto minmax\(180px, 1fr\)/);
  assert.match(styles, /\[data-searchable\][\s\S]*grid-template-rows:\s*auto auto auto auto minmax\(180px, 1fr\)/);
  assert.match(styles, /min-height:\s*var\(--inkra-touch-target\)/);
  assert.match(styles, /overflow-wrap:\s*anywhere/);
  assert.match(styles, /container-type:\s*inline-size/);
  assert.match(styles, /@container inkra-transfer \(max-width: 720px\)/);
  assert.match(styles, /@container inkra-transfer[\s\S]*:dir\(rtl\)[^\n]*data-direction="to-target"[\s\S]*transform:\s*rotate\(90deg\)/);
  assert.match(styles, /@container inkra-transfer[\s\S]*:dir\(rtl\)[^\n]*data-direction="to-source"[\s\S]*transform:\s*rotate\(-90deg\)/);
  assert.match(styles, /\.inkra-transfer:dir\(rtl\)[^\n]*data-direction="to-target"[\s\S]*scaleX\(-1\)/);
  assert.match(styles, /\.inkra-transfer:dir\(rtl\)[^\n]*data-direction="to-source"[\s\S]*transform:\s*none/);
  assert.match(styles, /font-family:\s*var\(--inkra-font-body\)/);
  assert.match(componentSource, /className="inkra-transfer__panel-focus" variant="outline"/);
  assert.match(styles, /\.inkra-transfer__panel:focus-visible > \.inkra-transfer__panel-focus[\s\S]*opacity:\s*1/);
  assert.match(styles, /forced-colors: active[\s\S]*outline:\s*2px solid Highlight/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /@media print/);
  assert.doesNotMatch(styles, /border-radius:\s*(?:9|[1-9][0-9]+)px/);
});

test('Transfer SSR keeps both named panels, native inputs, disabled items, counts and empty target content', { skip: !transferModule }, async () => {
  const { Transfer } = await import(transferModule);
  const markup = renderToStaticMarkup(createElement(Transfer, {
    items: [
      { id: 'alpha', label: 'Alpha', description: 'First item' },
      { id: 'beta', label: 'Beta', disabled: true },
    ],
    targetKeys: [],
    labels: { sourceTitle: 'Candidates', targetTitle: 'Chosen', targetEmpty: 'Nothing chosen' },
  }));
  assert.match(markup, /<section[^>]*aria-labelledby=/);
  assert.match(markup, /Candidates/);
  assert.match(markup, /Chosen/);
  assert.match(markup, /Nothing chosen/);
  assert.match(markup, /type="checkbox"/);
  assert.match(markup, /type="search"|placeholder="Search available"/);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /data-transfer-item-id="alpha"/);
  assert.match(markup, /0\/0/);
});


test('Transfer normalizes large unknown-key lists with linear key reads', () => {
  const count = 2000;
  const values = Array.from({ length: count }, (_, index) => `external-${index}`);
  let reads = 0;
  const keys = new Proxy([...values, ...values], {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^\d+$/.test(property)) reads++;
      return Reflect.get(target, property, receiver);
    },
  });
  assert.deepEqual(normalizeTargetKeys([], keys), values);
  assert.ok(reads <= keys.length * 2, `Expected linear key reads, received ${reads}`);
});

test('Transfer retains first-record identity, special ids and unknown key order', () => {
  const first = { id: 'a\u0000b', label: 'First' };
  const second = { id: 'a', label: 'Second' };
  const records = [first, second, { id: 'a\u0000b', label: 'Duplicate' }];
  assert.deepEqual(normalizeTargetKeys(records, ['external', 'a', 'a\u0000b', 'external', 'other']), ['a\u0000b', 'a', 'external', 'other']);
  assert.deepEqual(splitTransferItems(records, ['a\u0000b']), { source: [second], target: [first] });
  assert.equal(splitTransferItems(records, ['a\u0000b']).target[0], first);
});

test('Transfer reuses data-derived state and uses collision-free key membership for effects', () => {
  assert.match(componentSource, /currentTargetKeys = useMemo/);
  assert.match(componentSource, /panels = useMemo/);
  assert.match(componentSource, /visibleSource = useMemo/);
  assert.match(componentSource, /visibleTarget = useMemo/);
  assert.match(componentSource, /itemsById\.get\(key\)/);
  assert.match(componentSource, /currentTargetSet\.has\(key\)/);
  assert.doesNotMatch(componentSource, /currentTargetKeys\.join|keys\.indexOf|uniqueItems\.find/);
});
