// Paired development-renderer comparison. Build both checkouts first.
// node scripts/benchmark-report-updates.mjs --baseline ../baseline > comparison.json
// No browser layout, painting, scrolling, or interaction-latency claims.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const current = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const index = process.argv.indexOf('--baseline');
assert(index >= 0 && process.argv[index + 1], 'Pass --baseline <built checkout>');
const baseline = resolve(process.argv[index + 1]);
const repetitions = Number(process.env.BENCH_REPETITIONS ?? 7);
assert(Number.isSafeInteger(repetitions) && repetitions > 0);
const modules = ['tree-select', 'tag-input', 'choice-grid', 'data-table'];
const provenance = root => ({
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceHashes: Object.fromEntries(modules.map(name => [name, createHash('sha256').update(readFileSync(resolve(root, `packages/inkra/src/${name}/index.tsx`))).digest('hex')])),
  distHashes: Object.fromEntries(modules.map(name => [name, createHash('sha256').update(readFileSync(resolve(root, `packages/inkra/dist/${name}/index.js`))).digest('hex')])),
  fixtureHashes: Object.fromEntries(['benchmark-large-data', 'large-data-collections', 'large-data-tables'].map(name => [name, createHash('sha256').update(readFileSync(resolve(root, `scripts/${name}.mjs`))).digest('hex')])),
});
const report = {
  schemaVersion: 1,
  environment: { node: process.version, cpu: os.cpus()[0]?.model, platform: process.platform, arch: process.arch },
  method: { repetitions, warmupRuns: 1, serial: true, alternatingFirstVariant: true, reversedOrder: process.env.BENCH_REVERSE_ORDER === '1', browser: false, metric: 'React development test-renderer render/reconciliation/effect flushing in act; null DOM refs', memory: 'Per-process peak RSS includes runtime, imports, fixtures and allocator retention, not component heap or leak evidence' },
  baseline: provenance(baseline), current: provenance(current), results: [],
};
assert.deepEqual(report.baseline.fixtureHashes, report.current.fixtureHashes, 'Both variants must use identical fixtures and harness');
const cases = [
  ...[1000, 10000, 50000].map(size => ['collections', size, 'TreeSelect/closed-preprocessing']),
  ...[1000, 10000].map(size => ['collections', size, 'TagInput/full-controlled-tags']),
  ...[1000, 10000].map(size => ['collections', size, 'ChoiceGrid/full-multiple-options']),
  ...[1000, 50000].map(size => ['tables', size, 'DataTable-paginated']),
];
for (const [caseIndex, [group, size, name]] of cases.entries()) {
  if (process.env.BENCH_FILTER && !process.env.BENCH_FILTER.split(',').some(filter => name.includes(filter))) continue;
  const result = { name, size, order: caseIndex % 2 ? ['current', 'baseline'] : ['baseline', 'current'] };
  if (process.env.BENCH_REVERSE_ORDER === '1') result.order.reverse();
  for (const variant of result.order) {
    const root = variant === 'baseline' ? baseline : current;
    const child = spawnSync(process.execPath, ['--max-old-space-size=1536', resolve(root, 'scripts/benchmark-large-data.mjs'), '--case', group, String(size), name], {
      cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, NODE_ENV: 'development', TZ: 'UTC', BENCH_REPETITIONS: String(repetitions) },
    });
    assert.equal(child.status, 0, `${variant} ${name} ${size}: ${child.error?.message ?? child.stderr}`);
    result[variant] = JSON.parse(child.stdout.trim());
    console.error(`${variant} ${name} N=${size} complete`);
  }
  assert.deepEqual(result.baseline.hostNodeCounts, result.current.hostNodeCounts, `${name}: visible host-node counts changed`);
  result.comparison = Object.fromEntries(Object.keys(result.baseline.phases).map(phase => {
    const before = result.baseline.phases[phase].medianMs;
    const after = result.current.phases[phase].medianMs;
    return [phase, { beforeMedianMs: before, afterMedianMs: after, reductionPercent: (before - after) / before * 100 }];
  }));
  report.results.push(result);
}
console.log(JSON.stringify(report, null, 2));
