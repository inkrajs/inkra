// Validate current inventory coverage and recorded measurements, not browser acceptance.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const exactKeys = (actual, expected, label) => {
  assert.equal(new Set(actual).size, actual.length, `${label}: duplicate identities`);
  assert.deepEqual([...actual].sort(), [...expected].sort(), `${label}: missing or unknown identities`);
};
const positiveInteger = (value, label) => assert(Number.isInteger(value) && value > 0, `${label}: expected positive integer`);
const nonnegative = (value, label) => assert(Number.isFinite(value) && value >= 0, `${label}: expected finite nonnegative value`);
const caseKey = row => JSON.stringify([row.id ?? row.name, row.size ?? null]);

function validateSamples(samples, repetitions, label) {
  assert(Array.isArray(samples), `${label}: missing samples`);
  assert.equal(samples.length, repetitions, `${label}: incomplete repetitions`);
  for (const value of samples) nonnegative(value, label);
}

function validateCasePlan(report, label) {
  const actual = report.results.map(caseKey);
  assert.equal(new Set(actual).size, actual.length, `${label}: duplicate cases`);
  // New producers can record an exact plan. Older artifacts only establish which
  // cases were attempted; missing, unrecorded cases must not become successes.
  const plan = report.casePlan ?? report.method?.casePlan;
  if (plan !== undefined) {
    assert(Array.isArray(plan) && plan.length > 0, `${label}: empty case plan`);
    exactKeys(actual, plan.map(caseKey), `${label} case plan`);
  }
  return plan ? 'exact-recorded-case-plan' : 'attempted-cases-only; no complete planned-case coverage claim';
}

export function validateComponentMetrics({ inventory, publicApi, library, runtime, large, bundles }) {
  assert(Array.isArray(inventory.components) && inventory.components.length > 0, 'Missing inventory');
  const ids = inventory.components.map(row => row.component);
  exactKeys(ids, new Set(ids), 'Inventory');
  assert.equal(inventory.summary.total, ids.length, 'Inventory summary total');
  const groupCounts = Object.fromEntries(Object.keys(inventory.summary.byGroup).map(group => [group, inventory.components.filter(row => row.group === group).length]));
  assert.deepEqual(inventory.summary.byGroup, groupCounts);
  assert.equal(Object.values(groupCounts).reduce((sum, value) => sum + value, 0), ids.length, 'Inventory groups');
  exactKeys(Object.keys(library), publicApi.exports, 'Current public runtime exports');

  const actualComponents = new Map();
  const add = (name, value) => {
    if (!value || !(typeof value === 'function' || typeof value === 'object' && value.$$typeof)) return;
    if (!actualComponents.has(value)) actualComponents.set(value, []);
    actualComponents.get(value).push(name);
  };
  for (const [name, value] of Object.entries(library)) {
    if (!/^[A-Z][a-z]/.test(name) || name.endsWith('Error')) continue;
    add(name, value);
    if (value && typeof value === 'object') {
      for (const [member, child] of Object.entries(value)) if (/^[A-Z][a-z]/.test(member)) add(`${name}.${member}`, child);
    }
  }
  const get = name => name.split('.').reduce((value, key) => value?.[key], library);
  const seen = new Set();
  let aliases = 0;
  for (const component of inventory.components) {
    const identity = get(component.component);
    assert(actualComponents.has(identity), `Unknown component ${component.component}`);
    assert(!seen.has(identity), `Duplicate component identity ${component.component}`);
    seen.add(identity);
    exactKeys(component.aliases, actualComponents.get(identity), `${component.component} aliases`);
    for (const alias of component.aliases) assert.equal(get(alias), identity, alias);
    aliases += component.aliases.length;
  }
  assert.equal(seen.size, actualComponents.size, 'Current public component missing from inventory');
  assert.equal(typeof runtime.sourceTree, 'string', 'Missing source tree');
  assert.match(runtime.sourceTree, /^[a-f0-9]{40,64}$/, 'Invalid source tree');
  for (const report of [large, bundles]) assert.equal(report.sourceTree, runtime.sourceTree, 'Metric source trees differ');
  positiveInteger(runtime.method?.repetitions, 'Runtime repetitions');
  positiveInteger(large.method?.repetitions, 'Large-data repetitions');
  assert(Array.isArray(runtime.results) && runtime.results.length > 0, 'Missing runtime cases');
  assert(Array.isArray(large.results) && large.results.length > 0, 'Missing large-data cases');
  const runtimeCoverageBasis = validateCasePlan(runtime, 'Runtime');
  const largeDataCoverageBasis = validateCasePlan(large, 'Large data');
  exactKeys(runtime.coverage.map(row => row.component), ids, 'Runtime coverage');
  exactKeys(bundles.results.map(row => row.id), ids, 'Bundle coverage');
  for (const row of bundles.results) {
    assert.equal(row.status, 'measured', `Unmeasured bundle ${row.id}`);
    positiveInteger(row.totals?.rawBytes, `${row.id} raw bundle bytes`);
    positiveInteger(row.totals?.gzipBytes, `${row.id} gzip bundle bytes`);
  }

  const idSet = new Set(ids);
  let sampleGroups = 0;
  for (const row of runtime.results) {
    assert(typeof row.id === 'string' && row.id, 'Missing fixture id');
    assert(Array.isArray(row.covers) && row.covers.length > 0, `${row.id}: missing identities`);
    exactKeys(row.covers, new Set(row.covers), `${row.id} covered identities`);
    for (const component of row.covers) assert(idSet.has(component), `Unknown fixture identity ${component}`);
    assert(['measured', 'blocked', 'failed', 'timeout'].includes(row.status), `Unknown runtime status ${row.status}`);
    if (row.status !== 'measured') { assert(row.reason, `${row.id}: missing gap reason`); continue; }
    positiveInteger(row.size, `${row.id} scale`);
    assert.equal(row.repetitions, runtime.method.repetitions, `${row.id} repetitions`);
    assert(['ssr', 'test-renderer'].includes(row.mode), `${row.id}: unsupported measurement mode`);
    const required = row.mode === 'ssr' ? ['ssrFresh', 'ssrSameInputs', 'ssrChangedInputs'] : ['mount', 'sameValueRecreatedFixture', 'changed', 'unmount'];
    for (const phase of required) assert(row.phases?.[phase], `${row.id}: missing phase ${phase}`);
    if (row.mode === 'ssr') assert.equal(row.ssrVerified, true, `${row.id}: unverified SSR output`);
    for (const [phase, metrics] of Object.entries(row.phases)) {
      validateSamples(metrics.wallTimeMs?.samples, runtime.method.repetitions, `${row.id}/${phase}`);
      assert.equal(metrics.wallTimeMs.n, runtime.method.repetitions, `${row.id}/${phase} sample count`);
      nonnegative(metrics.wallTimeMs.median, `${row.id}/${phase} median`);
      if (row.mode !== 'ssr' && phase === 'unmount') assert.equal(metrics.reactActualDurationMs, null, 'Unmount is not a Profiler render duration');
      sampleGroups++;
    }
  }
  const runtimeGaps = [];
  let runtimeMeasured = 0;
  for (const row of runtime.coverage) {
    const component = inventory.components.find(entry => entry.component === row.component);
    assert.deepEqual(row.aliases, component.aliases, `${row.component}: stale coverage aliases`);
    assert.equal(row.source, component.source, `${row.component}: stale source path`);
    const attempted = runtime.results.filter(result => result.covers.includes(row.component));
    assert(attempted.length > 0, `${row.component}: no attempted or explicitly blocked fixture`);
    const measured = attempted.filter(result => result.status === 'measured' && (result.mode === 'ssr' ? result.ssrVerified === true : result.observedIdentities?.[row.component]?.resolved === true && result.observedIdentities?.[row.component]?.mountedInstances > 0));
    const expectedStatus = measured.length ? 'measured-shared-fixture' : attempted.some(result => result.status === 'blocked') ? 'blocked' : 'unmeasured-or-failed';
    assert.equal(row.status, expectedStatus, `${row.component}: evidence/status mismatch`);
    exactKeys((row.evidence ?? []).map(entry => JSON.stringify([entry.fixture, entry.size])), measured.map(result => JSON.stringify([result.id, result.size])), `${row.component} evidence`);
    exactKeys((row.attempted ?? []).map(entry => JSON.stringify([entry.fixture, entry.size ?? null, entry.status])), attempted.map(result => JSON.stringify([result.id, result.size ?? null, result.status])), `${row.component} attempts`);
    for (const entry of row.evidence ?? []) {
      const result = measured.find(result => result.id === entry.fixture && result.size === entry.size);
      assert.equal(entry.mode, result.mode, `${row.component}: evidence mode mismatch`);
    }
    if (measured.length) runtimeMeasured++;
    else runtimeGaps.push(row.component);
  }
  const runtimeBlocked = runtime.coverage.filter(row => row.status === 'blocked').length;
  for (const [key, expected] of Object.entries({ identities: ids.length, aliases, declared: new Set(runtime.results.flatMap(row => row.covers)).size, measured: runtimeMeasured, blocked: runtimeBlocked, unmeasured: runtimeGaps.length - runtimeBlocked })) {
    assert.equal(runtime.summary?.[key], expected, `Runtime summary ${key}`);
  }
  for (const row of large.results) {
    assert(typeof row.name === 'string' && row.name, 'Missing large-data scenario name');
    positiveInteger(row.size, `${row.name} input size`);
    assert(['ok', 'failed', 'timeout', 'blocked'].includes(row.status), `Unknown large-data status ${row.status}`);
    if (row.status !== 'ok') { assert(row.reason, `${row.name}: missing failure reason`); continue; }
    assert.equal(row.repetitions, large.method.repetitions, `${row.name} repetitions`);
    assert(row.phases || row.operation, `${row.name}: missing measurements`);
    if (row.phases) for (const phase of ['mount', 'unchanged', 'oneItemChange']) assert(row.phases[phase], `${row.name}: missing ${phase}`);
    const phases = row.phases ?? { model: row.operation };
    assert(Object.keys(phases).length > 0, `${row.name}: empty phases`);
    for (const [phase, metrics] of Object.entries(phases)) {
      validateSamples(metrics.samplesMs, large.method.repetitions, `${row.name}/${phase}`);
      nonnegative(metrics.medianMs, `${row.name}/${phase} median`);
    }
  }
  return {
    passed: true,
    sourceTree: runtime.sourceTree,
    componentIdentities: ids.length,
    verifiedAliasPaths: aliases,
    topLevelRuntimeExportsIncludingNonComponents: Object.keys(library).length,
    bundleIdentitiesMeasured: bundles.results.length,
    runtimeIdentityCount: runtimeMeasured,
    runtimeGaps,
    runtimeCoverageBasis,
    sampleGroupsValidated: sampleGroups,
    runtimeRepetitions: runtime.method.repetitions,
    largeDataRepetitions: large.method.repetitions,
    largeDataCases: large.results.length,
    largeDataSuccessful: large.results.filter(row => row.status === 'ok').length,
    largeDataCoverageBasis,
    meaning: 'Integrity and current inventory accounting passed, NOT all runtime cases, planned scenarios without a recorded plan, performance budgets or browser acceptance passed.',
  };
}

export async function loadMetricInputs() {
  const read = async path => JSON.parse(await readFile(path, 'utf8'));
  return {
    inventory: await read(process.env.PERF_INVENTORY || 'docs/component-performance-inventory.json'),
    publicApi: await read('docs/performance-public-api.json'),
    library: await import('../packages/inkra/dist/index.js'),
    runtime: await read(process.env.PERF_RESULTS || '.local/all-components/results.json'),
    large: await read(process.env.LARGE_RESULTS || '.local/large-data/results.json'),
    bundles: await read(process.env.BUNDLE_RESULTS || '.local/component-bundles/bundle-results.json'),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = validateComponentMetrics(await loadMetricInputs());
  if (process.env.VALIDATION_OUTPUT) await writeFile(process.env.VALIDATION_OUTPUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
