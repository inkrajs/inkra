import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Toast, createToastManager } from '../dist/index.js';
import { getToastRouter, toastPlacements } from '../dist/toast/manager.js';

function setup() {
  const manager = createToastManager();
  const router = getToastRouter(manager);
  const events = [];
  for (const position of toastPlacements) {
    router.queues[position][' subscribe'](event => events.push({ position, ...event }));
  }
  return { manager, router, events };
}

test('nine independent native queues route per-toast placements without changing custom data', () => {
  const { manager, router, events } = setup();
  assert.equal(new Set(Object.values(router.queues)).size, 9);
  const data = { placement: 'consumer-owned', message: 1 };
  for (const placement of toastPlacements) manager.add({ title: placement, placement, data, timeout: 2500 });
  assert.deepEqual(events.map(event => event.position), toastPlacements);
  for (const event of events) {
    assert.equal(event.options.data, data);
    assert.equal(event.options.timeout, 2500);
    assert.equal(event.options.placement, event.position);
  }
});

test('provider defaults only affect new IDs and upserts stay in their initial queues', () => {
  const { manager, router, events } = setup();
  manager.add({ id: 'stable', title: 'First' });
  router.defaults = { placement: 'top-center', variant: 'compact' };
  manager.add({ title: 'Second' });
  manager.add({ id: 'stable', title: 'Updated', placement: 'center' });
  assert.deepEqual(events.map(event => event.position), ['bottom-end', 'top-center', 'bottom-end']);
  assert.equal(events[1].options.variant, 'compact');
});

test('closeAll can clear one position; update and close retain native manager semantics', () => {
  const { manager, events } = setup();
  manager.closeAll('top-center');
  assert.deepEqual(events.map(event => [event.position, event.action]), [['top-center', 'close']]);
  events.length = 0;
  manager.update('id', previous => ({ title: previous.title }));
  assert.equal(events.length, 9);
  assert(events.every(event => event.action === 'update' && typeof event.options.updates === 'function'));
  events.length = 0;
  manager.close();
  assert.equal(events.length, 9);
  assert(events.every(event => event.action === 'close'));
});

test('promise states share their selected queue and carry the chosen appearance', async () => {
  const { manager, events } = setup();
  const promise = Promise.resolve(42);
  assert.equal(await manager.promise(promise, { placement: 'center-start', variant: 'card', loading: 'Loading', success: 'Done', error: 'Failed' }), 42);
  assert.equal(events.length, 1);
  assert.equal(events[0].position, 'center-start');
  assert.equal(events[0].options.loading.variant, 'card');
});

test('queue snapshots notify consumers, release removed IDs, and remain isolated', () => {
  const { router } = setup();
  let updates = 0;
  const unsubscribe = router.subscribe(() => updates++);
  const toasts = [{ id: 'one', title: 'One' }];
  router.report('top-center', toasts);
  router.report('top-center', toasts);
  router.report('bottom-start', [{ id: 'two', title: 'Two' }]);
  assert.equal(updates, 2);
  assert.equal(router.getSnapshot().length, 2);
  router.report('top-center', []);
  assert.equal(router.owners.has('one'), false);
  assert.equal(router.getSnapshot()[0].id, 'two');
  unsubscribe();
});

test('provider retains readable server content without empty portal viewports', () => {
  assert.equal(renderToStaticMarkup(createElement(Toast.Provider, { placement: 'center', variant: 'compact', limits: { center: 1 } }, 'Ready')).includes('Ready'), true);
});
