// Optional native-canvas microbenchmark, not a browser/page performance claim.
// INKRA_CANVAS_MODULE can point to an isolated @napi-rs/canvas installation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { createCanvas, DOMMatrix } = await import(process.env.INKRA_CANVAS_MODULE || '@napi-rs/canvas');
globalThis.DOMMatrix = DOMMatrix;
globalThis.document = { createElement: () => createCanvas(1, 1) };
const current = await import('../packages/inkra/dist/internal/surfaceRenderer.js');
const baseline = process.argv[2]
  ? await import(pathToFileURL(resolve(process.argv[2], 'internal/surfaceRenderer.js')).href)
  : null;
const builds = baseline ? { baseline, current } : { current };
const theme = { paper: '#fcfcfa', dark: false, ink: '#778575', wash: '#2e634a' };
const results = {};
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
for (const [name, renderer] of Object.entries(builds)) {
  const canvas = createCanvas(1, 1);
  const draw = (seed, variant = 'action') => renderer.drawPencilSurface(canvas, null, 160, 44, variant, seed, 2, theme);
  const scenarios = { warmSameKey: [], coldUniqueKeys: [], beyondCacheWorkingSet: [] };
  for (let trial = 0; trial < 5; trial++) {
    globalThis.gc?.();
    draw(23);
    draw(23);
    let start = performance.now();
    for (let index = 0; index < 100; index++) draw(23);
    scenarios.warmSameKey.push(performance.now() - start);
    globalThis.gc?.();
    start = performance.now();
    for (let index = 0; index < 20; index++) draw(10000 + trial * 100 + index);
    scenarios.coldUniqueKeys.push(performance.now() - start);
    for (let index = 0; index < 80; index++) draw(20000 + trial * 100 + index, 'outline');
    globalThis.gc?.();
    start = performance.now();
    for (let index = 0; index < 80; index++) draw(20000 + trial * 100 + index, 'outline');
    scenarios.beyondCacheWorkingSet.push(performance.now() - start);
    console.error(`${name} sample ${trial + 1}/5 complete`);
  }
  results[name] = Object.fromEntries(Object.entries(scenarios).map(([scenario, values]) => [scenario, { medianMs: median(values), samplesMs: values }]));
}
let pixelIdenticalCases = 0;
if (baseline) {
  const hash = canvas => createHash('sha256').update(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data).digest('hex');
  for (const variant of ['paper', 'action', 'quiet', 'badge', 'outline', 'danger', 'selection', 'wash', 'full']) {
    for (const dark of [false, true]) for (const dpr of [1, 2]) for (const split of [false, true]) {
      const colors = { paper: dark ? '#191d1e' : '#fcfcfa', ink: dark ? '#e4e5df' : '#234e39', wash: dark ? '#82bdcb' : '#2e634a', dark };
      const expected = createCanvas(1, 1);
      const expectedBorder = split ? createCanvas(1, 1) : null;
      const args = [160, 44, variant, 42, dpr, colors];
      const points = baseline.drawPencilSurface(expected, expectedBorder, ...args);
      for (let repeat = 0; repeat < 3; repeat++) {
        const actual = createCanvas(1, 1);
        const actualBorder = split ? createCanvas(1, 1) : null;
        assert.deepEqual(current.drawPencilSurface(actual, actualBorder, ...args), points);
        assert.equal(hash(actual), hash(expected), `${variant}/${dark}/${dpr}/${split}/${repeat}`);
        if (split) assert.equal(hash(actualBorder), hash(expectedBorder));
      }
      pixelIdenticalCases++;
    }
  }
}
console.log(JSON.stringify({ node: process.version, engine: '@napi-rs/canvas', browser: false, workload: '160x44 DPR 2; warm: 100 action draws; cold: 20 unique action draws; beyond cache: 80 outline draws; five samples', results, pixelIdenticalCases }, null, 2));
