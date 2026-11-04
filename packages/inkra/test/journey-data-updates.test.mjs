import assert from 'node:assert/strict';
import test from 'node:test';
import { createJourneyMapSetup, journeyMapDataUpdateMode, nextJourneyMapSetup } from '../dist/journey-map/dataUpdates.js';

const far = Object.freeze({ routes: Object.freeze([]) });
const near = Object.freeze({ routes: Object.freeze([{ id: 'synthetic-road' }]) });

test('omitted and invalid runtime update modes retain the official fit default', () => {
  assert.equal(journeyMapDataUpdateMode(), 'fit');
  assert.equal(journeyMapDataUpdateMode('unexpected'), 'fit');
  assert.equal(journeyMapDataUpdateMode('preserve-view'), 'preserve-view');
});

test('default updates retain reference-based setup invalidation and unrelated renders keep the setup', () => {
  const first = createJourneyMapSetup('fit', far, 12, 'sea');
  assert.equal(nextJourneyMapSetup(first, 'fit', far, 12, 'sea'), first);
  const changed = nextJourneyMapSetup(first, 'fit', near, 12, 'sea');
  assert.equal(changed.revision, 1); assert.equal(changed.data, near);
  assert.equal(nextJourneyMapSetup(changed, 'fit', near, 12, 'sea'), changed);
  assert.equal(nextJourneyMapSetup(changed, 'fit', near, 20, 'sea').revision, 2);
  assert.equal(nextJourneyMapSetup(changed, 'fit', near, 12, 'paper').revision, 2);
  assert.equal(first.revision, 0, 'the previous committed state is never mutated');
});

test('entering preservation, far-near-far and live fit/background options do not replace the setup', () => {
  const first = createJourneyMapSetup('fit', far, 12, 'sea');
  const preserved = nextJourneyMapSetup(first, 'preserve-view', near, 20, 'paper');
  assert.equal(preserved.revision, 0); assert.equal(preserved.data, undefined, 'inactive full-detail inputs are not retained by setup state');
  assert.equal(nextJourneyMapSetup(preserved, 'preserve-view', far, 20, 'paper'), preserved);
  assert.equal(nextJourneyMapSetup(preserved, 'preserve-view', near, 10, 'sea'), preserved);
  const reset = nextJourneyMapSetup(preserved, 'fit', near, 20, 'paper');
  assert.equal(reset.revision, 1); assert.equal(reset.data, near); assert.equal(reset.fitLimit, 20);
  assert.equal(reset.background, 'paper');
  assert.equal(nextJourneyMapSetup(reset, 'fit', near, 20, 'paper'), reset);
});

test('an initially preserved map still has one initial setup and leaving preservation fits even unchanged inputs', () => {
  const first = createJourneyMapSetup('preserve-view', far, 12, 'paper');
  assert.equal(first.revision, 0); assert.equal(first.data, undefined);
  const reset = nextJourneyMapSetup(first, 'fit', far, 12, 'paper');
  assert.equal(reset.revision, 1);
  assert.equal(nextJourneyMapSetup(reset, 'fit', far, 12, 'paper'), reset);
});
