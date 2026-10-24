import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { act, create } from 'react-test-renderer';
import { Select, SelectStepper } from '../dist/index.js';
import { fixtures } from '../../../scripts/perf-fixtures-controls-media.mjs';

const readJson = path => JSON.parse(readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8'));
const fixture = (await fixtures()).find(entry => entry.id === 'controls-select-stepper');

test('the supplemental audit counts both Stepper aliases as one new control identity', () => {
  assert.equal(Select.Stepper, SelectStepper);
  const publicApi = readJson('docs/performance-public-api.json');
  assert(publicApi.exports.includes('SelectStepper'));
  assert.match(publicApi.supplemental_review.scope, /historical report/);
  const controls = readJson('docs/performance-audit-controls.json');
  const inventory = readJson('docs/component-performance-inventory.json');
  const entries = controls.components.filter(entry => entry.component === 'Select.Stepper');
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].aliases, ['Select.Stepper', 'SelectStepper']);
  assert.equal(entries[0].introduced_by, 'a7a526b');
  assert.equal(controls.count, controls.components.length);
  assert.equal(inventory.summary.total, inventory.components.length);
  assert.equal(inventory.summary.byGroup.controls, controls.count);
  assert.deepEqual(inventory.components.filter(entry => entry.component === 'Select.Stepper'), entries);
});

test('the Stepper fixture renders its actual native options and both value variants on the server', () => {
  assert(fixture);
  assert.deepEqual(fixture.covers, ['Select.Stepper']);
  assert.deepEqual(fixture.scales, [1, 10, 100]);
  assert.notEqual(fixture.mode, 'ssr', 'The fixture should retain lifecycle coverage when DOM refs are null');
  assert.match(fixture.notes, /not part of the historical 230-identity report/);
  // Separate renderer processes avoid React's shared-context renderer warning.
  const htmlVariants = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { renderToString } from 'react-dom/server';
    import { fixtures } from './scripts/perf-fixtures-controls-media.mjs';
    const fixture = (await fixtures()).find(entry => entry.id === 'controls-select-stepper');
    console.log(JSON.stringify([0, 1].map(variant => renderToString(fixture.create(1, variant)))));
  `], { cwd: new URL('../../../', import.meta.url), encoding: 'utf8' }));
  for (const [variant, label, value] of [[0, 'Draft', 'draft'], [1, 'Published', 'published']]) {
    const html = htmlVariants[variant];
    for (const marker of ['inkra-select-stepper__control', 'inkra-select-stepper__native', 'role="spinbutton"', 'Select previous option', 'Select next option']) {
      assert(html.includes(marker), `Missing actual Stepper output: ${marker}`);
    }
    assert(html.includes(`aria-valuetext="${label}"`));
    assert.match(html, /<option disabled="" value="review">In review<\/option>/);
    assert(html.includes(`<option value="${value}" selected="">${label}</option>`));
    assert.equal((html.match(/<option\b/g) ?? []).length, 4, 'Three real options plus the native empty option');
  }
});

test('the Stepper fixture mounts and updates the exact public identity without browser mocks', async () => {
  const previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let renderer;
  try {
    await act(() => { renderer = create(fixture.create(2, 0)); });
    assert.equal(renderer.root.findAllByType(SelectStepper).length, 2);
    for (const variant of [0, 1]) {
      await act(() => renderer.update(fixture.create(2, variant)));
      const controls = renderer.root.findAll(node => node.type === 'button' && node.props.role === 'spinbutton');
      assert.equal(controls.length, 2);
      for (const control of controls) assert.equal(control.props['aria-valuetext'], variant ? 'Published' : 'Draft');
      const selects = renderer.root.findAllByType('select');
      assert.equal(selects.length, 2);
      assert.deepEqual(selects.map(node => node.props.name), ['stepper-0', 'stepper-1']);
      for (const select of selects) {
        assert.equal(select.props.value, variant ? 'published' : 'draft');
        assert.equal(select.findAllByType('option').length, 4);
      }
      const previousButtons = renderer.root.findAll(node => node.type === 'button' && node.props['aria-label'] === 'Select previous option');
      const nextButtons = renderer.root.findAll(node => node.type === 'button' && node.props['aria-label'] === 'Select next option');
      assert.equal(previousButtons.length, 2);
      assert.equal(nextButtons.length, 2);
      for (const button of previousButtons) assert.equal(Boolean(button.props.disabled), !variant);
      for (const button of nextButtons) assert.equal(Boolean(button.props.disabled), Boolean(variant));
    }
  } finally {
    if (renderer) await act(() => renderer.unmount());
    if (previousActEnvironment === undefined) delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    else globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  }
});
