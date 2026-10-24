import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const budgetUrl = new URL('../src/internal/surfaceBudget.ts', import.meta.url);
const budgetSource = readFileSync(budgetUrl, 'utf8');
const hookSource = readFileSync(new URL('../src/internal/usePencilSurface.ts', import.meta.url), 'utf8');
const rendererSource = readFileSync(new URL('../src/internal/surfaceRenderer.ts', import.meta.url), 'utf8');
const compiledBudget = ts.transpileModule(budgetSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  fileName: budgetUrl.pathname,
  reportDiagnostics: true,
});
assert.deepEqual(compiledBudget.diagnostics, []);
const budget = await import(`data:text/javascript;base64,${Buffer.from(compiledBudget.outputText).toString('base64')}`);

test('surface allocation rejects non-finite and non-positive dimensions before allocation', () => {
  for (const values of [
    [Number.NaN, 44, 1, 0, 1],
    [120, Number.POSITIVE_INFINITY, 1, 0, 1],
    [120, 44, 0, 0, 1],
    [120, 44, 0.5, 0, 1],
    [0, 44, 1, 0, 1],
    [120, -1, 1, 0, 1],
    [120, 44, 1, -1, 1],
  ]) {
    assert.deepEqual(budget.resolveSurfaceAllocation(...values), { ok: false, reason: 'invalid-size' });
  }
});

test('surface allocation preserves normal 1024 by 640 DPR 2 material for one or two layers', () => {
  const single = budget.resolveSurfaceAllocation(1024, 640, 2, 0, 1);
  const double = budget.resolveSurfaceAllocation(1024, 640, 2, 0, 2);
  assert.deepEqual(single, {
    ok: true,
    dpr: 2,
    width: 2048,
    height: 1280,
    layerPixels: 2_621_440,
    totalPixels: 2_621_440,
  });
  assert.deepEqual(double, { ...single, totalPixels: 5_242_880 });
});

test('surface allocation falls back only when DPR 1 still exceeds physical limits', () => {
  assert.deepEqual(
    budget.resolveSurfaceAllocation(9000, 10, 2, 0, 1),
    { ok: false, reason: 'edge-limit' },
  );
  assert.deepEqual(
    budget.resolveSurfaceAllocation(5000, 5000, 2, 0, 1),
    { ok: false, reason: 'layer-budget' },
  );
});

test('surface allocation lowers DPR for a 1305 by 954 page instead of dropping its material', () => {
  const allocation = budget.resolveSurfaceAllocation(1305, 954, 2, 0, 1);
  assert.equal(allocation.ok, true);
  assert.ok(allocation.dpr >= 1 && allocation.dpr < 2);
  assert.ok(allocation.layerPixels <= budget.MAX_SURFACE_LAYER_PIXELS);
});

test('surface allocation counts a clipped border layer while adapting DPR', () => {
  const allocation = budget.resolveSurfaceAllocation(1440, 720, 2, 0, 2);
  assert.equal(allocation.ok, true);
  assert.ok(allocation.dpr >= 1 && allocation.dpr < 2);
  assert.ok(allocation.layerPixels <= budget.MAX_SURFACE_LAYER_PIXELS);
  assert.ok(allocation.totalPixels <= budget.MAX_SURFACE_TOTAL_PIXELS);

  assert.deepEqual(
    budget.resolveSurfaceAllocation(2500, 1300, 2, 0, 2),
    { ok: false, reason: 'surface-budget' },
  );
});

test('fallback release drops old bitmaps and normal allocation remains recoverable', () => {
  const ink = { width: 4096, height: 2048 };
  const border = { width: 4096, height: 2048 };
  budget.releaseSurfaceBitmaps(ink, border);
  assert.deepEqual(ink, { width: 0, height: 0 });
  assert.deepEqual(border, { width: 0, height: 0 });
  assert.equal(budget.resolveSurfaceAllocation(1024, 640, 2, 0, 2).ok, true);

  assert.match(hookSource, /catch \{\s*releaseSurfaceBitmaps\(canvas, borderRef\.current\);\s*root\.dataset\.pencilFallback = 'true';/);
  assert.match(hookSource, /delete root\.dataset\.pencilFallback;\s*lastPaint = paintKey;/);
  assert.match(hookSource, /root\.style\.removeProperty\('--inkra-pencil-clip'\);\s*lastPaint = '';/);
});

function bitmapSpy(initialWidth, initialHeight) {
  let width = initialWidth;
  let height = initialHeight;
  const states = [];
  return {
    canvas: {
      get width() { return width; },
      set width(value) { width = value; states.push([width, height]); },
      get height() { return height; },
      set height(value) { height = value; states.push([width, height]); },
    },
    states,
  };
}

test('dimension swaps release main and border bitmaps before either target edge grows', () => {
  const ink = bitmapSpy(256, 8192);
  const border = bitmapSpy(256, 8192);
  budget.resizeSurfaceBitmap(ink.canvas, 8192, 256);
  budget.resizeSurfaceBitmap(border.canvas, 8192, 256);

  for (const states of [ink.states, border.states]) {
    assert.deepEqual(states, [[0, 8192], [0, 0], [8192, 0], [8192, 256]]);
    assert.ok(states.every(([width, height]) => width * height <= budget.MAX_SURFACE_LAYER_PIXELS));
  }
});

test('same-size repaint still resets the bitmap without changing its allocation', () => {
  const bitmap = bitmapSpy(2048, 1280);
  budget.resizeSurfaceBitmap(bitmap.canvas, 2048, 1280);
  assert.deepEqual(bitmap.states, [[2048, 1280]]);
});

test('surface renderer checks the budget before assigning bitmap dimensions', () => {
  const budgetCheck = rendererSource.indexOf('resolveSurfaceAllocation(width, height, dpr, bleed');
  const bitmapResize = rendererSource.indexOf('resizeSurfaceBitmap(canvas, allocation.width, allocation.height)');
  assert.ok(budgetCheck >= 0 && bitmapResize > budgetCheck);
  assert.match(rendererSource, /if \(!allocation\.ok\) \{\s*releaseSurfaceBitmaps\(canvas, borderCanvas\);\s*throw new RangeError/);
  assert.match(rendererSource, /if \(!context\) \{\s*releaseSurfaceBitmaps\(canvas, borderCanvas\);/);
  assert.match(rendererSource, /if \(borderCanvas\) resizeSurfaceBitmap\(borderCanvas, allocation\.width, allocation\.height\);/);
  assert.match(rendererSource, /const renderDpr = allocation\.dpr;/);
  assert.doesNotMatch(rendererSource, /paperPattern\(context, theme\.paper, theme\.dark, dpr\)/);
  assert.doesNotMatch(rendererSource, /\bdpr,\s*\n\s*\}\);/);
});
