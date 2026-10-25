import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement as h, useEffect } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { act, create } from 'react-test-renderer';
import { InkraProvider, useInkraLocale, createInkraTranslator, resolveInkraLocale, inkraLocales } from '../dist/i18n/index.js';
import { messageRows } from '../dist/i18n/catalog.js';
import { Input } from '../dist/form/Input.js';
import { InputNumber } from '../dist/input-number/index.js';
import { Pagination } from '../dist/pagination/index.js';
import { DatePicker } from '../dist/date-picker/index.js';
import { TimePicker } from '../dist/time-picker/index.js';
import { NumberTicker } from '../dist/number-ticker/index.js';
import { Calendar } from '../dist/calendar/index.js';
import { Markdown } from '../dist/markdown/index.js';
import { RangeSlider } from '../dist/range-slider/index.js';
import { Sparkline } from '../dist/sparkline/index.js';

let priorAct;
before(() => { priorAct = globalThis.IS_REACT_ACT_ENVIRONMENT; globalThis.IS_REACT_ACT_ENVIRONMENT = true; });
after(() => {
  if (priorAct === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  else globalThis.IS_REACT_ACT_ENVIRONMENT = priorAct;
});
const escape = value => render(h('span', null, value)).slice(6, -7);
const provider = (locale, child, messages) => h(InkraProvider, { locale, messages }, child);
function Probe({ localLocale, fallbackLocale }) {
  const { locale, t } = useInkraLocale(localLocale, fallbackLocale);
  return h('output', { lang: locale }, t('common.save'), '|', t('common.cancel'), '|', t('input.clear'));
}

test('all five dictionaries have unique, complete, nonempty entries with matching placeholders', () => {
  assert.deepEqual(Object.keys(inkraLocales), ['en', 'zh-CN', 'ja', 'ko', 'fr']);
  const keys = messageRows.map(row => row[0]);
  assert.equal(new Set(keys).size, keys.length);
  const placeholders = value => [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map(match => match[1]).sort();
  for (const [locale, messages] of Object.entries(inkraLocales)) {
    assert.deepEqual(Object.keys(messages), keys);
    assert.ok(Object.isFrozen(messages));
    for (const [key, value] of Object.entries(messages)) {
      assert.ok(value.trim(), locale + ':' + key);
      assert.deepEqual(placeholders(value), placeholders(inkraLocales.en[key]), locale + ':' + key);
    }
  }
});

test('regional language aliases and unsupported languages resolve deterministically', () => {
  for (const [locale, expected] of [['zh-Hans-CN', 'zh-CN'], ['ZH_cn', 'zh-CN'], ['ja-JP', 'ja'], ['ko-KR', 'ko'], ['fr-CA', 'fr'], ['en-GB', 'en'], ['de-DE', 'en'], ['ja-!', 'en'], ['', 'en']]) {
    assert.equal(resolveInkraLocale(locale), expected);
    assert.equal(createInkraTranslator(locale)('common.cancel'), inkraLocales[expected]['common.cancel']);
  }
  assert.equal(render(provider('invalid_locale_!', h(Probe))), '<output lang="en-US">Save|Cancel|Clear input</output>');
  assert.match(render(provider('de-DE', h(Probe))), /lang="de-DE">Save\|Cancel/);
});

test('partial dictionaries preserve empty overrides, ignore undefined and safely interpolate literal values', () => {
  const t = createInkraTranslator('ja', {
    'common.save': '',
    'common.cancel': undefined,
    'pagination.page': '{page} / {page} / {missing}',
    'tagInput.remove': 'Remove {label}',
  });
  assert.equal(t('common.save'), '');
  assert.equal(t('common.cancel'), inkraLocales.ja['common.cancel']);
  assert.equal(t('pagination.page', { page: 9007199254740993123n }), '9007199254740993123 / 9007199254740993123 / {missing}');
  assert.equal(t('tagInput.remove', { label: '$& {page} <script>alert(1)</script>' }), 'Remove $& {page} <script>alert(1)</script>');
  assert.equal(t('missing.key'), 'missing.key');
  assert.equal(t('toString'), 'toString');
});

test('nested providers inherit and override individual keys without adding DOM', () => {
  const html = render(provider('fr-CA',
    h(InkraProvider, { messages: { 'common.save': 'Inner', 'input.clear': undefined } }, h(Probe)),
    { 'common.save': 'Outer', 'input.clear': 'Custom clear' }));
  assert.equal(html, '<output lang="fr-CA">Inner|Annuler|Custom clear</output>');
  assert.equal(render(provider('ja', h(InkraProvider, { locale: 'ko' }, h(Probe)), { 'common.save': 'Brand save' })),
    '<output lang="ko">Brand save|취소|입력 지우기</output>');
});

test('local locale wins over provider and fallback only applies without an explicit locale', () => {
  assert.match(render(provider('fr', h(Probe, { localLocale: 'ja-JP', fallbackLocale: 'ko' }))), /lang="ja-JP">保存\|キャンセル/);
  assert.match(render(h(Probe, { fallbackLocale: 'en-GB' })), /lang="en-GB"/);
  assert.match(render(provider('en-US', h(Probe, { fallbackLocale: 'en-GB' }))), /lang="en-US"/);
  assert.match(render(h(InkraProvider, { messages: { 'common.save': 'Save custom' } }, h(Probe, { fallbackLocale: 'en-GB' }))), /lang="en-GB">Save custom/);
});

for (const locale of Object.keys(inkraLocales)) {
  test(locale + ': actual controls use defaults, preserve explicit labels and leave business data unchanged', () => {
    const messages = inkraLocales[locale];
    const html = render(provider(locale, h('section', null,
      h(Input, { clearable: true, defaultValue: 'User content 日本語', name: 'note' }),
      h(InputNumber, { defaultValue: 2 }),
      h(RangeSlider),
      h(Sparkline, { data: [] }),
      h(Pagination, { totalPages: 3 }),
      h(DatePicker, { defaultValue: new Date(2026, 9, 25), name: 'date' }),
      h(TimePicker, { defaultValue: '09:30', name: 'time' }),
      h(Markdown, null, '~~~tsx\nconst value = 1;\n~~~'),
      h(Input, { clearable: true, defaultValue: 'Local', clearButtonLabel: 'Explicit action' }),
    )));
    for (const key of ['input.clear', 'inputNumber.increase', 'inputNumber.decrease', 'rangeSlider.minimum', 'rangeSlider.maximum', 'common.nextPage', 'datePicker.clear', 'timePicker.clear', 'markdown.copy']) {
      assert.ok(html.includes('aria-label="' + escape(messages[key]) + '"'), locale + ':' + key);
    }
    assert.ok(html.includes('aria-label="' + escape(createInkraTranslator(locale)('pagination.page', { page: 2 })) + '"'));
    assert.match(html, /aria-label="Explicit action"/);
    assert.ok(html.includes(escape(messages['sparkline.empty'])));
    assert.match(html, /value="User content 日本語"/);
    assert.match(html, /value="2026-10-25"/);
    assert.match(html, /value="09:30"/);
    assert.ok(html.includes(escape(new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(2026, 9, 25)))));
  });
}

test('calendar labels and month names follow the provider; explicit labels still win', () => {
  for (const locale of Object.keys(inkraLocales)) {
    const html = render(provider(locale, h(Calendar, { appearance: 'picker', month: new Date(2026, 9, 1), labels: { labelNext: () => 'Next custom' } })));
    assert.ok(html.includes('aria-label="' + escape(inkraLocales[locale]['datePicker.previous']) + '"'));
    assert.match(html, /aria-label="Next custom"/);
  }
});

test('numeric formatting inherits locale without losing bigint precision or explicit overrides', () => {
  const value = 900719925474099312345n;
  for (const locale of Object.keys(inkraLocales)) {
    const html = render(provider(locale, h(NumberTicker, { value, animate: false })));
    assert.ok(html.includes(escape(new Intl.NumberFormat(locale).format(value))), locale);
    const explicit = render(provider(locale, h(NumberTicker, { value: String(value), locale: 'en-US', animate: false })));
    assert.ok(explicit.includes(escape(new Intl.NumberFormat('en-US').format(value))), locale + ': explicit');
  }
});

test('live language and dictionary changes retain component identity, draft state and selection', async () => {
  let mounts = 0;
  let unmounts = 0;
  function Controls() {
    useEffect(() => { mounts++; return () => { unmounts++; }; }, []);
    return h('section', null, h(Input, { clearable: true, defaultValue: '' }), h(Pagination, { totalPages: 3 }));
  }
  const view = (locale, messages) => provider(locale, h(Controls), messages);
  let renderer;
  try {
    await act(() => { renderer = create(view('en')); });
    const input = renderer.root.findByType('input');
    await act(() => input.props.onChange({ currentTarget: { value: 'draft' } }));
    await act(() => renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'Page 2').props.onClick());
    for (const locale of ['zh-CN', 'ja', 'ko', 'fr']) {
      await act(() => renderer.update(view(locale)));
      assert.equal(renderer.root.findByType('input'), input);
      const buttons = renderer.root.findAllByType('button');
      assert.equal(buttons.find(node => node.props['aria-label'] === inkraLocales[locale]['input.clear']).props.disabled, false, 'draft still makes clear available');
      assert.equal(buttons.find(node => node.props['aria-current'] === 'page').props['aria-label'], createInkraTranslator(locale)('pagination.page', { page: 2 }));
    }
    await act(() => renderer.update(view('fr', { 'input.clear': 'New dictionary' })));
    assert.ok(renderer.root.findAllByType('button').some(node => node.props['aria-label'] === 'New dictionary'));
    assert.equal(mounts, 1);
    assert.equal(unmounts, 0);
  } finally { if (renderer) await act(() => renderer.unmount()); }
  assert.equal(unmounts, 1);
});

test('component overrides outrank global dictionary and interpolated content is escaped by React', () => {
  const html = render(provider('fr', h('div', null,
    h(Input, { clearable: true, defaultValue: 'x', clearButtonLabel: 'Explicit' }),
    h(Pagination, { totalPages: 2 }),
  ), { 'input.clear': 'Global', 'pagination.page': '<img src=x> {page}' }));
  assert.match(html, /aria-label="Explicit"/);
  assert.doesNotMatch(html, /aria-label="Global"/);
  assert.match(html, /aria-label="&lt;img src=x&gt; 2"/);
  assert.doesNotMatch(html, /<img src=x>/);
});
