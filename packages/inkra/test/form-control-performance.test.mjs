import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement as h, memo, StrictMode } from 'react';
import { act, create } from 'react-test-renderer';
import { Button, ButtonGroup } from '../dist/Button.js';
import { Field } from '../dist/form/Field.js';
import { useFieldContext } from '../dist/form/context.js';
import { InputNumber } from '../dist/input-number/index.js';
import { RadioGroup, RadioGroupItem } from '../dist/selection/RadioGroup.js';
import { Calendar } from '../dist/calendar/index.js';
import { DatePicker } from '../dist/date-picker/index.js';
import { TimePicker } from '../dist/time-picker/index.js';
import { Popover } from '../dist/overlay/Popover.js';
import { Upload } from '../dist/upload/index.js';

let previousActEnvironment;
before(() => {
  previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});
after(() => {
  if (previousActEnvironment === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  else globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

function installGlobals(values) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  return () => {
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  };
}

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    dispatch(type, event = {}) { for (const listener of [...(listeners.get(type) ?? [])]) listener(event); },
    count(type) { return type ? (listeners.get(type)?.size ?? 0) : [...listeners.values()].reduce((sum, value) => sum + value.size, 0); },
  };
}

test('Field metadata changes do not broadcast unchanged control state', async () => {
  let renders = 0;
  let observed;
  const Probe = memo(function Probe() { renders++; observed = useFieldContext(); return null; });
  const child = h(Probe);
  let renderer;
  try {
    await act(() => { renderer = create(h(Field, { label: 'Name', description: 'First description' }, child)); });
    const initial = observed;
    await act(() => renderer.update(h(Field, { label: 'Full name', description: 'Changed description', className: 'updated' }, child)));
    assert.equal(renders, 1);
    assert.equal(observed, initial);
    await act(() => renderer.update(h(Field, { label: 'Name', disabled: true, required: true, error: 'Required' }, child)));
    assert.equal(renders, 2);
    assert.equal(observed.disabled, true);
    assert.equal(observed.required, true);
    assert.equal(observed.invalid, true);
    assert.equal(observed.descriptionId, undefined);
    assert.ok(observed.errorId);
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

test('ButtonGroup preserves context on unrelated updates and broadcasts semantic changes', async () => {
  let commits = 0;
  const originalRender = Button.render;
  Button.render = (...args) => { commits++; return originalRender(...args); };
  const child = h(Button, null, 'Save');
  let renderer;
  try {
    await act(() => { renderer = create(h(ButtonGroup, { size: 'sm' }, child)); });
    const initial = commits;
    await act(() => renderer.update(h(ButtonGroup, { size: 'sm', className: 'updated' }, child)));
    assert.equal(commits, initial);
    await act(() => renderer.update(h(ButtonGroup, { size: 'lg', disabled: true, orientation: 'vertical' }, child)));
    assert.ok(commits > initial);
    const button = renderer.root.findByType('button');
    assert.equal(button.props['data-size'], 'lg');
    assert.equal(button.props.disabled, true);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    Button.render = originalRender;
  }
});

test('RadioGroup avoids unrelated context updates but keeps new callbacks and values current', async () => {
  let commits = 0;
  const calls = [];
  const first = value => calls.push(`first:${value}`);
  const second = value => calls.push(`second:${value}`);
  const originalRender = RadioGroupItem.render;
  RadioGroupItem.render = (...args) => { commits++; return originalRender(...args); };
  const child = [h(RadioGroupItem, { key: 'a', value: 'a', label: 'A' }), h(RadioGroupItem, { key: 'b', value: 'b', label: 'B' })];
  let renderer;
  const render = props => h(RadioGroup, { name: 'letters', value: 'a', onValueChange: first, ...props }, child);
  try {
    await act(() => { renderer = create(render({})); });
    const initial = commits;
    await act(() => renderer.update(render({ className: 'updated' })));
    assert.equal(commits, initial);
    await act(() => renderer.update(render({ value: 'b', onValueChange: second, disabled: true, form: 'owner' })));
    const inputs = renderer.root.findAllByType('input');
    assert.equal(inputs[0].props.checked, false);
    assert.equal(inputs[1].props.checked, true);
    assert.equal(inputs[0].props.disabled, true);
    assert.equal(inputs[0].props.form, 'owner');
    await act(() => inputs[0].props.onChange({ currentTarget: { checked: true, value: 'a' } }));
    assert.deepEqual(calls, ['second:a']);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    RadioGroupItem.render = originalRender;
  }
});

test('Calendar indexes event dates once rather than rescanning for each visible day', async () => {
  let dateReads = 0;
  const events = Array.from({ length: 2000 }, (_, index) => {
    const date = new Date(2025, 0, index % 28 + 1);
    const year = date.getFullYear.bind(date);
    date.getFullYear = () => { dateReads++; return year(); };
    return { id: String(index), date, label: `Event ${index}` };
  });
  const props = { events, defaultMonth: new Date(2026, 9, 1), numberOfMonths: 2, mode: 'single', appearance: 'picker' };
  let renderer;
  try {
    await act(() => { renderer = create(h(Calendar, props)); });
    assert.equal(dateReads, 2000);
    await act(() => renderer.update(h(Calendar, { ...props, className: 'updated' })));
    assert.equal(dateReads, 2000);
    await act(() => renderer.update(h(Calendar, { ...props, events: [...events] })));
    assert.equal(dateReads, 4000);
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

test('Calendar event indexing preserves local date grouping, input order and event identity', async () => {
  const first = { id: 'one', date: new Date(2026, 9, 22, 0, 15), label: 'First', description: 'Early' };
  const second = { id: 'two', date: new Date(2026, 9, 22, 23, 45), label: 'Second' };
  const selected = [];
  let renderer;
  try {
    await act(() => { renderer = create(h(Calendar, {
      defaultMonth: new Date(2026, 9, 1), mode: 'single', events: [first, second],
      onEventSelect: event => selected.push(event),
    })); });
    const cards = renderer.root.findAll(node => node.type === 'button' && node.props.className?.includes('inkra-calendar__event-card'));
    assert.deepEqual(cards.map(node => node.props['aria-label']), ['First, Early', 'Second']);
    let stopped = false;
    await act(() => cards[1].props.onClick({ stopPropagation() { stopped = true; } }));
    assert.equal(selected[0], second);
    assert.equal(stopped, true);
    const day = renderer.root.findAllByType('button').find(node => node.props['aria-label']?.endsWith('First, Second'));
    assert.ok(day, 'date accessible name retains both events');
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

test('DatePicker reuses its localized day number formatter across cells and rerenders', async () => {
  const Original = Intl.NumberFormat;
  let created = 0;
  Intl.NumberFormat = class extends Original { constructor(...args) { super(...args); created++; } };
  let renderer;
  const calendarProps = () => renderer.root.findByType(Popover.Portal).props.children.props.children[1].props;
  try {
    await act(() => { renderer = create(h(DatePicker, { locale: 'en-US' })); });
    for (let day = 1; day <= 42; day++) calendarProps().formatters.formatDay(new Date(2026, 9, day));
    assert.equal(created, 1);
    await act(() => renderer.update(h(DatePicker, { locale: 'en-US', className: 'updated' })));
    assert.equal(calendarProps().formatters.formatDay(new Date(2026, 9, 22)), '22');
    assert.equal(created, 1);
    await act(() => renderer.update(h(DatePicker, { locale: 'ar-EG' })));
    assert.equal(calendarProps().formatters.formatDay(new Date(2026, 9, 22)), new Original('ar-EG').format(22));
    assert.equal(created, 2);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    Intl.NumberFormat = Original;
  }
});

test('TimePicker reuses its formatter and invalidates locale, cycle and seconds changes', async () => {
  const restore = installGlobals({ document: { createElement: () => ({ validity: { valid: true } }) } });
  const Original = Intl.DateTimeFormat;
  let created = 0;
  Intl.DateTimeFormat = class extends Original { constructor(...args) { super(...args); created++; } };
  let renderer;
  try {
    await act(() => { renderer = create(h(TimePicker, { value: '09:30', locale: 'en-GB' })); });
    assert.equal(created, 1);
    for (let minute = 31; minute <= 40; minute++) {
      await act(() => renderer.update(h(TimePicker, { value: `09:${minute}`, locale: 'en-GB' })));
    }
    assert.equal(created, 1);
    await act(() => renderer.update(h(TimePicker, { value: '21:40:15', locale: 'en-US', hourCycle: 'h12', showSeconds: true })));
    assert.equal(created, 2);
    const text = JSON.stringify(renderer.toJSON());
    assert.match(text, /09:40:15/);
    assert.match(text, /PM/);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    Intl.DateTimeFormat = Original;
    restore();
  }
});

test('InputNumber listens globally only during a hold and cleans every exit path', async () => {
  const window = { ...eventTarget(), clearTimeout() {} };
  const document = { ...eventTarget(), hidden: false };
  const timers = new Map();
  let timerId = 0;
  const restore = installGlobals({ window, document,
    setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
  });
  const input = {
    value: '1', min: '', max: '', step: '1', readOnly: false, disabled: false,
    get valueAsNumber() { return Number(this.value); },
    matches: () => false, focus() {}, stepUp() { this.value = String(Number(this.value) + 1); },
    stepDown() { this.value = String(Number(this.value) - 1); },
  };
  const button = { isConnected: true, disabled: false, setPointerCapture() {}, hasPointerCapture: () => false };
  let renderer;
  const start = () => renderer.root.findAllByType(Button).find(node => node.props['aria-label'] === 'Increase value').props.onPointerDown({
    currentTarget: button, button: 0, isPrimary: true, pointerId: 7, preventDefault() {},
    shiftKey: false, altKey: false, ctrlKey: false, metaKey: false,
  });
  const count = () => window.count() + document.count('visibilitychange');
  try {
    await act(() => { renderer = create(h(StrictMode, null, h(InputNumber, { defaultValue: 1 })), {
      createNodeMock: element => element.type === 'input' ? input : null,
    }); });
    assert.equal(count(), 0);
    for (const ending of ['pointerup', 'pointercancel', 'blur', 'visibilitychange']) {
      await act(start);
      assert.equal(count(), 6);
      assert.equal(timers.size, 1);
      await act(() => window.dispatch('pointerup', { pointerId: 99 }));
      assert.equal(count(), 6, 'a different pointer does not end the active hold');
      await act(() => {
        if (ending === 'visibilitychange') { document.hidden = true; document.dispatch(ending); }
        else window.dispatch(ending, { pointerId: 7 });
      });
      assert.equal(count(), 0);
      assert.equal(timers.size, 0);
      document.hidden = false;
    }
    await act(start);
    await act(() => renderer.update(h(StrictMode, null, h(InputNumber, { defaultValue: 1, disabled: true }))));
    assert.equal(count(), 0);
    assert.equal(timers.size, 0);
    await act(() => renderer.update(h(StrictMode, null, h(InputNumber, { defaultValue: 1 }))));
    await act(start);
    assert.equal(count(), 6);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    assert.equal(count(), 0);
    assert.equal(timers.size, 0);
    restore();
  }
});

test('Upload progress rerenders only the changed row and preserves callbacks and cancellation', async () => {
  const reads = Array(100).fill(0);
  const files = reads.map((_, index) => ({
    id: String(index), status: 'selected',
    file: { get name() { reads[index]++; return `file-${index}.txt`; }, size: 100, type: 'text/plain' },
  }));
  const changes = [];
  let upload;
  const onUpload = (_file, context) => { upload = context; return new Promise(() => {}); };
  const onFilesChange = (items, details) => changes.push({ items, details });
  let renderer;
  try {
    await act(() => { renderer = create(h(Upload, { defaultFiles: files, autoUpload: false, onUpload, onFilesChange })); });
    assert.equal(reads[50], 1);
    await act(() => renderer.root.findAllByType(Button).find(node => node.props.children === 'Upload').props.onClick());
    for (const progress of [10, 20, 50, 90]) await act(() => upload.reportProgress(progress));
    assert.equal(reads[50], 1, 'unchanged rows must not repeat their render work');
    assert.equal(changes.at(-1).items[0].progress, 90);
    assert.equal(changes.at(-1).items[50], files[50], 'unchanged item identity remains intact');
    assert.deepEqual(changes.map(change => change.details.reason), ['upload-start', 'upload-progress', 'upload-progress', 'upload-progress', 'upload-progress']);
    await act(() => renderer.root.findAllByType(Button).find(node => node.props.children === 'Cancel').props.onClick());
    assert.equal(upload.signal.aborted, true);
    assert.equal(changes.at(-1).details.reason, 'cancel');
    const count = changes.length;
    await act(() => upload.reportProgress(100));
    assert.equal(changes.length, count, 'cancelled callbacks remain ignored');
    await act(() => renderer.update(h(Upload, { defaultFiles: files, autoUpload: false, onUpload, onFilesChange, labels: { remove: 'Delete file' }, disabled: true })));
    assert.ok(renderer.root.findAllByType(Button).filter(node => node.props.children === 'Delete file').every(node => node.props.disabled));
  } finally { if (renderer) await act(() => renderer.unmount()); }
});

test('TimePicker draft changes keep unchanged option columns out of the render path', async () => {
  const restore = installGlobals({ document: { createElement: () => ({ validity: { valid: true } }) } });
  const originalRender = RadioGroupItem.render;
  let renderedOptions = 0;
  RadioGroupItem.render = (...args) => { renderedOptions++; return originalRender(...args); };
  let renderer;
  let columns;
  // Render the actual column elements without a browser-only portal host.
  const columnElements = () => renderer.root.findByType(Popover.Portal).props.children.props.children[2];
  try {
    await act(() => { renderer = create(h(TimePicker, { showSeconds: true })); });
    await act(() => { columns = create(columnElements()); });
    assert.equal(renderedOptions, 144);
    const getGroup = label => columns.root.findAllByType(RadioGroup).find(group => group.props.label === label);
    renderedOptions = 0;
    await act(() => getGroup('Minute').props.onValueChange('30'));
    await act(() => columns.update(columnElements()));
    assert.equal(renderedOptions, 60, 'only the changed minute column rerenders');
    assert.equal(getGroup('Minute').props.value, '30');
    renderedOptions = 0;
    await act(() => getGroup('Second').props.onValueChange('15'));
    await act(() => columns.update(columnElements()));
    assert.equal(renderedOptions, 60);
    assert.equal(getGroup('Minute').props.value, '30', 'stable handlers retain the latest draft');
    assert.equal(getGroup('Second').props.value, '15');
    renderedOptions = 0;
    await act(() => renderer.update(h(TimePicker, { showSeconds: true, className: 'updated' })));
    await act(() => columns.update(columnElements()));
    assert.equal(renderedOptions, 0);
    await act(() => renderer.update(h(TimePicker, { showSeconds: true, hourCycle: 'h12' })));
    await act(() => columns.update(columnElements()));
    await act(() => getGroup('Period').props.onValueChange('1'));
    await act(() => columns.update(columnElements()));
    await act(() => getGroup('Hour').props.onValueChange('9'));
    await act(() => columns.update(columnElements()));
    assert.equal(getGroup('Hour').props.value, '9');
    assert.equal(getGroup('Period').props.value, '1', 'hour updates retain the selected PM period');
    const content = renderer.root.findByType(Popover.Portal).props.children;
    const apply = content.props.children.at(-1).props.children[1];
    await act(() => apply.props.onClick());
    const native = renderer.root.findAllByType('input').find(input => input.props.type === 'time');
    assert.equal(native.props.value, '21:30:15');
  } finally {
    if (columns) await act(() => columns.unmount());
    if (renderer) await act(() => renderer.unmount());
    RadioGroupItem.render = originalRender;
    restore();
  }
});


test('Upload observes same-object label overrides without rerendering rows for equivalent labels', async () => {
  let reads = 0;
  const files = [{ id: 'one', status: 'selected', file: { get name() { reads++; return 'one.txt'; }, size: 100 } }];
  const labels = { remove: 'Remove file' };
  let renderer;
  try {
    await act(() => { renderer = create(h(Upload, { files, labels })); });
    assert.equal(reads, 1);
    await act(() => renderer.update(h(Upload, { files, labels: { ...labels } })));
    assert.equal(reads, 1);
    labels.remove = 'Delete file';
    await act(() => renderer.update(h(Upload, { files, labels })));
    assert.equal(renderer.root.findAllByType(Button).find(node => node.props.children === 'Delete file').props.children, 'Delete file');
    assert.equal(reads, 2);
    delete labels.remove;
    await act(() => renderer.update(h(Upload, { files, labels })));
    assert.ok(renderer.root.findAllByType(Button).some(node => node.props.children === 'Remove'));
  } finally { if (renderer) await act(() => renderer.unmount()); }
});
