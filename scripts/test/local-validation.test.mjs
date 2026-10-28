import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { localValidationSummary, resolveLocalValidation, validateLocalValidationPolicy } from '../local-validation.mjs';

const head = 'a'.repeat(40), base = 'b'.repeat(40), repository = 'inkrajs/inkra';
const policy = {
  schemaVersion: 1, allowed_users: [{ id: 51358815, login: 'NWYLZW' }],
  allowed_groups: {
    'component:log': ['node22-react18.3.1', 'node24-react19.3.1'],
    'browser:log': ['chromium-playwright1.64.1-react19.3.1'],
  },
};
const declaration = {
  schemaVersion: 1, tested_commit: head, base_commit: base,
  local_passed: [{ group: 'component:log', environments: ['node24-react19.3.1'], evidence: 'https://example.invalid/reports/log', reason: 'Local Log suite passed on the recorded commit' }],
};
const body = value => '## Description\n\n```ci-local-validation\n' + JSON.stringify(value, null, 2) + '\n```\n';
const event = {
  action: 'opened', repository: { full_name: repository }, sender: { id: 51358815, login: 'NWYLZW', type: 'User' },
  pull_request: { number: 17, body: body(declaration), user: { id: 20, login: 'different-author' }, head: { sha: head }, base: { sha: base, repo: { full_name: repository } } },
};
const resolve = (changes = {}) => resolveLocalValidation({ event: structuredClone(event), policy: structuredClone(policy), repository, head, base, ...changes });
const changedDeclaration = change => {
  const next = structuredClone(declaration);
  change(next);
  const nextEvent = structuredClone(event);
  nextEvent.pull_request.body = body(next);
  return nextEvent;
};

test('trusted sender attests only the explicitly declared group and environment', () => {
  const result = resolve();
  assert.equal(result.accepted, true);
  assert.deepEqual(result.actor, { id: 51358815, login: 'NWYLZW' });
  assert.equal(result.prNumber, 17);
  assert.deepEqual(result.declarations, declaration.local_passed);
  assert.equal(result.head, head);
  assert.equal(result.base, base);
  assert.match(result.policyDigest, /^[a-f0-9]{64}$/);
  assert.match(result.declarationDigest, /^[a-f0-9]{64}$/);
  assert(!result.declarations[0].environments.includes('node22-react18.3.1'), 'React 19 evidence cannot imply a React 18 exemption');
  const renamed = structuredClone(event);
  renamed.sender.login = 'renamed-maintainer';
  assert.equal(resolve({ event: renamed }).accepted, true, 'immutable numeric ID, not the login label, authorizes the sender');
});

test('optional browser candidate hash is recorded exactly and rejects malformed identities', () => {
  const hash = 'c'.repeat(64);
  assert.equal(resolve({ event: changedDeclaration(value => { value.candidate_sha256 = hash; }) }).candidateSha256, hash);
  assert.equal(resolve().candidateSha256, null);
  for (const invalid of ['latest', 'c'.repeat(40), 'C'.repeat(64), null]) {
    assert.throws(() => resolve({ event: changedDeclaration(value => { value.candidate_sha256 = invalid; }) }), /SHA-256/);
  }
});

test('PR author identity and attacker-controlled declaration fields cannot authorize the sender', () => {
  const attacker = structuredClone(event);
  attacker.sender = { id: 99, login: 'outsider', type: 'User' };
  attacker.pull_request.user = event.sender;
  const result = resolve({ event: attacker });
  assert.equal(result.accepted, false);
  assert.equal(result.reasons[0].code, 'unauthorized-actor');
  assert.deepEqual(result.declarations, []);
  attacker.pull_request.body = '```ci-local-validation\nnot json\n```';
  assert.equal(resolve({ event: attacker }).accepted, false, 'untrusted malformed text cannot opt out or block normal CI');
  for (const type of ['Bot', 'Organization', undefined]) {
    assert.equal(resolve({ event: { ...event, sender: { ...event.sender, type } } }).accepted, false);
  }
});

test('new commits, changed bases and stale event snapshots invalidate the attestation', () => {
  for (const field of ['tested_commit', 'base_commit']) {
    const stale = changedDeclaration(value => { value[field] = 'c'.repeat(40); });
    const result = resolve({ event: stale });
    assert.equal(result.accepted, false);
    assert.equal(result.reasons[0].code, 'stale-declaration');
  }
  for (const part of ['head', 'base']) {
    const stale = structuredClone(event);
    stale.pull_request[part].sha = 'c'.repeat(40);
    assert.equal(resolve({ event: stale }).reasons[0].code, 'stale-event');
  }
  assert.throws(() => resolve({ head: 'main' }), /full commit/);
  assert.throws(() => resolve({ base: head.slice(0, 7) }), /full commit/);
});

test('repository, action and PR identity cannot be substituted', () => {
  const wrongRepo = structuredClone(event);
  wrongRepo.repository.full_name = 'outsider/fork';
  assert.equal(resolve({ event: wrongRepo }).reasons[0].code, 'repository-mismatch');
  wrongRepo.repository.full_name = repository;
  wrongRepo.pull_request.base.repo.full_name = 'outsider/fork';
  assert.equal(resolve({ event: wrongRepo }).accepted, false);
  for (const action of ['closed', 'labeled', 'created', undefined]) {
    assert.equal(resolve({ event: { ...event, action } }).reasons[0].code, 'unsupported-event');
  }
  for (const action of ['opened', 'reopened', 'edited', 'synchronize', 'ready_for_review']) {
    assert.equal(resolve({ event: { ...event, action } }).accepted, true);
  }
  assert.equal(resolve({ event: { ...event, pull_request: null } }).accepted, false);
  assert.equal(resolve({ event: { ...event, pull_request: { ...event.pull_request, number: 0 } } }).reasons[0].code, 'invalid-pr');
});

test('no declaration leaves normal CI intact; malformed or ambiguous authorized blocks fail closed', () => {
  for (const noBody of ['', null, 'Normal PR with no local validation']) {
    assert.equal(resolve({ event: { ...event, pull_request: { ...event.pull_request, body: noBody } } }).reasons[0].code, 'no-declaration');
  }
  for (const malformed of [
    '```ci-local-validation\n{',
    '```ci-local-validation\nnot JSON\n```',
    body(declaration) + body(declaration),
    body({ ...declaration, approved_by: 'NWYLZW' }),
    body({ ...declaration, schemaVersion: 2 }),
    body({ ...declaration, local_passed: [] }),
    body({ ...declaration, tested_commit: 'HEAD' }),
    body({ ...declaration, base_commit: 'b'.repeat(7) }),
    body(null),
  ]) {
    assert.throws(() => resolve({ event: { ...event, pull_request: { ...event.pull_request, body: malformed } } }));
  }
  const crlf = structuredClone(event);
  crlf.pull_request.body = body(declaration).replaceAll('\n', '\r\n');
  assert.equal(resolve({ event: crlf }).accepted, true);
});

test('group, exact environment, evidence and reason must match the configured policy', () => {
  const mutations = [
    value => { value.local_passed[0].group = 'component:all'; },
    value => { value.local_passed[0].group = '__proto__'; },
    value => { value.local_passed.push(value.local_passed[0]); },
    value => { value.local_passed[0].environments = ['node24-react18.3.1']; },
    value => { value.local_passed[0].environments = ['node24-react19.3.1', 'node24-react19.3.1']; },
    value => { value.local_passed[0].environments = []; },
    value => { value.local_passed[0].environments = 'node24-react19.3.1'; },
    value => { value.local_passed[0].reason = ''; },
    value => { value.local_passed[0].reason = '   '; },
    value => { value.local_passed[0].reason = 'first\nsecond'; },
    value => { value.local_passed[0].reason = 'x'.repeat(1001); },
    value => { value.local_passed[0].evidence = 'file:///tmp/results.json'; },
    value => { value.local_passed[0].evidence = 'javascript:alert(1)'; },
    value => { value.local_passed[0].evidence = 'https://token@example.invalid/report'; },
    value => { value.local_passed[0].evidence = 'https://example.invalid/not a url'; },
    value => { value.local_passed[0].evidence = null; },
    value => { value.local_passed[0].skip_all = true; },
  ];
  for (const mutate of mutations) assert.throws(() => resolve({ event: changedDeclaration(mutate) }));
  const multiple = changedDeclaration(value => value.local_passed.push({ ...value.local_passed[0], group: 'browser:log', environments: ['chromium-playwright1.64.1-react19.3.1'] }));
  assert.equal(resolve({ event: multiple }).declarations.length, 2);
});

test('invalid trusted policy cannot silently expand authorization', () => {
  for (const change of [
    value => { value.allowed_users[0].id = '51358815'; },
    value => { value.allowed_users.push(value.allowed_users[0]); },
    value => { value.allowed_groups['component:*'] = ['node24-react19.3.1']; },
    value => { value.allowed_groups['component:log'] = []; },
    value => { value.allowed_groups['component:log'] = ['any env']; },
    value => { value.schemaVersion = 2; },
    value => { value.all_users = true; },
  ]) {
    const changed = structuredClone(policy);
    change(changed);
    assert.throws(() => validateLocalValidationPolicy(changed));
  }
  assert.equal(resolve({ policy: { ...policy, allowed_users: [] } }).accepted, false);
});

test('optional browser mappings require eligible groups and exact unique script names', () => {
  const mapped = { ...policy, browser_groups: { 'browser:log': ['verify-log-refinement'] } };
  assert.equal(resolve({ policy: mapped }).accepted, true);
  for (const browser_groups of [
    [],
    { 'browser:unknown': ['verify-log-refinement'] },
    { 'component:log': ['verify-log-refinement'] },
    { 'browser:log': [] },
    { 'browser:log': ['verify-log-refinement', 'verify-log-refinement'] },
    { 'browser:log': ['verify-*'] },
    { 'browser:log': ['../verify-log-refinement'] },
  ]) assert.throws(() => resolve({ policy: { ...policy, browser_groups } }));
});

test('optional component mappings require eligible groups and exact unique portable test paths', () => {
  const mapped = { ...policy, component_groups: { 'component:log': ['packages/inkra/test/log.test.mjs', 'packages/inkra/test/log-refinement.test.mjs'] } };
  assert.equal(resolve({ policy: mapped }).accepted, true);
  for (const component_groups of [
    [],
    { 'component:unknown': ['packages/inkra/test/log.test.mjs'] },
    { 'browser:log': ['packages/inkra/test/log.test.mjs'] },
    { 'component:log': [] },
    { 'component:log': ['packages/inkra/test/log.test.mjs', 'packages/inkra/test/log.test.mjs'] },
    { 'component:log': ['packages/inkra/test/log*.test.mjs'] },
    { 'component:log': ['packages/inkra/test/../test/log.test.mjs'] },
    { 'component:log': ['scripts/test/local-validation.test.mjs'] },
  ]) assert.throws(() => resolve({ policy: { ...policy, component_groups } }));
});

test('human summary labels local attestation without claiming online passes or interpreting Markdown', () => {
  const result = resolve({ event: changedDeclaration(value => { value.local_passed[0].reason = '<b>Local | pass</b>'; }) });
  const summary = localValidationSummary(result);
  assert.match(summary, /locally tested \/ CI waived, not online test passes/);
  assert.match(summary, /&lt;b&gt;Local &#124; pass&lt;\/b&gt;/);
  assert(summary.includes(head) && summary.includes(base));
  assert.match(localValidationSummary(resolve({ event: { ...event, sender: { ...event.sender, id: 99 } } })), /Normal CI test selection remains in effect/);
});

test('CLI persists a machine-readable decision and refuses missing or malformed inputs', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'inkra-local-validation-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const eventPath = join(directory, 'event.json'), policyPath = join(directory, 'policy.json');
  const output = join(directory, 'nested', 'decision.json'), summary = join(directory, 'summary.md'), githubOutput = join(directory, 'output.txt');
  await writeFile(eventPath, JSON.stringify(event));
  await writeFile(policyPath, JSON.stringify(policy));
  const script = fileURLToPath(new URL('../local-validation.mjs', import.meta.url));
  const env = { ...process.env, GITHUB_EVENT_PATH: eventPath, POLICY_PATH: policyPath, REPOSITORY: repository, HEAD_SHA: head, BASE_SHA: base, OUTPUT_PATH: output, GITHUB_STEP_SUMMARY: summary, GITHUB_OUTPUT: githubOutput };
  execFileSync(process.execPath, [script], { env, stdio: 'pipe' });
  assert.equal(JSON.parse(await readFile(output, 'utf8')).accepted, true);
  assert.match(await readFile(summary, 'utf8'), /accepted maintainer attestation/);
  assert.equal(await readFile(githubOutput, 'utf8'), 'accepted=true\n');
  assert.notEqual(spawnSync(process.execPath, [script], { env: { ...env, HEAD_SHA: '' }, stdio: 'pipe' }).status, 0);
  const malformed = structuredClone(event);
  malformed.pull_request.body = '```ci-local-validation\nnot JSON\n```';
  await writeFile(eventPath, JSON.stringify(malformed));
  assert.notEqual(spawnSync(process.execPath, [script], { env, stdio: 'pipe' }).status, 0);
});
