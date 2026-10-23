import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/sparkline/index.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/sparkline/styles.css', import.meta.url), 'utf8');
const model = await import('../src/sparkline/model.ts');

test('normalizes missing and non-finite values without dropping indexes', () => {
  assert.deepEqual(model.normalizeSparklineData([1, null, undefined, Number.NaN, -2]), [
    { index: 0, value: 1 }, { index: 1, value: null }, { index: 2, value: null }, { index: 3, value: null }, { index: 4, value: -2 },
  ]);
});

test('domain handles empty, constant, negative and mixed values', () => {
  assert.deepEqual(model.sparklineDomain([]), [0, 1]);
  const constant = model.sparklineDomain([{ index: 0, value: 4 }, { index: 1, value: 4 }]);
  assert(constant[0] < 4 && constant[1] > 4);
  const negative = model.sparklineDomain([{ index: 0, value: -8 }, { index: 1, value: -2 }]);
  assert(negative[0] < -8 && negative[1] > -2);
});

test('geometry emits SVG paths for line and area while preserving gaps', () => {
  const geometry = model.createSparklineGeometry(model.normalizeSparklineData([1, null, 3]), 120, 40);
  assert.match(geometry.linePath, /^M/);
  assert.match(geometry.areaPath, /^M/);
  assert.doesNotMatch(geometry.linePath, /NaN/);
});

test('SSR markup contains SVG and a textual data alternative', () => {
  assert.match(source, /<svg className="inkra-sparkline__svg"/);
  assert.match(source, /className="inkra-sparkline__data" aria-label/);
  assert.match(source, /const summary = useMemo\(/);
  assert.match(source, /if \(!values.length\) return 'No data'/);
  assert.match(source, /ArrowLeft/);
  assert.match(source, /onMouseEnter/);
  assert.match(source, /pencilStroke/);
  assert.match(source, /drawPencilWash/);
  assert.match(source, /effectiveShowPoints\) boundedPoints\.forEach/);
  assert.match(source, /showPoints \|\| values\.length === 1/);
  assert.match(source, /effectiveShowPoints/);
  assert.match(source, /activePoint && activePoint\.value !== null/);
  assert.match(source, /pencil--interaction/);
  assert.match(source, /ResizeObserver\(schedule\)/);
  assert.match(source, /observeCanvasRecovery\(/);
  assert.match(source, /readRenderToken\(style, '--inkra-wash-spacing'/);
  assert.match(source, /resolveCssColor/);
  assert.match(source, /washStrength \* 0\.34/);
  assert.match(source, /interactionReady/);
  assert.match(source, /context\.setTransform\(dpr, 0, 0, dpr, 0, 0\)/);
  assert.match(source, /new Path2D\(geometry\.areaPath\)/);
  assert.match(source, /new MutationObserver\(schedule\)/);
  assert.match(source, /observeCanvasRecovery/);
  assert.match(source, /setPencilReady\(false\)/);
  assert.match(styles, /interaction-ready\[data-show-points\] \.inkra-sparkline__point/);
  assert.match(styles, /forced-colors: active/);
  assert.match(styles, /interaction-ready\[data-show-points\] \.inkra-sparkline__point, \.inkra-sparkline--interaction-ready \.inkra-sparkline__guide/);
  assert.match(source, /PencilText seed=\{`sparkline-summary/);
  assert.match(source, /className="inkra-sparkline__pencil[^\"]*" style=\{\{ aspectRatio/);
  assert.match(styles, /prefers-reduced-motion/);
});

