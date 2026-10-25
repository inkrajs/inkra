import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { act, create } from 'react-test-renderer';
import { Pagination } from '../dist/pagination/index.js';
import { Select } from '../dist/select/index.js';
import { InkraProvider, createInkraTranslator, inkraLocales } from '../dist/i18n/index.js';

let previousAct;
before(() => { previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT; globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
after(() => {
  if (previousAct === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  else globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
});
async function withRenderer(props, check) {
  let renderer;
  // Only the primitive's form-type check and cleanup timers need browser globals.
  // No DOM, layout, focus, keyboard or browser behavior is simulated here.
  const previousWindow = globalThis.window;
  const previousForm = globalThis.HTMLFormElement;
  globalThis.window = { setTimeout, clearTimeout };
  globalThis.HTMLFormElement = class {};
  try {
    await act(() => { renderer = create(h(Pagination, props)); });
    await check(renderer);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousForm === undefined) delete globalThis.HTMLFormElement;
    else globalThis.HTMLFormElement = previousForm;
  }
}
const sizeControl = renderer => renderer.root.findByType(Select.Root);
const currentPage = renderer => renderer.root.findAllByType('button').find(node => node.props['aria-current'] === 'page')?.props['aria-label'];
const changeSize = (renderer, value) => act(() => sizeControl(renderer).props.onValueChange(value));

test('uncontrolled page-size selection resets page and emits ordered callbacks only for valid changes', async () => {
  const events = [];
  await withRenderer({ totalPages: 8, defaultPage: 4, defaultPageSize: 20, pageSizeOptions: [50, 20, 50, 0, -1, 1.5, NaN, Infinity],
    onPageSizeChange: size => events.push(['size', size]), onPageChange: page => events.push(['page', page]),
  }, async renderer => {
    assert.equal(sizeControl(renderer).props.value, '20');
    assert.equal(currentPage(renderer), 'Page 4');
    for (const value of ['0', '-1', '1.5', 'NaN', 'Infinity', '99', '20']) await changeSize(renderer, value);
    assert.deepEqual(events, []);
    await changeSize(renderer, '50');
    assert.equal(sizeControl(renderer).props.value, '50');
    assert.equal(currentPage(renderer), 'Page 1');
    assert.deepEqual(events, [['size', 50], ['page', 1]]);
    await changeSize(renderer, '20');
    assert.deepEqual(events, [['size', 50], ['page', 1], ['size', 20]], 'page 1 does not emit a redundant reset');
  });
});

test('controlled parents retain page and size ownership, including rejected and repeated requests', async () => {
  const events = [];
  const props = { totalPages: 8, page: 4, pageSize: 20, pageSizeOptions: [10, 50],
    onPageSizeChange: size => events.push(['size', size]), onPageChange: page => events.push(['page', page]),
  };
  await withRenderer(props, async renderer => {
    for (let attempt = 0; attempt < 2; attempt++) {
      await changeSize(renderer, '50');
      assert.equal(sizeControl(renderer).props.value, '20');
      assert.equal(currentPage(renderer), 'Page 4');
    }
    assert.deepEqual(events, [['size', 50], ['page', 1], ['size', 50], ['page', 1]]);
    await act(() => renderer.update(h(Pagination, { ...props, page: 1, pageSize: 50 })));
    assert.equal(sizeControl(renderer).props.value, '50');
    assert.equal(currentPage(renderer), 'Page 1');
    await changeSize(renderer, '50');
    assert.equal(events.length, 4);
  });
});

test('page and page-size controlled modes remain independent', async () => {
  await withRenderer({ totalPages: 8, page: 4, defaultPageSize: 10, pageSizeOptions: [10, 20] }, async renderer => {
    await changeSize(renderer, '20');
    assert.equal(sizeControl(renderer).props.value, '20');
    assert.equal(currentPage(renderer), 'Page 4');
  });
  await withRenderer({ totalPages: 8, defaultPage: 4, pageSize: 10, pageSizeOptions: [10, 20] }, async renderer => {
    await changeSize(renderer, '20');
    assert.equal(sizeControl(renderer).props.value, '10');
    assert.equal(currentPage(renderer), 'Page 1');
  });
});

test('render, shrinking totals, options and default changes do not emit user callbacks', async () => {
  const events = [];
  const props = { totalPages: 8, defaultPage: 4, defaultPageSize: 20, pageSizeOptions: [20, 50],
    onPageSizeChange: value => events.push(value), onPageChange: value => events.push(value),
  };
  await withRenderer(props, async renderer => {
    await act(() => renderer.update(h(Pagination, { ...props, totalPages: 2, defaultPageSize: 50, pageSizeOptions: [10] })));
    assert.equal(currentPage(renderer), 'Page 2');
    assert.equal(sizeControl(renderer).props.value, '20');
    assert.deepEqual(events, []);
    await changeSize(renderer, '20');
    await changeSize(renderer, '50');
    assert.deepEqual(events, [], 'current size is retained and removed options cannot be requested');
    await act(() => renderer.update(h(Pagination, { ...props, disabled: true })));
    assert.equal(sizeControl(renderer).props.disabled, true);
    await changeSize(renderer, '50');
    assert.deepEqual(events, []);
  });
});

test('single and empty results retain the selector without fabricating pages', async () => {
  for (const totalPages of [0, 1]) {
    const html = render(h(Pagination, { totalPages, hideOnSinglePage: true, pageSizeOptions: [10, 20], variant: 'outline', align: 'end', wrap: true }));
    assert.match(html, /role="combobox"/);
    assert.match(html, /aria-label="Items per page"/);
    assert.match(html, /data-align="end"/);
    assert.match(html, /data-wrap="true"/);
    assert.doesNotMatch(html, /inkra-pagination__list|aria-current/);
    assert.equal(render(h(Pagination, { totalPages, hideOnSinglePage: true, pageSizeOptions: [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1] })), '');
  }
  const events = [];
  await withRenderer({ totalPages: 0, pageSizeOptions: [10, 20], onPageChange: page => events.push(page) }, async renderer => {
    await changeSize(renderer, '20');
    assert.equal(currentPage(renderer), undefined);
    assert.deepEqual(events, []);
  });
});

test('size selector handles invalid defaults and safe-integer capacity without forwarding API props to DOM', async () => {
  await withRenderer({ totalPages: 2, defaultPageSize: -1, pageSizeOptions: [20, 20, Number.MAX_SAFE_INTEGER] }, async renderer => {
    assert.equal(sizeControl(renderer).props.value, '10');
    await changeSize(renderer, String(Number.MAX_SAFE_INTEGER));
    assert.equal(sizeControl(renderer).props.value, String(Number.MAX_SAFE_INTEGER));
  });
  const html = render(h(Pagination, { totalPages: 3, pageSize: 20, defaultPageSize: 10, pageSizeOptions: [20], variant: 'outline', align: 'center', wrap: true, simple: true }));
  assert.match(html, /data-simple="true"/);
  assert.match(html, /1 \/ 3/);
  assert.equal((html.match(/data-variant="outline"/g) ?? []).length, 2);
  assert.doesNotMatch(html, / pageSize=| defaultPageSize=| pageSizeOptions=| variant=| align=| wrap=/);
});

test('page-size labels follow all five dictionaries and explicit labels override them', () => {
  for (const locale of Object.keys(inkraLocales)) {
    const t = createInkraTranslator(locale);
    const html = render(h(InkraProvider, { locale }, h(Pagination, { totalPages: 3, pageSizeOptions: [10, 20] })));
    assert(html.includes(`aria-label="${t('pagination.pageSize')}"`), locale);
    assert(html.includes(t('pagination.pageSizeOption', { pageSize: 10 })), locale);
    const custom = render(h(InkraProvider, { locale }, h(Pagination, { totalPages: 1, hideOnSinglePage: true, pageSizeOptions: [10], labels: { pageSize: 'Capacity', pageSizeOption: size => `${size} rows` } })));
    assert.match(custom, /aria-label="Capacity"/);
    assert.match(custom, /10 rows/);
  }
});
