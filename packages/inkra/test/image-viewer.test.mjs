import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  nextImageViewerIndex,
  resolveImageViewerSelection,
} from '../dist/image-viewer/model.js';

const component = readFileSync(new URL('../src/image-viewer/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/image-viewer/styles.css', import.meta.url), 'utf8');

test('selection follows stable ids and chooses the nearest surviving image', () => {
  const items = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
  assert.deepEqual(resolveImageViewerSelection(items, 'two', 0), { activeId: 'two', index: 1 });
  assert.deepEqual(resolveImageViewerSelection([items[0], items[2]], 'two', 1), { activeId: 'three', index: 1 });
  assert.deepEqual(resolveImageViewerSelection([], 'two', 1), { activeId: null, index: -1 });
});

test('navigation supports bounded and looping lists', () => {
  assert.equal(nextImageViewerIndex(3, 0, -1, true), 2);
  assert.equal(nextImageViewerIndex(3, 2, 1, true), 0);
  assert.equal(nextImageViewerIndex(3, 0, -1, false), 0);
  assert.equal(nextImageViewerIndex(3, 2, 1, false), 2);
  assert.equal(nextImageViewerIndex(0, 0, 1, true), -1);
});

test('ImageViewer composes the shared Overlay and keeps focus, escape and scroll locking with Radix', () => {
  assert.match(component, /<OverlayRoot/);
  assert.match(component, /<OverlayPortal>/);
  assert.match(component, /<OverlayBackdrop\s*\/>/);
  assert.match(component, /<OverlayContent[\s\S]*?layout="sections"/);
  assert.match(component, /onOpenAutoFocus=/);
  assert.doesNotMatch(component, /document\.body\.style|addEventListener\(['"]keydown/);
});

test('ImageViewer delegates transforms to PanZoom and only adds optional rotation presentation', () => {
  assert.match(component, /import \{ PanZoom \} from '\.\.\/pan-zoom\/index\.js'/);
  assert.match(component, /<PanZoom[\s\S]*?fitOnInit="contain"[\s\S]*?wheel=\{zoomable \? wheel : 'disabled'\}/);
  assert.match(component, /panZoomRef\.current\?\.zoomIn/);
  assert.match(component, /panZoomRef\.current\?\.zoomOut/);
  assert.match(component, /panZoomRef\.current\?\.reset/);
  assert.doesNotMatch(component, /setPointerCapture|touches\[|wheelDelta/);
});

test('ImageViewer provides alt text, failure recovery, empty state and keyboard navigation', () => {
  assert.match(component, /alt: activeItem\.alt/);
  assert.match(component, /role="alert"/);
  assert.match(component, /labels\.emptyTitle/);
  assert.match(component, /event\.key === 'ArrowLeft'/);
  assert.match(component, /event\.key === 'ArrowRight'/);
  assert.match(component, /event\.key === 'Home'/);
  assert.match(component, /event\.key === 'End'/);
  assert.match(component, /role="listbox"/);
  assert.match(component, /role="option"/);
  assert.match(component, /\{ key, \.\.\.imageProps \}: ImageViewerImageRenderProps/);
  assert.match(component, /<img key=\{key\} \{\.\.\.imageProps\}/);
});

test('ImageViewer owns stable viewport and thumbnail geometry across desktop and mobile', () => {
  assert.match(styles, /height: min\(52rem, calc\(100dvh/);
  assert.match(styles, /\.inkra-image-viewer__thumbnail[\s\S]*?flex: 0 0 5rem;[\s\S]*?block-size: 3\.75rem/);
  assert.match(styles, /object-fit: contain/);
  assert.match(styles, /@media \(max-width: 30rem\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
});
