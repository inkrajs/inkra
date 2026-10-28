import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sha = /^[0-9a-f]{40}$/;
const groupName = /^(?:component|browser):[a-z0-9]+(?:-[a-z0-9]+)*$/;
const environmentName = /^[a-z0-9][a-z0-9.-]{0,95}$/;
const actions = new Set(['opened', 'reopened', 'edited', 'synchronize', 'ready_for_review']);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function keys(value, allowed, context) {
  assert(object(value), `${context} must be an object`);
  assert(Object.keys(value).every(key => allowed.includes(key)), `${context} has unsupported fields`);
}

export function validateLocalValidationPolicy(policy) {
  keys(policy, ['schemaVersion', 'allowed_users', 'allowed_groups', 'browser_groups', 'component_groups'], 'Local validation policy');
  assert.equal(policy.schemaVersion, 1, 'Unsupported local validation policy schema');
  assert(Array.isArray(policy.allowed_users), 'Policy allowed_users must be an array');
  const identities = new Set();
  for (const user of policy.allowed_users) {
    keys(user, ['id', 'login'], 'Policy user');
    assert(Number.isSafeInteger(user.id) && user.id > 0, 'Policy users require immutable numeric GitHub IDs');
    assert(typeof user.login === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(user.login), 'Invalid policy login label');
    assert(!identities.has(user.id), 'Duplicate policy user');
    identities.add(user.id);
  }
  assert(object(policy.allowed_groups), 'Policy allowed_groups must be an object');
  for (const [group, environments] of Object.entries(policy.allowed_groups)) {
    assert(groupName.test(group), `Invalid policy test group: ${group}`);
    assert(Array.isArray(environments) && environments.length > 0, `Policy group ${group} requires exact environments`);
    assert(environments.every(value => typeof value === 'string' && environmentName.test(value)), `Invalid environment for ${group}`);
    assert.equal(new Set(environments).size, environments.length, `Duplicate policy environment for ${group}`);
  }
  if (policy.browser_groups !== undefined) {
    assert(object(policy.browser_groups), 'Policy browser_groups must be an object');
    for (const [group, scripts] of Object.entries(policy.browser_groups)) {
      assert(group.startsWith('browser:') && Object.hasOwn(policy.allowed_groups, group), `Browser mapping must reference an eligible browser group: ${group}`);
      assert(Array.isArray(scripts) && scripts.length > 0, `Browser mapping ${group} requires exact test scripts`);
      assert(scripts.every(script => typeof script === 'string' && /^verify-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(script)), `Invalid browser script for ${group}`);
      assert.equal(new Set(scripts).size, scripts.length, `Duplicate browser script for ${group}`);
    }
  }
  if (policy.component_groups !== undefined) {
    assert(object(policy.component_groups), 'Policy component_groups must be an object');
    for (const [group, tests] of Object.entries(policy.component_groups)) {
      assert(group.startsWith('component:') && Object.hasOwn(policy.allowed_groups, group), `Component mapping must reference an eligible component group: ${group}`);
      assert(Array.isArray(tests) && tests.length > 0, `Component mapping ${group} requires exact test paths`);
      assert(tests.every(path => typeof path === 'string' && /^packages\/inkra\/test\/[a-z0-9]+(?:-[a-z0-9]+)*\.test\.mjs$/.test(path)), `Invalid component test path for ${group}`);
      assert.equal(new Set(tests).size, tests.length, `Duplicate component test path for ${group}`);
    }
  }
  return policy;
}

function parseBody(body) {
  assert(typeof body === 'string' && body.length <= 65536, 'PR description is too large');
  const markers = [...body.matchAll(/^```ci-local-validation(?:[ \t]|\r?$)/gm)];
  if (!markers.length) return null;
  assert.equal(markers.length, 1, 'Use exactly one ci-local-validation block');
  const blocks = [...body.matchAll(/^```ci-local-validation[ \t]*\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)];
  assert.equal(blocks.length, 1, 'Local validation declaration requires a closed fenced JSON block');
  let declaration;
  try { declaration = JSON.parse(blocks[0][1]); }
  catch { throw new Error('Local validation declaration must contain valid JSON'); }
  keys(declaration, ['schemaVersion', 'tested_commit', 'base_commit', 'candidate_sha256', 'local_passed'], 'Local validation declaration');
  assert.equal(declaration.schemaVersion, 1, 'Unsupported local validation declaration schema');
  assert(sha.test(declaration.tested_commit ?? ''), 'tested_commit must be a full lowercase commit SHA');
  assert(sha.test(declaration.base_commit ?? ''), 'base_commit must be a full lowercase commit SHA');
  if (declaration.candidate_sha256 !== undefined) assert(/^[0-9a-f]{64}$/.test(declaration.candidate_sha256), 'candidate_sha256 must be a full lowercase SHA-256');
  assert(Array.isArray(declaration.local_passed) && declaration.local_passed.length > 0 && declaration.local_passed.length <= 100,
    'local_passed must declare between 1 and 100 test groups');
  return declaration;
}

/** Resolve a trusted maintainer's declaration, not an independent proof of local execution.
 * Callers must load this code and policy from the trusted PR base and recheck the
 * live PR head/base/body before consuming its output. The authorization sender
 * must be the authenticated current body editor (or author for an unedited body),
 * resolved by the trusted workflow, rather than merely the PR creator or pusher.
 * No PR text is executed.
 */
export function resolveLocalValidation({ event, policy, repository, head, base }) {
  validateLocalValidationPolicy(policy);
  assert(typeof repository === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository), 'An exact repository is required');
  assert(sha.test(head ?? '') && sha.test(base ?? ''), 'Expected head and base must be full commit SHAs');
  const actor = Number.isSafeInteger(event?.sender?.id) && typeof event.sender.login === 'string'
    ? { id: event.sender.id, login: event.sender.login } : null;
  const result = {
    schemaVersion: 1, repository, head, base, prNumber: event?.pull_request?.number ?? null,
    actor, policyDigest: digest(policy), declarations: [], accepted: false, reasons: [],
  };
  const reject = (code, detail) => ({ ...result, reasons: [{ code, detail }] });
  if (!event?.pull_request || !actions.has(event.action)) return reject('unsupported-event', 'Only supported pull_request events can authorize local validation');
  if (event.repository?.full_name !== repository || event.pull_request.base?.repo?.full_name !== repository) {
    return reject('repository-mismatch', 'The event and PR base must belong to this repository');
  }
  if (!Number.isSafeInteger(result.prNumber) || result.prNumber < 1) return reject('invalid-pr', 'A valid pull request number is required');
  if (!actor || event.sender.type !== 'User' || !policy.allowed_users.some(user => user.id === actor.id)) {
    return reject('unauthorized-actor', 'The event sender is not an authorized local-validation maintainer');
  }
  if (event.pull_request.head?.sha !== head || event.pull_request.base.sha !== base) {
    return reject('stale-event', 'The event no longer represents the current PR head and base');
  }
  const declaration = parseBody(event.pull_request.body ?? '');
  if (!declaration) return reject('no-declaration', 'No local-validation declaration was supplied');
  if (declaration.tested_commit !== head || declaration.base_commit !== base) {
    return reject('stale-declaration', 'Local validation must be repeated or explicitly attested for the current head and base');
  }
  const groups = new Set();
  const declarations = declaration.local_passed.map(entry => {
    keys(entry, ['group', 'environments', 'evidence', 'reason'], 'Local test result');
    assert(typeof entry.group === 'string' && Object.hasOwn(policy.allowed_groups, entry.group), `Test group is not eligible for local validation: ${entry.group}`);
    assert(!groups.has(entry.group), `Duplicate declared test group: ${entry.group}`);
    groups.add(entry.group);
    assert(Array.isArray(entry.environments) && entry.environments.length > 0, `Declare exact tested environments for ${entry.group}`);
    assert.equal(new Set(entry.environments).size, entry.environments.length, `Duplicate declared environment for ${entry.group}`);
    assert(entry.environments.every(environment => policy.allowed_groups[entry.group].includes(environment)), `Unsupported environment for ${entry.group}`);
    assert(typeof entry.reason === 'string' && entry.reason.trim().length > 0 && entry.reason.length <= 1000 && !/[\u0000-\u001f\u007f]/.test(entry.reason), 'Each test group requires a single-line reason');
    assert(typeof entry.evidence === 'string' && entry.evidence.length <= 2048, 'Each test group requires an evidence URL');
    let url;
    try { url = new URL(entry.evidence); } catch { throw new Error('Evidence must be an HTTP(S) report URL'); }
    assert(['https:', 'http:'].includes(url.protocol) && url.hostname && !url.username && !url.password && !/[\u0000-\u0020\u007f]/.test(entry.evidence), 'Evidence must be an HTTP(S) report URL without credentials');
    return { group: entry.group, environments: [...entry.environments], evidence: entry.evidence, reason: entry.reason.trim() };
  });
  return { ...result, accepted: true, declarations, candidateSha256: declaration.candidate_sha256 ?? null,
    declarationDigest: digest(declaration), reasons: [{ code: 'trusted-local-validation', detail: 'An authorized maintainer attested local results for this exact PR head and base' }] };
}

function escapeMarkdown(value) {
  return String(value).replace(/[&<>|`\r\n]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '|': '&#124;', '`': '&#96;', '\r': ' ', '\n': ' ' })[character]);
}

export function localValidationSummary(result) {
  const rows = result.declarations.map(entry => `| ${escapeMarkdown(entry.group)} | ${entry.environments.map(escapeMarkdown).join(', ')} | ${escapeMarkdown(entry.reason)} | ${escapeMarkdown(entry.evidence)} |`);
  return `### Local validation declaration\n\n`
    + `- Decision: **${result.accepted ? 'accepted maintainer attestation' : 'no exemption'}**\n`
    + `- Repository: ${escapeMarkdown(result.repository)}\n`
    + `- PR head: \`${result.head}\`\n- PR base: \`${result.base}\`\n`
    + `- Event sender: ${result.actor ? escapeMarkdown(result.actor.login) + ' (ID ' + result.actor.id + ')' : 'unavailable'}\n`
    + result.reasons.map(reason => `- ${escapeMarkdown(reason.code)}: ${escapeMarkdown(reason.detail)}\n`).join('')
    + '\nAccepted groups are locally tested / CI waived, not online test passes. Only matching environments may use the declaration.\n\n'
    + (rows.length ? '| Group | Environments | Reason | Evidence |\n| --- | --- | --- | --- |\n' + rows.join('\n') + '\n' : 'Normal CI test selection remains in effect.\n');
}

async function main() {
  const env = process.env;
  assert(env.GITHUB_EVENT_PATH && env.POLICY_PATH && env.REPOSITORY && env.HEAD_SHA && env.BASE_SHA && env.OUTPUT_PATH,
    'Set GITHUB_EVENT_PATH, POLICY_PATH, REPOSITORY, HEAD_SHA, BASE_SHA and OUTPUT_PATH');
  const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'));
  const policy = JSON.parse(await readFile(env.POLICY_PATH, 'utf8'));
  const result = resolveLocalValidation({ event, policy, repository: env.REPOSITORY, head: env.HEAD_SHA, base: env.BASE_SHA });
  await mkdir(dirname(resolve(env.OUTPUT_PATH)), { recursive: true });
  await writeFile(env.OUTPUT_PATH, JSON.stringify(result, null, 2) + '\n');
  const summary = localValidationSummary(result);
  if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, summary);
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, `accepted=${result.accepted}\n`);
  console.log(summary);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
