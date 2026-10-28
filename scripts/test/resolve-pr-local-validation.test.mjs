import assert from 'node:assert/strict';
import test from 'node:test';
import { githubRequest, resolveForCommit } from '../resolve-pr-local-validation.mjs';

const repository = 'inkrajs/inkra', head = 'a'.repeat(40), base = 'b'.repeat(40), merge = 'c'.repeat(40), tree = 'd'.repeat(40), candidate = 'e'.repeat(64);
const maintainer = { login: 'NWYLZW', databaseId: 51358815 };
const policy = { schemaVersion: 1, allowed_users: [{ id: maintainer.databaseId, login: maintainer.login }], allowed_groups: {
  'component:log': ['node24-react19.3.1'], 'browser:log': ['chromium-playwright1.64.1-react19.3.1'],
}, browser_groups: { 'browser:log': ['verify-log-refinement'] }, component_groups: { 'component:log': ['packages/inkra/test/log.test.mjs'] } };
const component = { group: 'component:log', environments: ['node24-react19.3.1'], evidence: 'https://example.invalid/reports/log', reason: 'Local Log tests passed' };
const browser = { ...component, group: 'browser:log', environments: ['chromium-playwright1.64.1-react19.3.1'] };
const body = entries => '```ci-local-validation\n' + JSON.stringify({ schemaVersion: 1, tested_commit: head, base_commit: base, candidate_sha256: candidate, local_passed: entries }) + '\n```';
function fixture(options = {}) {
  const calls = [];
  const pr = { number: 7, url: 'https://github.com/inkrajs/inkra/pull/7', body: body([component]), headRefOid: head, baseRefOid: base, baseRefName: 'main',
    merged: false, mergeCommit: null, author: maintainer, editor: null, updatedAt: '2026-10-28T00:00:00Z', lastEditedAt: null, ...options.pr };
  const request = async (path, config = {}) => {
    calls.push({ path, config });
    if (path === '/graphql') {
      assert.equal(config.method, 'POST');
      assert.deepEqual(config.body.variables, { owner: 'inkrajs', name: 'inkra', number: 7 });
      return { data: { repository: { pullRequest: pr } } };
    }
    if (path.includes('/commits/') && path.includes('/pulls?')) return options.associated ?? [{ number: 7, state: 'open', head: { sha: head } }];
    if (path.includes('/contents/')) {
      if (options.policyError) throw Object.assign(new Error('API failure'), { status: options.policyError });
      assert.equal(path, `/repos/${repository}/contents/.github/local-validation-policy.json?ref=${base}`, 'policy always comes from the exact PR base');
      return { encoding: 'base64', content: Buffer.from(JSON.stringify(options.policy ?? policy)).toString('base64') };
    }
    if (path === `/repos/${repository}/git/commits/${head}`) return { sha: head, tree: { sha: tree }, parents: [{ sha: base }] };
    if (path === `/repos/${repository}/git/commits/${merge}`) return { sha: merge, tree: { sha: options.targetTree ?? tree }, parents: options.parents ?? [{ sha: base }, { sha: head }] };
    throw new Error('Unexpected API request: ' + path);
  };
  return { request, pr, calls };
}
const resolve = (mock, options = {}) => resolveForCommit({ request: mock.request, repository, target: head, prNumber: 7, ...options });

test('fresh API author and exact base policy can authorize a direct PR head', async () => {
  const mock = fixture();
  const result = await resolve(mock, { expectedHead: head, expectedBase: base });
  assert.equal(result.accepted, true);
  assert.equal(result.targetRevision, head);
  assert.equal(result.targetTree, tree);
  assert.equal(result.headTree, tree);
  assert.equal(result.actor.id, maintainer.databaseId);
  assert.equal(result.prUrl, mock.pr.url);
  assert.deepEqual(result.browserGroups, policy.browser_groups);
  assert.deepEqual(result.componentGroups, policy.component_groups);
  assert(mock.calls.every(({ path }) => !path.startsWith('https:')), 'local report URLs are never fetched');
});

test('current body editor controls authorization rather than original author or last pusher', async () => {
  const edited = fixture({ pr: { editor: { login: 'outsider', databaseId: 99 }, lastEditedAt: '2026-10-28T01:00:00Z' } });
  const rejected = await resolve(edited);
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reasons[0].code, 'unauthorized-actor');
  assert.equal(rejected.actor.id, 99);
  assert.equal(rejected.bodyUpdatedAt, '2026-10-28T01:00:00Z');
  const maintained = fixture({ pr: { author: { login: 'outsider', databaseId: 99 }, editor: maintainer } });
  assert.equal((await resolve(maintained)).accepted, true);
  const bot = fixture({ pr: { editor: { login: 'automation[bot]' } } });
  assert.equal((await resolve(bot)).accepted, false);
  const deletedEditor = fixture({ pr: { editor: null, lastEditedAt: '2026-10-28T01:00:00Z' } });
  assert.equal((await resolve(deletedEditor)).accepted, false, 'an edited body with no available editor cannot inherit its author authority');
});

test('stale head/base and unavailable trusted policy leave ordinary tests required', async () => {
  for (const options of [{ expectedHead: merge, expectedBase: base }, { expectedHead: head, expectedBase: merge }]) {
    const mock = fixture();
    assert.equal((await resolve(mock, options)).reasons[0].code, 'stale-pr-snapshot');
    assert.equal(mock.calls.length, 1, 'stale snapshots cannot progress to accepting a declaration');
  }
  const missing = await resolve(fixture({ policyError: 404 }));
  assert.equal(missing.accepted, false);
  assert.equal(missing.reasons[0].code, 'policy-not-installed');
  await assert.rejects(resolve(fixture({ policyError: 403 })), /API failure/);
  await assert.rejects(resolve(fixture({ policyError: 500 })), /API failure/);
});

test('exact merged commits and explicit verified merge previews require an unchanged tested tree', async () => {
  const merged = fixture({ pr: { merged: true, mergeCommit: { oid: merge } } });
  assert.equal((await resolve(merged, { target: merge })).accepted, true);
  const preview = fixture();
  assert.equal((await resolve(preview, { target: merge, expectedHead: head, expectedBase: base })).accepted, true);
  const implicitPreview = await resolve(fixture(), { target: merge });
  assert.equal(implicitPreview.accepted, false);
  const dirty = await resolve(fixture({ targetTree: 'f'.repeat(40), pr: { merged: true, mergeCommit: { oid: merge } } }), { target: merge });
  assert.equal(dirty.reasons[0].code, 'different-tested-tree');
  assert.deepEqual(dirty.declarations, []);
  const wrongParents = await resolve(fixture({ parents: [{ sha: base }, { sha: 'f'.repeat(40) }] }), { target: merge, expectedHead: head, expectedBase: base });
  assert.equal(wrongParents.accepted, false);
});

test('automatic association accepts exactly one current head or exact merged PR', async () => {
  assert.equal((await resolveForCommit({ request: fixture().request, repository, target: head })).accepted, true);
  const merged = fixture({ associated: [{ number: 7, state: 'closed', merged_at: '2026-10-28T01:00:00Z', merge_commit_sha: merge }], pr: { merged: true, mergeCommit: { oid: merge } } });
  assert.equal((await resolveForCommit({ request: merged.request, repository, target: merge })).accepted, true);
  for (const associated of [[], [{ number: 7, state: 'open', head: { sha: merge } }], [{ number: 7, state: 'closed', head: { sha: head } }]]) {
    const result = await resolveForCommit({ request: fixture({ associated }).request, repository, target: head });
    assert.equal(result.reasons[0].code, 'no-associated-pr');
  }
  const duplicate = await resolveForCommit({ request: fixture({ associated: [{ number: 7, state: 'open', head: { sha: head } }, { number: 8, state: 'open', head: { sha: head } }] }).request, repository, target: head });
  assert.equal(duplicate.reasons[0].code, 'ambiguous-associated-pr');
});

test('candidate archive binding filters browser declarations without granting extra environments', async () => {
  const pr = { body: body([component, browser]) };
  const matched = await resolve(fixture({ pr }), { expectedCandidateSha256: candidate });
  assert.deepEqual(matched.declarations, [component, browser]);
  for (const expectedCandidateSha256 of [undefined, 'f'.repeat(64)]) {
    const filtered = await resolve(fixture({ pr }), { expectedCandidateSha256 });
    assert.equal(filtered.accepted, true);
    assert.deepEqual(filtered.declarations, [component]);
    assert.equal(filtered.reasons.at(-1).code, 'candidate-not-confirmed');
    const noBrowser = await resolve(fixture({ pr: { body: body([browser]) } }), { expectedCandidateSha256 });
    assert.equal(noBrowser.accepted, false);
    assert.deepEqual(noBrowser.declarations, []);
  }
  const noHash = JSON.parse(body([browser]).split('\n')[1]);
  delete noHash.candidate_sha256;
  assert.equal((await resolve(fixture({ pr: { body: '```ci-local-validation\n' + JSON.stringify(noHash) + '\n```' } }), { expectedCandidateSha256: candidate })).accepted, false);
});

test('GitHub API transport stays on GitHub, rejects failures and never logs API response bodies', async () => {
  const calls = [];
  const request = githubRequest('test-token', async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ data: {} }) }; });
  await request('/graphql', { method: 'POST', body: { query: 'query' } });
  assert.equal(calls[0].url, 'https://api.github.com/graphql');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers.authorization, 'Bearer test-token');
  assert.equal(calls[0].options.body, '{"query":"query"}');
  await assert.rejects(request('https://example.invalid/report'), /GitHub API paths/);
  const denied = githubRequest('test-token', async () => ({ ok: false, status: 403 }));
  await assert.rejects(denied('/repos/inkrajs/inkra/commits/x'), error => error.status === 403 && !error.message.includes('test-token'));
  const gqlError = githubRequest('test-token', async () => ({ ok: true, json: async () => ({ errors: [{ message: 'private details' }] }) }));
  await assert.rejects(gqlError('/graphql'), /could not resolve/);
  assert.throws(() => githubRequest(''), /token/);
});

test('untrusted repository, revision, partial PR binding and candidate identity fail before API use', async () => {
  for (const options of [{ repository: 'https://example.invalid/repo' }, { target: 'main' }, { prNumber: -1 }, { expectedHead: head }, { expectedCandidateSha256: 'latest' }]) {
    const mock = fixture();
    await assert.rejects(resolve(mock, options));
    assert.equal(mock.calls.length, 0);
  }
});
