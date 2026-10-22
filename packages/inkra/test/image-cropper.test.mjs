import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  IMAGE_CROPPER_MAX_OUTPUT_EDGE,
  IMAGE_CROPPER_MAX_OUTPUT_PIXELS,
  ImageCropperExportError,
  clampImageCropperArea,
  resolveImageCropperOutputSize,
} from '../dist/image-cropper/index.js';

const source = readFileSync(new URL('../src/image-cropper/index.tsx', import.meta.url), 'utf8');
const model = readFileSync(new URL('../src/image-cropper/model.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/image-cropper/styles.css', import.meta.url), 'utf8');

test('clamps engine pixel coordinates to the natural image bounds', () => {
  assert.deepEqual(clampImageCropperArea({ x: -10, y: 20.4, width: 900, height: 300 }, { width: 800, height: 600 }), {
    x: 0, y: 20, width: 800, height: 300,
  });
});

test('resolves bounded export dimensions without accidental upscaling', () => {
  assert.deepEqual(resolveImageCropperOutputSize({ width: 4000, height: 2000 }, { maxWidth: 1000 }), { width: 1000, height: 500 });
  assert.deepEqual(resolveImageCropperOutputSize({ width: 400, height: 200 }, { maxWidth: 1000 }), { width: 400, height: 200 });
  assert.deepEqual(resolveImageCropperOutputSize({ width: 4000, height: 4000 }, { maxPixels: 1_000_000 }), { width: 1000, height: 1000 });
  assert.ok(IMAGE_CROPPER_MAX_OUTPUT_EDGE <= 8192);
  assert.ok(IMAGE_CROPPER_MAX_OUTPUT_PIXELS <= 33_554_432);
});

test('rejects empty selections with a structured export error', () => {
  assert.throws(() => resolveImageCropperOutputSize({ width: 0, height: 20 }), error => {
    assert.ok(error instanceof ImageCropperExportError);
    assert.equal(error.code, 'invalid-selection');
    return true;
  });
});

test('ImageCropper delegates gesture and coordinate work to react-easy-crop', () => {
  assert.match(source, /from ['"]react-easy-crop['"]/);
  assert.match(source, /onCropComplete=/);
  assert.match(source, /onCropAreaChange=/);
  assert.match(source, /keyboardStep=/);
  assert.match(source, /disableAutomaticStylesInjection/);
  assert.match(source, /restrictPosition/);
  assert.doesNotMatch(source, /pointermove|touchmove|mousemove/);
  assert.match(model, /naturalWidth/);
  assert.match(model, /toBlob/);
});

test('ImageCropper has controlled state, object URL cleanup, CORS messaging and keyboard alternatives', () => {
  assert.match(source, /crop\?: ImageCropperPoint/);
  assert.match(source, /zoom\?: number/);
  assert.match(source, /URL\.createObjectURL/);
  assert.match(source, /URL\.revokeObjectURL/);
  assert.match(model, /server did not permit canvas export/);
  assert.match(source, /event\.altKey/);
  assert.match(source, /aria-label=\{labels\.cropper\}/);
});

test('ImageCropper CSS keeps a stable responsive stage and accessibility fallbacks', () => {
  assert.match(styles, /block-size: clamp\(18rem, 52vw, 30rem\)/);
  assert.match(styles, /@media \(max-width: 36rem\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /min-block-size: 15rem/);
});

test('ImageCropper loading state uses shared PencilIcon loader geometry instead of a CSS border spinner', () => {
  assert.match(source, /const loadingPaths = \[\{ d: 'M21 12a9 9 0 1 1-6\.219-8\.56' \}\]/);
  assert.match(source, /className="inkra-image-cropper__spinner"/);
  assert.match(source, /paths=\{loadingPaths\}/);
  assert.match(styles, /\.inkra-image-cropper__spinner[\s\S]*?animation: inkra-image-cropper-spin/);
  assert.doesNotMatch(styles, /\.inkra-image-cropper__spinner \{[^}]*border:/);
  assert.match(source, /<PencilSurface as="span" aria-hidden="true" className="inkra-image-cropper__stage-surface"/);
  assert.match(source, /<PencilText>/);
  assert.match(styles, /\.inkra-image-cropper__area \{[^}]*border: 2px solid currentColor/);
});
