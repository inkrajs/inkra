import assert from 'node:assert/strict';
import test from 'node:test';
import { inventoryOutline } from '../dist/inventory-grid/outline.js';
import { rotateInventoryCells } from '../dist/inventory-grid/model.js';

const lShape = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }];
const area = segments => segments.reduce((sum, { start, end }) => sum + start.x * end.y - end.x * start.y, 0) / 2;

test('L-shaped items have one six-sided contour, not three separate cell frames', () => {
  const outline = inventoryOutline(lShape, 48);
  assert.equal(outline.path, 'M3,3L45,3L45,51L93,51L93,93L3,93Z');
  assert.equal(outline.segments.length, 6);
  assert.equal((outline.path.match(/M/g) ?? []).length, 1);
});

test('straight adjacent cells share one continuous rectangle', () => {
  const outline = inventoryOutline([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], 48);
  assert.equal(outline.path, 'M3,3L141,3L141,45L3,45Z');
  assert.equal(outline.segments.length, 4);
});

test('all rotations preserve occupied area and remove internal edges', () => {
  for (const rotation of [0, 90, 180, 270]) {
    const outline = inventoryOutline(rotateInventoryCells(lShape, rotation), 48, 0);
    assert.equal(outline.segments.length, 6);
    assert.equal(area(outline.segments), 3 * 48 * 48);
  }
});

test('closed holes keep opposite winding instead of being filled', () => {
  const cells = Array.from({ length: 9 }, (_, index) => ({ x: index % 3, y: Math.floor(index / 3) }))
    .filter(({ x, y }) => x !== 1 || y !== 1);
  const outline = inventoryOutline(cells, 48, 0);
  assert.equal((outline.path.match(/M/g) ?? []).length, 2);
  assert.equal(outline.segments.length, 8);
  assert.equal(area(outline.segments), 8 * 48 * 48);
});

test('diagonal and disconnected cells are not visually bridged', () => {
  for (const cells of [
    [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    [{ x: 0, y: 0 }, { x: 2, y: 0 }],
  ]) {
    const outline = inventoryOutline(cells, 48);
    assert.equal((outline.path.match(/M/g) ?? []).length, 2);
    assert.equal(outline.segments.length, 8);
    assert.equal(area(outline.segments), 2 * 42 * 42);
  }
});
