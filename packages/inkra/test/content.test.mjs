import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { Alert, Avatar, Card, DropdownMenu, Table } from '../dist/index.js';

test('Card composition preserves headings, content and native attributes', () => {
  const html = render(h(Card.Root, { variant: 'quiet', radius: 0, 'data-test': 'card' },
    h(Card.Header, null, h(Card.Title, null, 'Notes'), h(Card.Description, null, 'Today')),
    h(Card.Content, null, h('input', { name: 'note' })), h(Card.Footer, null, h('button', null, 'Save'))));
  assert.match(html, /inkra-pencil-surface--quiet/);
  assert.match(html, /<h3[^>]*>/);
  assert.match(html, /data-test="card"/);
  assert.match(html, /name="note"/);
  assert.match(html, /inkra-card__divider/);
  assert.doesNotMatch(html, /radius=/);
  assert.match(render(h(Card.Title, { as: 'h2' }, 'Section')), /<h2[^>]*>/);
});

test('Alert defaults polite, supports urgent feedback and semantic tones', () => {
  for (const variant of ['info', 'success', 'warning', 'danger']) {
    const html = render(h(Alert.Root, { variant, icon: h('i', null, '!') }, h(Alert.Title, null, 'Title'), h(Alert.Description, null, 'Details')));
    assert.match(html, /role="status"/);
    assert.match(html, new RegExp(`--inkra-accent:var\\(--inkra-${variant}-pigment\\)`));
    assert.match(html, /class="inkra-alert__icon" aria-hidden="true"/);
    assert.match(html, /inkra-pencil-text__source/);
  }
  assert.match(render(h(Alert.Root, { role: 'alert' }, 'Urgent')), /role="alert"/);
});

test('Avatar preserves a sized fallback before image loading', () => {
  const html = render(h(Avatar.Root, { size: 'lg' }, h(Avatar.Image, { src: '/person.png', alt: 'Alex' }), h(Avatar.Fallback, { role: 'img', 'aria-label': 'Alex' }, 'AL')));
  assert.match(html, /data-size="lg"/);
  assert.match(html, /role="img" aria-label="Alex"/);
  assert.match(html, /inkra-avatar__outline/);
  assert.doesNotMatch(html, /<img/);
});

test('Table retains table structure, caption and scope without fake grid semantics', () => {
  const html = render(h(Table.Container, { 'aria-label': 'Notes' }, h(Table.Root, { density: 'compact' },
    h(Table.Caption, null, 'Notes'), h(Table.Header, null, h(Table.Row, null, h(Table.Head, null, 'Name'))),
    h(Table.Body, null, h(Table.Row, { selected: true }, h(Table.Cell, { colSpan: 2 }, 'Draft'))))));
  assert.match(html, /<table[^>]*data-density="compact"/);
  assert.match(html, /<caption/);
  assert.match(html, /<th scope="col"/);
  assert.match(html, /<tr data-selected="true"/);
  assert.match(html, /colSpan="2"/i);
  assert.doesNotMatch(html, /role="grid"|aria-selected/);
});

test('DropdownMenu exposes trigger state and full menu composition', () => {
  for (const key of ['Root', 'Trigger', 'Portal', 'Content', 'Item', 'CheckboxItem', 'RadioItem', 'Group', 'RadioGroup', 'Label', 'Separator']) assert(DropdownMenu[key]);
  const html = render(h(DropdownMenu.Root, null, h(DropdownMenu.Trigger, { disabled: true }, 'Actions')));
  assert.match(html, /aria-haspopup="menu"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /disabled=""/);
});

test('Card size, divider overrides and action slots preserve native semantics', () => {
  const html = render(h(Card.Root, { size: 'lg', divided: false, dir: 'rtl' },
    h(Card.Header, { action: h('button', { type: 'button' }, 'Edit') }, h(Card.Title, null, 'Title')),
    h(Card.Content, { padding: 'none' }, 'Body'),
    h(Card.Footer, { divided: true, justify: 'end' }, 'Footer')));
  assert.match(html, /data-size="lg"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /inkra-card__action/);
  assert.match(html, /data-padding="none"/);
  assert.match(html, /data-justify="end"/);
  assert.equal((html.match(/class="inkra-pencil-line inkra-card__divider"/g) || []).length, 1);
  assert.doesNotMatch(html, / divided=| action=| justify=| padding=|role="button"/);
});

test('Alert exposes outline, spacing and actions without leaking visual props', () => {
  const html = render(h(Alert.Root, { appearance: 'outline', size: 'sm', actions: h('button', null, 'Retry') }, h(Alert.Title, null, 'Warning')));
  assert.match(html, /inkra-pencil-surface--outline/);
  assert.match(html, /data-size="sm"/);
  assert.match(html, /inkra-alert__actions/);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, / actions=| appearance=| size=/);
});

test('Avatar clamps pencil and image corners together and allows no border', () => {
  const html = render(h(Avatar.Root, { radius: 99, bordered: false }, h(Avatar.Fallback, null, 'AB')));
  assert.match(html, /--inkra-avatar-radius:8px/);
  assert.match(html, /data-bordered="false"/);
  assert.doesNotMatch(html, /inkra-avatar__outline| bordered=| radius=/);
  assert.match(render(h(Avatar.Root, { radius: -5 })), /--inkra-avatar-radius:0px/);
  assert.match(render(h(Avatar.Root, { radius: NaN })), /--inkra-avatar-radius:8px/);
});

test('Table layout flags and logical alignment do not create grid semantics', () => {
  const html = render(h(Table.Root, { striped: true, hoverable: true, stickyHeader: true, captionSide: 'bottom' },
    h(Table.Header, null, h(Table.Row, null, h(Table.Head, { align: 'end' }, 'Total'))),
    h(Table.Body, null, h(Table.Row, null, h(Table.Cell, { align: 'right' }, '12')))));
  for (const attribute of ['data-striped', 'data-hoverable', 'data-sticky-header']) assert.match(html, new RegExp(`${attribute}="true"`));
  assert.match(html, /data-caption-side="bottom"/);
  assert.match(html, /data-align="end"/);
  assert.match(html, /data-align="right"/);
  assert.doesNotMatch(html, /role="grid"| stickyHeader=| hoverable=| striped=|captionSide=/);
});

test('Card supports outline and independent region layout without changing semantics', () => {
  const html = render(h(Card.Root, { variant: 'outline', size: 'lg', divided: false },
    h(Card.Header, { padding: 'sm', align: 'center', action: h('button', null, 'Edit') }, h(Card.Title, null, 'Note')),
    h(Card.Content, { padding: 'md' }, 'Content'),
    h(Card.Footer, { padding: 'none', orientation: 'vertical', justify: 'end' }, h('button', null, 'Save'))));
  assert.match(html, /inkra-pencil-surface--outline/);
  for (const value of ['sm', 'md', 'none']) assert.match(html, new RegExp(`data-padding="${value}"`));
  assert.match(html, /data-align="center"/);
  assert.match(html, /data-orientation="vertical"/);
  assert.doesNotMatch(html, / role="button"| padding=| orientation=| align=/);
});

test('Table cell layout retains scope, native attributes and complete contents', () => {
  const html = render(h(Table.Root, { layout: 'fixed' }, h(Table.Body, null,
    h(Table.Row, null, h(Table.Head, { scope: 'row', verticalAlign: 'top', wrap: false }, 'Long name'),
      h(Table.Cell, { verticalAlign: 'bottom', wrap: false, colSpan: 2 }, 'Complete description')))));
  assert.match(html, /data-layout="fixed"/);
  assert.match(html, /scope="row"/);
  assert.match(html, /data-vertical-align="top"/);
  assert.match(html, /data-vertical-align="bottom"/);
  assert.match(html, /data-wrap="false"/);
  assert.match(html, /Complete description/);
  assert.doesNotMatch(html, / verticalAlign=| wrap=| layout=|role="grid"/);
});
