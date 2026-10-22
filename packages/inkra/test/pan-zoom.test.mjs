import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = new URL('../src/pan-zoom/index.tsx', import.meta.url);
const stylesUrl = new URL('../src/pan-zoom/styles.css', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const styles = await readFile(stylesUrl, 'utf8');
const regularStyles = styles.split('@media print, (forced-colors: active)')[0];

test('PanZoom delegates gesture mechanics to react-zoom-pan-pinch 4.2 APIs', () => {
  assert.match(source, /from 'react-zoom-pan-pinch'/);
  assert.match(source, /<TransformWrapper/);
  assert.match(source, /<TransformComponent/);
  assert.match(source, /fitToView/);
  assert.match(source, /zoomToPoint/);
  assert.match(source, /zoomToElement/);
  assert.match(source, /clientToContent/);
  assert.match(source, /contentToClient/);
  assert.match(source, /panBy/);
  assert.doesNotMatch(source, /setPointerCapture|touches\[|wheelDelta|requestAnimationFrame/);
});

test('PanZoom exposes controlled state and stable ImageViewer controls', () => {
  assert.match(source, /value\?: PanZoomTransform/);
  assert.match(source, /defaultValue\?: PanZoomTransform/);
  assert.match(source, /onTransformChange\?:/);
  assert.match(source, /export interface PanZoomRef/);
  assert.match(source, /reset:/);
  assert.match(source, /fit:/);
  assert.match(source, /setTransform:/);
  assert.match(source, /zoomTo:/);
  assert.match(source, /zoomToElement:/);
  assert.match(source, /getViewportElement:/);
  assert.match(source, /getContentElement:/);
});

test('PanZoom preserves content interaction and an explicit wheel policy', () => {
  assert.match(source, /PanZoomWheelMode = 'modifier' \| 'always' \| 'disabled'/);
  assert.match(source, /keys\.includes\('Control'\) \|\| keys\.includes\('Meta'\)/);
  assert.match(source, /'button'/);
  assert.match(source, /'\[data-pan-zoom-no-drag\]'/);
  assert.match(source, /activationKeys: \(\) => !pointerBlocksPanRef\.current/);
  assert.match(source, /onPointerDownCapture/);
  assert.match(source, /onWheelCapture/);
  assert.match(source, /wheelTargetBlocksZoomRef/);
  assert.doesNotMatch(source, /interactionExclusions = \[[^\]]*contenteditable/);
  assert.match(source, /readOnly\?: boolean/);
  assert.match(source, /disabled\?: boolean/);
  assert.match(source, /keyboardPanStep/);
  assert.match(source, /keyboardZoomStep/);
  assert.match(source, /instructions\?: string/);
  assert.match(source, /<PencilSurface/);
  assert.match(source, /className="inkra-pan-zoom__focus-ring"/);
  assert.match(source, /data-gestures/);
  assert.match(styles, /not\(\[data-gestures\]\)/);
});

test('PanZoom styles provide stable geometry and accessibility fallbacks', () => {
  assert.match(styles, /--inkra-pan-zoom-min-block-size:\s*18rem/);
  assert.match(source, /className="inkra-pan-zoom__clip"/);
  assert.match(styles, /\.inkra-pan-zoom\s*\{[^}]*inline-size:\s*100%/s);
  assert.match(styles, /\.inkra-pan-zoom\s*\{[^}]*max-inline-size:\s*100%/s);
  assert.match(styles, /\.inkra-pan-zoom\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.inkra-pan-zoom__clip\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.inkra-pan-zoom__clip\s*>\s*\.react-transform-wrapper/);
  assert.match(styles, /\.inkra-pan-zoom__clip\s*>\s*\.react-transform-wrapper:focus-visible/);
  assert.match(styles, /\.inkra-pan-zoom__focus-ring\s*\{/);
  assert.match(styles, /\.inkra-pan-zoom__focus-ring\s*\{[^}]*inset:\s*var\(--inkra-space-1\)/s);
  assert.doesNotMatch(styles, /\.inkra-pan-zoom__focus-ring\s*\{[^}]*inset:\s*calc\([^}]*-/s);
  assert.match(styles, /:has\(\.react-transform-wrapper:focus-visible\)[^{]*>\s*\.inkra-pan-zoom__focus-ring/);
  assert.doesNotMatch(regularStyles, /outline:\s*[^;]*solid/i);
  assert.match(styles, /not\(\[data-gestures\]\)[^{]*\.react-transform-wrapper/);
  assert.match(styles, /inline-size:\s*100%\s*!important/);
  assert.match(styles, /block-size:\s*100%\s*!important/);
  assert.match(styles, /inline-size:\s*100%/);
  assert.match(styles, /block-size:\s*100%/);
  assert.match(styles, /touch-action:\s*none/);
  assert.match(styles, /clip-path:\s*inset\(50%\)/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media print, \(forced-colors: active\)/);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}/i);
});

