import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tabs } from '../dist/index.js';

function render(props = {}) {
  return renderToStaticMarkup(h(Tabs.Root, { defaultValue: 'one', ...props },
    h(Tabs.List, { 'aria-label': 'Pages' },
      h(Tabs.Trigger, { value: 'one' }, 'One'),
      h(Tabs.Trigger, { value: 'two', disabled: true }, 'Two')),
    h(Tabs.Content, { value: 'one' }, 'First'),
    h(Tabs.Content, { value: 'two', forceMount: true }, h('input', { defaultValue: 'Keep' })),
  ));
}

test('Tabs exports compound components with linked tab and panel semantics', () => {
  const html = render();
  assert.match(html, /role="tablist"/);
  assert.match(html, /aria-label="Pages"/);
  assert.match(html, /role="tab" aria-selected="true"/);
  assert.match(html, /role="tabpanel"/);
  assert.match(html, /aria-controls="([^"]+)-content-one"/);
  assert.match(html, /aria-labelledby="([^"]+)-trigger-one"/);
  assert.match(html, /inkra-tabs__selection/);
  assert.equal((html.match(/inkra-tabs__focus-ring/g) ?? []).length, 2);
  assert.match(html, /inkra-pencil-text__source">One/);
});

test('Tabs preserves forced panel content but hides inactive panels', () => {
  const html = render();
  assert.match(html, /data-state="inactive"[^>]*role="tabpanel"[^>]*hidden=""/);
  assert.match(html, /value="Keep"/);
  assert.match(html, /disabled=""[^>]*inkra-tabs__trigger/);
});

test('Tabs controlled value overrides default and forwards direction and orientation', () => {
  const html = render({ value: 'two', orientation: 'vertical', dir: 'rtl', activationMode: 'manual' });
  assert.match(html, /dir="rtl" data-orientation="vertical"/);
  assert.match(html, /aria-orientation="vertical"/);
  assert.match(html, /data-state="active"[^>]*role="tabpanel"[^>]*content-two/);
});

test('Tabs.List divided adds decorative pencil separators in the matching orientation', () => {
  assert.doesNotMatch(render(), /inkra-tabs__divider/);
  for (const orientation of ['horizontal', 'vertical']) {
    const html = renderToStaticMarkup(h(Tabs.Root, { defaultValue: 'one', orientation, dir: 'rtl' },
      h(Tabs.List, { divided: true, 'aria-label': 'Divided tabs' },
        h(Tabs.Trigger, { value: 'one' }, 'One'), h(Tabs.Trigger, { value: 'two' }, 'Two'))));
    assert.match(html, /data-divided="true"/);
    assert.match(html, new RegExp(`aria-hidden="true" class="inkra-pencil-line inkra-tabs__divider" data-orientation="${orientation === 'horizontal' ? 'vertical' : 'horizontal'}"`));
    assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
    assert.doesNotMatch(html, / divided=/);
  }
});

test('Tabs exposes size, alignment, full-width and decorative icon slots without leaking props', () => {
  const html = renderToStaticMarkup(h(Tabs.Root, { defaultValue: 'one', size: 'lg', animated: false },
    h(Tabs.List, { align: 'end', fullWidth: true, loop: false, 'aria-label': 'Pages' },
      h(Tabs.Trigger, { value: 'one', startIcon: h('i', null, 'start'), endIcon: h('i', null, 'end') }, 'One')),
  ));
  assert.match(html, /data-size="lg"/);
  assert.match(html, /data-align="end"/);
  assert.match(html, /data-full-width="true"/);
  assert.equal((html.match(/class="inkra-tabs__icon" aria-hidden="true"/g) ?? []).length, 2);
  assert.doesNotMatch(html, / animated=| fullWidth=| startIcon=| endIcon=/);
});

test('Tabs overflow modes preserve tab semantics and default to native scrolling before measurement', () => {
  for (const overflow of ['scroll', 'menu', 'buttons']) {
    const html = renderToStaticMarkup(h(Tabs.Root, { defaultValue: 'one' },
      h(Tabs.List, { overflow, moreLabel: 'More pages', scrollPreviousLabel: 'Previous pages', scrollNextLabel: 'Next pages', 'aria-label': 'Pages' },
        h(Tabs.Trigger, { value: 'one', overflowLabel: 'First page' }, h('strong', null, 'One')),
        h(Tabs.Trigger, { value: 'two' }, 'Two')),
      h(Tabs.Content, { value: 'one' }, 'First')));
    assert.match(html, new RegExp(`data-overflow="${overflow}"`));
    assert.equal((html.match(/role="tablist"/g) ?? []).length, 1);
    assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
    assert.match(html, /data-overflow-label="First page"/);
    assert.doesNotMatch(html, / overflow=| moreLabel=| scrollPreviousLabel=| scrollNextLabel=| overflowLabel=/);
    assert.doesNotMatch(html, /data-overflow-hidden|aria-haspopup="menu"/);
  }
  const vertical = renderToStaticMarkup(h(Tabs.Root, { orientation: 'vertical' }, h(Tabs.List, { overflow: 'menu' }, h(Tabs.Trigger, { value: 'one' }, 'One'))));
  assert.match(vertical, /data-overflow="scroll"/);
  assert.doesNotMatch(vertical, /inkra-tabs__overflow/);
});
