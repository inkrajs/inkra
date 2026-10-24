import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeComponentMetricReport } from '../report-component-metrics.mjs';
import { validateComponentMetrics } from '../validate-component-metrics.mjs';

function inputs() {
  const Widget = () => null;
  const component = { component: 'Widget', aliases: ['Widget'], source: 'src/Widget.tsx', group: 'controls' };
  const samples = { n: 3, samples: [1, 2, 3], median: 2 };
  const result = { id: 'widget', covers: ['Widget'], size: 4, mode: 'ssr', status: 'measured', repetitions: 3, ssrVerified: true, phases: Object.fromEntries(['ssrFresh', 'ssrSameInputs', 'ssrChangedInputs'].map(phase => [phase, { wallTimeMs: structuredClone(samples) }])) };
  const sourceTree = 'a'.repeat(40);
  return {
    inventory: { summary: { total: 1, byGroup: { controls: 1 } }, components: [component] },
    publicApi: { exports: ['Widget', 'helper'] },
    library: { Widget, helper: () => undefined },
    runtime: { sourceTree, method: { repetitions: 3 }, results: [result], coverage: [{ ...component, status: 'measured-shared-fixture', evidence: [{ fixture: 'widget', size: 4, mode: 'ssr' }], attempted: [{ fixture: 'widget', size: 4, status: 'measured' }] }], summary: { identities: 1, aliases: 1, declared: 1, measured: 1, blocked: 0, unmeasured: 0 } },
    large: { sourceTree, method: { repetitions: 2 }, results: [{ name: 'model', size: 20, status: 'ok', repetitions: 2, operation: { samplesMs: [1, 2], medianMs: 2 } }, { name: 'limited', size: 20, status: 'timeout', reason: 'Recorded process limit' }] },
    bundles: { sourceTree, results: [{ id: 'Widget', status: 'measured', totals: { rawBytes: 100, gzipBytes: 80 } }] },
  };
}

test('metric validation derives counts and repetitions from current inputs, not historical constants', () => {
  const result = validateComponentMetrics(inputs());
  assert.equal(result.componentIdentities, 1);
  assert.equal(result.verifiedAliasPaths, 1);
  assert.equal(result.topLevelRuntimeExportsIncludingNonComponents, 2);
  assert.equal(result.runtimeRepetitions, 3);
  assert.equal(result.largeDataRepetitions, 2);
  assert.equal(result.largeDataCases, 2);
  assert.equal(result.largeDataSuccessful, 1);
  assert.match(result.largeDataCoverageBasis, /attempted-cases-only/);
});

test('metric validation rejects mixed source trees and stale public API', () => {
  const mixed = inputs();
  mixed.bundles.sourceTree = 'b'.repeat(40);
  assert.throws(() => validateComponentMetrics(mixed), /source trees differ/);
  const stale = inputs();
  stale.library.NewControl = () => null;
  assert.throws(() => validateComponentMetrics(stale), /runtime exports/);
  stale.publicApi.exports.push('NewControl');
  assert.throws(() => validateComponentMetrics(stale), /missing from inventory/);
});

test('metric validation rejects omitted and duplicate inventory/bundle coverage', () => {
  const omitted = inputs();
  omitted.bundles.results = [];
  assert.throws(() => validateComponentMetrics(omitted), /Bundle coverage/);
  const duplicate = inputs();
  duplicate.runtime.coverage.push(duplicate.runtime.coverage[0]);
  assert.throws(() => validateComponentMetrics(duplicate), /duplicate identities/);
});

test('metric validation rejects incomplete samples, phases and fabricated evidence', () => {
  const samples = inputs();
  samples.runtime.results[0].phases.ssrFresh.wallTimeMs.samples.pop();
  assert.throws(() => validateComponentMetrics(samples), /incomplete repetitions/);
  const phase = inputs();
  delete phase.runtime.results[0].phases.ssrChangedInputs;
  assert.throws(() => validateComponentMetrics(phase), /missing phase/);
  const evidence = inputs();
  evidence.runtime.coverage[0].evidence[0].size = 100;
  assert.throws(() => validateComponentMetrics(evidence), /evidence/);
});

test('metric validation preserves explicit blocked identities instead of counting them as measured', () => {
  const data = inputs();
  data.runtime.results = [{ id: 'widget', covers: ['Widget'], status: 'blocked', reason: 'Requires real DOM' }];
  data.runtime.coverage[0].status = 'blocked';
  data.runtime.coverage[0].evidence = [];
  data.runtime.coverage[0].attempted = [{ fixture: 'widget', status: 'blocked' }];
  data.runtime.summary.measured = 0;
  data.runtime.summary.blocked = 1;
  const result = validateComponentMetrics(data);
  assert.equal(result.runtimeIdentityCount, 0);
  assert.deepEqual(result.runtimeGaps, ['Widget']);
  data.runtime.coverage[0].status = 'measured-shared-fixture';
  assert.throws(() => validateComponentMetrics(data), /evidence\/status mismatch/);
});

test('metric validation enforces recorded case plans rather than inferring absent cases passed', () => {
  const data = inputs();
  data.runtime.casePlan = [{ id: 'widget', size: 4 }];
  data.large.method.casePlan = [{ name: 'model', size: 20 }, { name: 'limited', size: 20 }];
  assert.equal(validateComponentMetrics(data).largeDataCoverageBasis, 'exact-recorded-case-plan');
  data.large.results.pop();
  assert.throws(() => validateComponentMetrics(data), /Large data case plan/);
});

test('metric validation rejects absent observations, failure reasons and large-data phases', () => {
  const observed = inputs();
  observed.runtime.results[0].ssrVerified = false;
  assert.throws(() => validateComponentMetrics(observed), /unverified SSR/);
  const reason = inputs();
  delete reason.large.results[1].reason;
  assert.throws(() => validateComponentMetrics(reason), /missing failure reason/);
  const phase = inputs();
  phase.large.results[0].phases = {};
  assert.throws(() => validateComponentMetrics(phase), /missing mount/);
});


test('report generation uses supplied coverage and method metadata without historical findings', async () => {
  const output = await mkdtemp(join(tmpdir(), 'inkra-metric-report-test-'));
  try {
    const data = inputs();
    const merged = await writeComponentMetricReport(data, output);
    assert.equal(merged.summary.identities, 1);
    assert.equal(merged.summary.bundleMeasured, 1);
    assert.equal(merged.summary.largeDataScenarios, 2);
    const report = await readFile(join(output, 'REPORT.zh-CN.html'), 'utf8');
    assert.match(report, /<!doctype html>/);
    assert.match(report, /<table>/);
    assert.match(report, /1个独立组件身份、1条别名路径/);
    assert.match(report, /运行时：3次重复/);
    assert.match(report, /大数据：2次重复/);
    assert.match(report, /limited，N=20：timeout/);
    assert.match(report, /没有提供成对基线/);
    assert.doesNotMatch(report, /230个|347条|254个|284ms|263309|Vite8\.3\.4|socket权限拒绝/);
    assert.deepEqual((await readdir(output)).sort(), ['REPORT.zh-CN.html', 'component-metrics.csv', 'component-metrics.json', 'large-data-metrics.csv', 'runtime-metrics.csv', 'validation.json']);
    const validation = JSON.parse(await readFile(join(output, 'validation.json'), 'utf8'));
    assert.equal(validation.largeDataSuccessful, 1);
    const invalidOutput = join(output, 'invalid');
    data.bundles.results = [];
    await assert.rejects(writeComponentMetricReport(data, invalidOutput), /Bundle coverage/);
    await assert.rejects(readdir(invalidOutput), { code: 'ENOENT' });
  } finally { await rm(output, { recursive: true, force: true }); }
});
