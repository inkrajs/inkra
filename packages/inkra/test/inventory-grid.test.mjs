import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InventoryGrid, assertInventoryContainers, projectInventoryMove, rotateInventoryCells, validateInventoryPlacement } from '../dist/inventory-grid/index.js';
import { createInkraTranslator } from '../dist/i18n/index.js';

const shape = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
const seed = () => [{ id: 'a', columns: 5, rows: 5, disabledCells: [{ x: 4, y: 4 }], items: [
  { id: 'l', cells: shape, position: { x: 0, y: 0 } },
  { id: 'dot', cells: [{ x: 0, y: 0 }], position: { x: 1, y: 0 } },
] }, { id: 'b', columns: 4, rows: 4, items: [] }];
const placement = (overrides = {}) => ({ itemId: 'l', containerId: 'a', position: { x: 2, y: 2 }, rotation: 0, ...overrides });

test('normalizes shapes, deduplicates cells and rotates around the occupied bounding box', () => {
  assert.deepEqual(rotateInventoryCells(shape, 90), [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }]);
  assert.deepEqual(rotateInventoryCells(shape, 180), [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
  assert.deepEqual(rotateInventoryCells(shape, 270), [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]);
  assert.deepEqual(rotateInventoryCells([{ x: 4, y: 8 }, { x: 4, y: 8 }]), [{ x: 0, y: 0 }]);
  assert.deepEqual(rotateInventoryCells([{ x: Infinity, y: 0 }]), []);
  assert.deepEqual(rotateInventoryCells(Array.from({ length: 4097 }, () => ({ x: 0, y: 0 }))), []);
});
test('a second item fits in an irregular item hole and initial validation accepts it', () => {
  assert.doesNotThrow(() => assertInventoryContainers(seed()));
  assert.equal(validateInventoryPlacement(seed(), placement({ itemId: 'dot', position: { x: 1, y: 0 } })).valid, true);
});
test('checks occupied cells rather than bounding rectangles', () => {
  assert.equal(validateInventoryPlacement(seed(), placement({ itemId: 'dot', position: { x: 0, y: 1 } })).reason, 'occupied');
  assert.equal(validateInventoryPlacement(seed(), placement({ itemId: 'dot', position: { x: 1, y: 0 } })).valid, true);
});
test('rejects boundaries, blocked cells and malformed moves', () => {
  assert.equal(validateInventoryPlacement(seed(), placement({ position: { x: 4, y: 0 } })).reason, 'bounds');
  assert.equal(validateInventoryPlacement(seed(), placement({ position: { x: -1, y: 0 } })).reason, 'bounds');
  assert.equal(validateInventoryPlacement(seed(), placement({ itemId: 'dot', position: { x: 4, y: 4 } })).reason, 'blocked');
  assert.equal(validateInventoryPlacement(seed(), placement({ position: { x: 1.5, y: 0 } })).reason, 'shape');
  assert.equal(validateInventoryPlacement(seed(), placement({ rotation: 45 })).reason, 'shape');
});
test('moves within a bag immutably and preserves no-op reference', () => {
  const original = seed();
  const next = projectInventoryMove(original, placement());
  assert.deepEqual(next[0].items[0].position, { x: 2, y: 2 });
  assert.deepEqual(original[0].items[0].position, { x: 0, y: 0 });
  assert.equal(next[1], original[1]);
  assert.equal(projectInventoryMove(original, placement({ position: { x: 0, y: 0 } })), original);
});
test('transfers across bags without dropping items or changing metadata', () => {
  const original = seed();
  const next = projectInventoryMove(original, placement({ containerId: 'b', position: { x: 1, y: 1 }, rotation: 90 }));
  assert.deepEqual(next.map(container => container.items.map(item => item.id)), [['dot'], ['l']]);
  assert.equal(next[1].items[0].rotation, 90);
  assert.deepEqual(next[1].items[0].cells, shape);
  assert.equal(original[0].items.length, 2);
});
test('rejected moves preserve all items and the caller reference', () => {
  const original = seed();
  assert.equal(projectInventoryMove(original, placement({ position: { x: 4, y: 4 } })), original);
  assert.equal(projectInventoryMove(original, placement(), () => false), original);
  assert.equal(projectInventoryMove(original, placement({ containerId: 'missing' })), original);
});
test('custom rules receive target, source and actual rotated absolute cells', () => {
  let seen;
  const result = validateInventoryPlacement(seed(), placement({ containerId: 'b', rotation: 90, position: { x: 1, y: 1 } }), context => { seen = context; return false; });
  assert.equal(result.reason, 'rule');
  assert.equal(seen.source.id, 'a'); assert.equal(seen.target.id, 'b');
  assert.deepEqual(seen.cells, [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }]);
});
test('disabled containers, disabled items and nonrotatable items reject moves', () => {
  const containers = seed();
  containers[1].disabled = true;
  assert.equal(validateInventoryPlacement(containers, placement({ containerId: 'b' })).reason, 'disabled');
  containers[0].items[0].rotatable = false;
  assert.equal(validateInventoryPlacement(containers, placement({ rotation: 90 })).reason, 'disabled');
  containers[0].items[0].disabled = true;
  assert.equal(validateInventoryPlacement(containers, placement()).reason, 'disabled');
});
test('initial data rejects duplicate ids, overlap, invalid size and blocked items', () => {
  const duplicate = seed(); duplicate[1].items.push(duplicate[0].items[0]);
  assert.throws(() => assertInventoryContainers(duplicate), /duplicate item id/);
  const overlap = seed(); overlap[0].items[1].position = { x: 0, y: 0 };
  assert.throws(() => assertInventoryContainers(overlap), /overlapping/);
  const large = seed(); large[0].columns = 5000;
  assert.throws(() => assertInventoryContainers(large), /4096/);
  const emptyShape = seed(); emptyShape[0].items[0].cells = [];
  assert.throws(() => assertInventoryContainers(emptyShape), /invalid shape/);
  const emptyId = seed(); emptyId[0].items[0].id = ' ';
  assert.throws(() => assertInventoryContainers(emptyId), /must not be empty/);
  const emptyContainerId = seed(); emptyContainerId[1].id = '';
  assert.throws(() => assertInventoryContainers(emptyContainerId), /must not be empty/);
});
test('server renders real accessible items, exact cells and clamped 44px touch targets', () => {
  const html = renderToStaticMarkup(createElement(InventoryGrid, { containers: seed(), onChange() {}, cellSize: 12 }));
  assert.match(html, /data-inventory-item="l"/);
  assert.match(html, /data-inventory-container="a"/);
  assert.match(html, /role="button"/);
  assert.match(html, /width:44px;height:44px/);
  assert.match(html, /aria-live="polite"/);
  const disabled = renderToStaticMarkup(createElement(InventoryGrid, { containers: seed(), onChange() {}, readOnly: true }));
  assert.match(disabled, /data-readonly="true"/);
  assert.match(disabled, /aria-disabled="true"/);
});
test('inventory accessibility copy exists in all provider locales and accepts dictionary overrides', () => {
  for (const locale of ['en', 'zh-CN', 'ja', 'ko', 'fr']) {
    const t = createInkraTranslator(locale);
    assert.notEqual(t('inventoryGrid.instructions'), 'inventoryGrid.instructions');
    assert(t('inventoryGrid.position', { item: 'A', container: 'B', column: 1, row: 2, rotation: 90 }).includes('90'));
  }
  assert.equal(createInkraTranslator('en', { 'inventoryGrid.rotate': 'Turn' })('inventoryGrid.rotate'), 'Turn');
});
