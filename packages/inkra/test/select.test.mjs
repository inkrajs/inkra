import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Select } from '../dist/index.js';

const select = readFileSync(new URL('../src/select/Select.tsx', import.meta.url), 'utf8');
const index = readFileSync(new URL('../src/select/index.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/select/styles.css', import.meta.url), 'utf8');
const multiple = readFileSync(new URL('../src/select/MultipleSelect.tsx', import.meta.url), 'utf8');

function renderTrigger(props = {}, multiple = false) {
  return renderToStaticMarkup(h(Select.Root, multiple ? { multiple: true, defaultValue: ['team'], items: [{ value: 'team', label: 'Team' }] } : { defaultValue: 'team' },
    h(Select.Trigger, { 'aria-label': 'Visibility', ...props }, h(Select.Value, null, 'Team')),
  ));
}

test('Trigger renders decorative icons inside one shared surface for single and multiple selection', () => {
  for (const multiple of [false, true]) {
    const html = renderTrigger({ startIcon: h('i', null, 'start'), endIcon: h('i', null, 'end'), fullWidth: false, textAlign: 'end' }, multiple);
    assert.equal((html.match(/class="inkra-select__trigger-slot" aria-hidden="true"/g) ?? []).length, 2);
    assert.match(html, /data-full-width="false"/);
    assert.match(html, /data-text-align="end"/);
    assert.doesNotMatch(html, / startIcon=| endIcon=| hideValue=| hideIndicator=| fullWidth=| iconOnly=| textAlign=/);
    assert.equal((html.match(/<button\b/g) ?? []).length, 1);
  }
});

test('Icon-only retains a named control and a linked selected-value description', () => {
  for (const multiple of [false, true]) {
    const html = renderTrigger({ iconOnly: true, startIcon: h('i', null, 'start'), endIcon: h('i', null, 'end'), 'aria-describedby': 'help' }, multiple);
    assert.match(html, /aria-label="Visibility"/);
    const valueId = html.match(/id="([^"]+)" class="inkra-select__trigger-value-hidden"/)[1];
    assert(html.includes(`aria-describedby="help ${valueId}"`));
    assert.match(html, /data-icon-only="true"/);
    assert.match(html, />Team</);
    assert.doesNotMatch(html, /class="inkra-select__trigger-icon"|>end</);
  }
});

test('Hidden indicator removes its slot and null indicator remains backward-compatible', () => {
  for (const props of [{ hideIndicator: true }, { icon: null }]) {
    const html = renderTrigger(props);
    assert.doesNotMatch(html, /class="inkra-select__trigger-icon"/);
    assert.match(html, /class="inkra-select__trigger-value"/);
  }
  assert.match(renderTrigger({ iconOnly: true, icon: null }), /inkra-select__trigger-glyph/);
  assert.match(renderTrigger({ hideValue: true }), /inkra-select__trigger-value-hidden/);
});

test('Select exposes the complete single-value compound API', () => {
  for (const name of [
    'SelectRoot',
    'SelectTrigger',
    'SelectValue',
    'SelectPortal',
    'SelectContent',
    'SelectViewport',
    'SelectGroup',
    'SelectLabel',
    'SelectItem',
    'SelectItemText',
    'SelectItemIndicator',
    'SelectScrollUpButton',
    'SelectScrollDownButton',
    'SelectSeparator',
  ]) {
    assert.match(index, new RegExp(`\\b${name}\\b`));
  }

  assert.match(select, /from '@radix-ui\/react-select'/);
  assert.match(select, /Object\.freeze\(\{[\s\S]*?Root: SelectRoot[\s\S]*?Separator: SelectSeparator/);
  assert.match(select, /multiple\?: false/);
  assert.doesNotMatch(select, /addEventListener\(['"](?:keydown|pointerdown|click)/);
});

test('Root forwards Radix state and native form props while merging Field state', () => {
  assert.match(select, /type SelectSingleRootProps = SelectPrimitive\.SelectProps/);
  assert.match(select, /type SelectRootProps = SelectSingleRootProps \| SelectMultipleRootProps/);
  assert.match(select, /useFieldContext\(\)/);
  assert.match(select, /disabled: Boolean\(disabled \|\| field\?\.disabled\)/);
  assert.match(select, /required: Boolean\(required \|\| field\?\.required\)/);
  assert.match(select, /<SelectPrimitive\.Root[\s\S]*?\{\.\.\.props\}[\s\S]*?disabled=\{state\.disabled\}[\s\S]*?required=\{state\.required\}/);
  assert.doesNotMatch(select, /<select\b|<input\b/);
});

test('Trigger is labelable, described by Field copy, and captures the portal theme', () => {
  assert.match(select, /const resolvedId = field\?\.controlId \?\? id/);
  assert.match(select, /mergeAriaIds\([\s\S]*?field\?\.descriptionId[\s\S]*?field\?\.errorId/);
  assert.match(select, /aria-errormessage=\{errorMessage\}/);
  assert.match(select, /aria-invalid=\{resolvedInvalid \? true : ariaInvalid\}/);
  assert.match(select, /const portalRef = usePortalTriggerRef\(forwardedRef\)/);
  assert.match(select, /portalRef\(node\)/);
  assert.match(select, /const Trigger = multiple \? MultipleSelect.Trigger : SelectPrimitive.Trigger/);
  assert.match(select, /<Trigger[\s\S]*?id=\{resolvedId\}[\s\S]*?ref=\{ref\}/);
});

test('Portal and content preserve Radix semantics outside Inkra visuals', () => {
  assert.match(select, /<Portal[\s\S]*?<PortalThemeBridge>\{children\}<\/PortalThemeBridge>/);
  assert.match(select, /<Content[\s\S]*?ref=\{ref\}[\s\S]*?<PencilSurface/);
  assert.match(select, /surfaceRadius = 8/);
  assert.match(styles, /z-index: calc\(var\(--inkra-z-popover, 20\) \+ var\(--inkra-floating-layer-offset, 0\)\)/);
  assert.match(select, /dir=\{dir \?\? inferredDirection\}/);
  assert.match(select, /getComputedStyle\(directionSource\)\.direction === 'rtl'/);
  assert.match(select, /captureDirectionNode\?\.\(node\)/);
});

test('Visible value, labels, items, indicators and scroll controls use pencil primitives', () => {
  assert.match(select, /placeholder=\{copy\(placeholder, 'placeholder'\)\}/);
  assert.match(select, /interface SelectItemTextProps[\s\S]*?children: string/);
  assert.match(select, /<ItemText[\s\S]*?<PencilText/);
  assert.match(select, /variant="selection"/);
  assert.match(select, /<ItemIndicator[\s\S]*?<PencilIcon/);
  assert.match(select, /<ScrollUpButton[\s\S]*?<PencilIcon/);
  assert.match(select, /<Separator[\s\S]*?<PencilLine/);
});

test('Focus and Radix item state repaint pencil enhancement instead of relying on CSS ink', () => {
  const normalStyles = styles.slice(0, styles.indexOf('@media (forced-colors: active)'));
  assert.match(select, /className="inkra-select__focus-ring"[\s\S]*?variant="outline"/);
  assert.match(styles, /\.inkra-select__focus-ring\s*\{[\s\S]*?--inkra-accent-strong: var\(--inkra-focus\)/);
  assert.match(styles, /\.inkra-select__trigger:focus-visible \.inkra-select__focus-ring\s*\{[\s\S]*?opacity: 1/);
  assert.match(styles, /\.inkra-select__item:focus-visible\s*\{[\s\S]*?outline: 0/);
  assert.doesNotMatch(normalStyles, /\.inkra-select__trigger:focus-visible\s*\{[^}]*outline:\s*var\([^}]*solid/);
  assert.match(styles, /forced-colors: active[\s\S]*?outline: var\(--inkra-focus-width\) solid Highlight/);
  assert.match(styles, /forced-colors: active[\s\S]*?\.inkra-select__item:focus-visible[\s\S]*?solid CanvasText/);
  assert.match(select, /attributeFilter: \['data-highlighted', 'data-state', 'data-selected'\]/);
  assert.match(select, /key=\{version\}/);
  assert.match(select, /ref=\{copyRef\}/);
});

test('Multiple Select uses Base UI while keeping a discriminated string-array API', () => {
  assert.match(multiple, /from '@base-ui\/react\/select'/);
  assert.match(multiple, /multiple: true/);
  assert.match(multiple, /value\?: string\[\]/);
  assert.match(multiple, /defaultValue\?: string\[\]/);
  assert.match(multiple, /onValueChange\?: \(values: string\[\]\) => void/);
  assert.match(multiple, /<BaseSelect.Root<string, true>/);
  assert.match(multiple, /<BaseSelect.Item/);
  assert.match(multiple, /<BaseSelect.List/);
  assert.doesNotMatch(multiple, /addEventListener\(['"](?:keydown|pointerdown|click)/);
});

test('Multiple Select preserves label summaries, clearing, readonly and native form reset', () => {
  assert.match(multiple, /items\?: readonly SelectOption\[\]/);
  assert.match(multiple, /state.labels.get\(value\) \?\? value/);
  assert.match(multiple, /if \(disabled \|\| readOnly\) return/);
  assert.match(multiple, /if \(!event.defaultPrevented\) setUncontrolled\(defaultValueRef.current\)/);
  assert.match(multiple, /form\?\.addEventListener\('reset', reset\)/);
  assert.match(select, /Clear: SelectClear/);
  assert.match(select, /state\.disabled \|\| state\.readOnly \|\| state\.values\.length === 0/);
  assert.match(select, /state.change\(\[\]\)/);
  assert.match(select, /readOnly: Boolean\(readOnly \|\| field\?\.readOnly\)/);
  assert.match(styles, /data-selected/);
});

test('Select styling keeps stable control geometry and accessible fallbacks', () => {
  assert.match(styles, /\.inkra-select__trigger\s*\{[\s\S]*?min-height: var\(--inkra-touch-target\)/);
  assert.match(styles, /\.inkra-select__trigger-surface\s*\{[\s\S]*?height: var\(--inkra-select-height\)/);
  assert.match(styles, /\.inkra-select__item-surface\s*\{[\s\S]*?min-height: var\(--inkra-touch-target\)/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*?animation: none/);
  assert.match(styles, /forced-colors: active[\s\S]*?border: 1px solid CanvasText/);
  assert.match(styles, /data-highlighted[\s\S]*?selection-foreground/);
});
