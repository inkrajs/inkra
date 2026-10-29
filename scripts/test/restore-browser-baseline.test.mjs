import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { githubBaselineClient, restoreBrowserBaseline, validateBaselineSource } from '../restore-browser-baseline.mjs';

const currentHead = 'a'.repeat(40), previousHead = 'b'.repeat(40);
const now = Date.parse('2026-10-30T00:00:00Z');
const archive = Buffer.from('immutable archive');
const run = {
  id: 123, run_attempt: 2, repository: { full_name: 'inkrajs/inkra' }, head_repository: { full_name: 'inkrajs/inkra' },
  path: '.github/workflows/publish.yml', event: 'workflow_dispatch', status: 'completed', conclusion: 'success',
  head_sha: previousHead, updated_at: '2026-10-29T23:00:00Z',
};
const artifact = {
  id: 456, name: 'release-browser-reuse', expired: false,
  digest: 'sha256:' + createHash('sha256').update(archive).digest('hex'),
  workflow_run: { id: run.id, head_sha: previousHead },
};
const receipt = {
  schemaVersion: 1, kind: 'inkra-browser-reuse', repository: 'inkrajs/inkra',
  runId: run.id, runAttempt: run.run_attempt, headSha: previousHead, entries: [],
};

function fixture(patch = {}) {
  const config = { run, artifact, receipt, archive, listing: [run], ancestor: true, ...patch };
  const calls = [];
  return {
    currentHead, currentRunId: 999, now, calls,
    async api(path) {
      calls.push(path);
      if (path.includes('/workflows/publish.yml/runs?')) return { workflow_runs: config.listing };
      if (path.endsWith('/artifacts?per_page=100')) return { artifacts: config.artifact ? [config.artifact] : [] };
      if (path.endsWith('/runs/123')) return config.run;
      throw Error('Unexpected API request: ' + path);
    },
    async download(path) { assert.equal(path, '/repos/inkrajs/inkra/actions/artifacts/456/zip'); return config.archive; },
    async readReceipt(bytes) { assert.deepEqual(bytes, archive); return config.receipt; },
    async isAncestor(ancestor, descendant) {
      assert([currentHead, previousHead].includes(ancestor));
      assert(['origin/main', currentHead].includes(descendant));
      return config.ancestor;
    },
  };
}

test('restores a digest-verified successful ancestor release and binds real run identity', async () => {
  const result = await restoreBrowserBaseline(fixture());
  assert.equal(result.trusted, true);
  assert.equal(result.origin.runId, 123);
  assert.equal(result.origin.runAttempt, 2);
  assert.equal(result.origin.artifactDigest, artifact.digest);
  assert.deepEqual(result.receipt, receipt);
});

test('first rollout, missing receipts, and unmerged sources retain normal coverage', async () => {
  for (const patch of [{ listing: [] }, { artifact: null }, { ancestor: false }]) {
    const result = await restoreBrowserBaseline(fixture(patch));
    assert.equal(result.trusted, false);
    assert(result.reason.length > 0);
  }
});

test('refuses PR/fork/failing/running/expired/wrong workflow and artifact identities', async () => {
  for (const patch of [
    { event: 'pull_request' }, { repository: { full_name: 'elsewhere/repo' } },
    { head_repository: { full_name: 'fork/inkra' } }, { conclusion: 'failure' },
    { status: 'in_progress' }, { path: '.github/workflows/check.yml' },
    { updated_at: '2026-01-01T00:00:00Z' }, { updated_at: '2027-01-01T00:00:00Z' },
    { run_attempt: 0 }, { head_sha: 'main' }, { id: 999 },
  ]) assert.throws(() => validateBaselineSource({ ...run, ...patch }, artifact, { currentRunId: 999, now }), JSON.stringify(patch));
  for (const patch of [
    { expired: true }, { digest: undefined }, { name: 'pr-browser-results' },
    { workflow_run: { id: 999, head_sha: previousHead } },
    { workflow_run: { id: 123, head_sha: currentHead } },
  ]) assert.throws(() => validateBaselineSource(run, { ...artifact, ...patch }, { now }), JSON.stringify(patch));
});

test('mismatched archive, receipt SHA, run or attempt never grants reuse', async () => {
  for (const patch of [
    { archive: Buffer.from('tampered archive') },
    ...[{ runId: 999 }, { runAttempt: 1 }, { headSha: currentHead }, { repository: 'fork/inkra' }, { kind: 'invented' }]
      .map(fields => ({ receipt: { ...receipt, ...fields } })),
  ]) {
    const result = await restoreBrowserBaseline(fixture(patch));
    assert.equal(result.trusted, false, JSON.stringify(patch));
  }
});

test('current run is excluded and no ambiguous artifact is used', async () => {
  const config = fixture({ listing: [{ ...run, id: 999 }] });
  assert.equal((await restoreBrowserBaseline(config)).trusted, false);
  assert.equal(config.calls.length, 1);
  const multiple = fixture();
  const api = multiple.api;
  multiple.api = async path => path.endsWith('/artifacts?per_page=100') ? { artifacts: [artifact, artifact] } : api(path);
  assert.equal((await restoreBrowserBaseline(multiple)).trusted, false);
});

test('storage download never receives the GitHub token', async () => {
  const calls = [];
  const client = githubBaselineClient('example-token', async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return new Response(null, { status: 302, headers: { location: 'https://storage.example.invalid/signed' } });
    return new Response(archive);
  });
  assert.deepEqual(await client.download('/repos/inkrajs/inkra/actions/artifacts/456/zip'), archive);
  assert.equal(calls[0].options.headers.authorization, 'Bearer example-token');
  assert.equal(calls[1].options.headers, undefined);
  assert.equal(calls[1].options.redirect, 'error');
  await assert.rejects(client.api('/repos/another/repo/actions/runs'), /Unexpected GitHub API path/);
});
