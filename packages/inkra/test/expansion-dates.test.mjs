import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { DatePicker, datePickerLocalValue } from '../dist/date-picker/index.js';
import { Field } from '../dist/form/Field.js';
import { TimePicker } from '../dist/time-picker/index.js';

const input = (html, name) => html.match(new RegExp(`<input\\b[^>]*name="${name}"[^>]*>`))?.[0] ?? '';

function assertNoNestedButtons(html) {
  let depth = 0;
  let maximum = 0;
  for (const token of html.matchAll(/<\/?button\b/g)) {
    if (token[0].startsWith('</')) depth -= 1;
    else {
      depth += 1;
      maximum = Math.max(maximum, depth);
    }
  }
  assert.equal(depth, 0);
  assert.equal(maximum, 1);
}

function assertSharedPickerControl(html, picker) {
  const controlClass = `inkra-${picker}__control`;
  const triggerClass = `inkra-${picker}__trigger`;
  const clearClass = `inkra-${picker}__clear`;
  const controlStart = html.indexOf(controlClass);
  const controlEnd = html.indexOf('</div>', controlStart);
  const trigger = html.indexOf(triggerClass, controlStart);
  const clear = html.indexOf(clearClass, controlStart);
  assert.ok(controlStart >= 0, `${picker} should render a shared control surface`);
  assert.ok(trigger > controlStart && trigger < controlEnd, `${picker} trigger should be inside the shared surface`);
  assert.ok(clear > trigger && clear < controlEnd, `${picker} clear action should follow the trigger inside the shared surface`);
  assertNoNestedButtons(html);
}

test('DatePicker submits a local calendar date without UTC conversion', () => {
  const localDate = new Date(2026, 9, 22, 0, 15);
  assert.equal(datePickerLocalValue(localDate), '2026-10-22');
  const html = renderToStaticMarkup(createElement(DatePicker, {
    name: 'departure',
    value: localDate,
    onValueChange() {},
    locale: 'en-US',
  }));
  assert.match(input(html, 'departure'), /type="text"/);
  assert.match(input(html, 'departure'), /value="2026-10-22"/);
  assert.match(html, /Oct 22, 2026/);
  assert.doesNotMatch(html, /2026-10-21/);
});

test('DatePicker range uses distinct start and end fields with explicit empty values', () => {
  const complete = renderToStaticMarkup(createElement(DatePicker, {
    mode: 'range',
    name: 'stayStart',
    endName: 'stayEnd',
    value: { from: new Date(2026, 9, 22), to: new Date(2026, 9, 25) },
    onValueChange() {},
  }));
  assert.match(input(complete, 'stayStart'), /value="2026-10-22"/);
  assert.match(input(complete, 'stayEnd'), /value="2026-10-25"/);
  const incomplete = renderToStaticMarkup(createElement(DatePicker, {
    mode: 'range',
    name: 'stay',
    defaultValue: { from: new Date(2026, 9, 22) },
  }));
  assert.match(input(incomplete, 'stay'), /value="2026-10-22"/);
  assert.match(input(incomplete, 'stayEnd'), /value=""/);
});

test('DatePicker exposes Field-compatible state and a stable clear control', () => {
  const html = renderToStaticMarkup(createElement(DatePicker, {
    id: 'arrival',
    value: new Date(2026, 9, 22),
    onValueChange() {},
    required: true,
    readOnly: true,
    clearButtonLabel: 'Clear arrival',
  }));
  assert.match(html, /id="arrival"/);
  assert.match(html, /aria-required="true"/);
  assert.match(html, /data-readonly="true"/);
  assert.match(html, /aria-label="Clear arrival"/);
  assert.match(html, /disabled=""/);
  assertSharedPickerControl(html, 'date-picker');
});

test('DatePicker keeps picker sizes on one shared pencil surface', () => {
  const html = renderToStaticMarkup(createElement(DatePicker, {
    defaultValue: new Date(2026, 9, 22),
    size: 'sm',
  }));
  assert.match(html, /inkra-date-picker[^>]*data-size="sm"/);
  assert.match(html, /data-size="sm"[^>]*class="[^"]*inkra-date-picker__control/);
  assert.match(html, /inkra-date-picker__trigger[^>]*data-size="sm"/);
  assert.match(html, /inkra-date-picker__clear[^>]*data-size="icon-sm"/);
  assertSharedPickerControl(html, 'date-picker');
});

test('DatePicker required fields use native constraint controls and keep visible value naming', () => {
  const html = renderToStaticMarkup(createElement(Field, { label: 'Arrival date', required: true },
    createElement(DatePicker, { name: 'arrival', placeholder: 'Choose arrival' })));
  assert.match(input(html, 'arrival'), /required=""/);
  assert.match(input(html, 'arrival'), /class="inkra-date-picker__form-field"/);
  assert.match(html, />Choose arrival</);
  assert.match(html, /aria-describedby="inkra-field-[^"]+-value"/);
  assert.match(html, /class="inkra-date-picker__accessible-value"/);
  assert.doesNotMatch(html, /aria-label="Open date picker"/);
});

test('TimePicker uses a pencil button while retaining native validation and optional seconds', () => {
  const html = renderToStaticMarkup(createElement(TimePicker, {
    name: 'meeting',
    defaultValue: '09:30:15',
    min: '08:00',
    max: '18:00',
    showSeconds: true,
    hourCycle: 'h12',
    locale: 'en-US',
  }));
  const time = input(html, 'meeting');
  assert.match(time, /type="time"/);
  assert.match(time, /value="09:30:15"/);
  assert.match(time, /min="08:00"/);
  assert.match(time, /max="18:00"/);
  assert.match(time, /step="1"/);
  assert.match(time, /lang="en-US"/);
  assert.match(time, /data-hour-cycle="h12"/);
  assert.match(time, /class="inkra-time-picker__native"/);
  assert.match(time, /aria-hidden="true"/);
  assert.match(html, /inkra-time-picker__trigger/);
  assert.match(html, /inkra-pencil-text__source">09:30:15/);
  assert.match(html, /AM/);
  assertSharedPickerControl(html, 'time-picker');
});

test('TimePicker keeps picker sizes on one shared pencil surface', () => {
  const html = renderToStaticMarkup(createElement(TimePicker, {
    defaultValue: '09:30',
    size: 'lg',
  }));
  assert.match(html, /inkra-time-picker[^>]*data-size="lg"/);
  assert.match(html, /data-size="lg"[^>]*class="[^"]*inkra-time-picker__control/);
  assert.match(html, /inkra-time-picker__trigger[^>]*data-size="lg"/);
  assert.match(html, /inkra-time-picker__clear[^>]*data-size="icon-lg"/);
  assertSharedPickerControl(html, 'time-picker');
});

test('TimePicker associates its Field label with the visible trigger and describes the chosen value', () => {
  const html = renderToStaticMarkup(createElement(Field, { label: 'Meeting', id: 'meeting' },
    createElement(TimePicker, { defaultValue: '21:30', hourCycle: 'h24', locale: 'en-GB' })));
  assert.match(html, /<label[^>]*for="meeting"/);
  assert.match(html, /<button[^>]*id="meeting"/);
  assert.match(html, /aria-describedby="meeting-value"/);
  assert.match(html, /id="meeting-native"/);
  assert.match(html, /inkra-pencil-text__source">21:30/);
  assert.doesNotMatch(html, /type="text"/);
});

test('TimePicker preserves explicit step and empty controlled values', () => {
  const html = renderToStaticMarkup(createElement(TimePicker, {
    name: 'reminder',
    value: '',
    onValueChange() {},
    showSeconds: true,
    step: 300,
  }));
  const time = input(html, 'reminder');
  assert.match(time, /value=""/);
  assert.match(time, /step="300"/);
  assert.match(time, /lang="en-GB"/);
});

test('disabled date and time fields retain native disabled form behavior', () => {
  const date = renderToStaticMarkup(createElement(DatePicker, {
    disabled: true,
    name: 'date',
    defaultValue: new Date(2026, 9, 22),
  }));
  const time = renderToStaticMarkup(createElement(TimePicker, {
    disabled: true,
    name: 'time',
    defaultValue: '09:30',
  }));
  assert.match(input(date, 'date'), /disabled=""/);
  assert.match(input(time, 'time'), /disabled=""/);
  assert.match(date, /<button[^>]*disabled=""/);
});

test('TimePicker inherits Field disabled and readOnly state for the native input and clear action', () => {
  for (const state of ['disabled', 'readOnly']) {
    const html = renderToStaticMarkup(createElement(Field, { label: 'Time', [state]: true },
      createElement(TimePicker, { defaultValue: '09:30', clearButtonLabel: 'Clear inherited time' })));
    const time = html.match(/<input\b[^>]*type="time"[^>]*>/)?.[0] ?? '';
    assert.match(time, state === 'disabled' ? /disabled=""/ : /readOnly=""/);
    assert.match(html, /aria-label="Clear inherited time"/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /disabled=""/);
  }
});
