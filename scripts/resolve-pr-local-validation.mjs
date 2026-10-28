import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localValidationSummary, resolveLocalValidation } from './local-validation.mjs';

const sha = /^[0-9a-f]{40}$/;
const query = `query LocalValidation($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){number url body headRefOid baseRefOid baseRefName merged updatedAt lastEditedAt mergeCommit{oid} author{login ... on User{databaseId}} editor{login ... on User{databaseId}}}}}`;

export function githubRequest(token, request = fetch) {
  assert(typeof token === 'string' && token.length > 0, 'A read-only GitHub API token is required');
  return async (path, { method = 'GET', body } = {}) => {
    assert(path === '/graphql' || /^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\//.test(path), 'Only GitHub API paths are allowed');
    const response = await request('https://api.github.com' + path, {
      method, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'x-github-api-version': '2022-11-28' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'error', signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const error = new Error(`GitHub API request failed with HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    const result = await response.json();
    assert(!result.errors, 'GitHub GraphQL could not resolve the validation inputs');
    return result;
  };
}

export async function resolveForCommit({ request, repository, target, prNumber, expectedHead, expectedBase, expectedCandidateSha256 }) {
  assert(typeof request === 'function', 'A GitHub API request implementation is required');
  assert(typeof repository === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository), 'An exact repository is required');
  assert(sha.test(target ?? ''), 'TARGET_SHA must be a full commit SHA');
  assert((expectedHead === undefined) === (expectedBase === undefined), 'Expected PR head and base must be supplied together');
  if (expectedHead !== undefined) assert(sha.test(expectedHead) && sha.test(expectedBase), 'Expected PR head and base must be full commit SHAs');
  if (expectedCandidateSha256 !== undefined) assert(/^[0-9a-f]{64}$/.test(expectedCandidateSha256), 'Expected candidate must be an exact SHA-256');
  const empty = (code, detail, extra = {}) => ({ schemaVersion: 1, repository, head: target, base: null, actor: null,
    prNumber: null, targetRevision: target, declarations: [], accepted: false, reasons: [{ code, detail }], ...extra });
  if (prNumber === undefined) {
    const associated = await request(`/repos/${repository}/commits/${target}/pulls?per_page=100`);
    assert(Array.isArray(associated), 'Invalid associated pull request response');
    const matches = associated.filter(pr => (pr.state === 'open' && pr.head?.sha === target)
      || (pr.merged_at && pr.merge_commit_sha === target));
    if (!matches.length) return empty('no-associated-pr', 'No current head or merged PR matches this target commit');
    if (matches.length !== 1) return empty('ambiguous-associated-pr', 'Multiple PR declarations could apply; select an exact PR number');
    prNumber = matches[0].number;
  }
  assert(Number.isSafeInteger(prNumber) && prNumber > 0, 'PR_NUMBER must be a positive integer');
  const [owner, name] = repository.split('/');
  const data = await request('/graphql', { method: 'POST', body: { query, variables: { owner, name, number: prNumber } } });
  assert(!data.errors, 'GitHub GraphQL returned an error');
  const pr = data.data?.repository?.pullRequest;
  assert(pr && pr.number === prNumber && sha.test(pr.headRefOid) && sha.test(pr.baseRefOid), 'GitHub did not return the exact PR identity');
  const metadata = { prNumber, head: pr.headRefOid, base: pr.baseRefOid, prUrl: pr.url, bodyUpdatedAt: pr.lastEditedAt ?? null };
  if (expectedHead !== undefined && (pr.headRefOid !== expectedHead || pr.baseRefOid !== expectedBase)) {
    return empty('stale-pr-snapshot', 'The live PR head or base changed after this workflow event', metadata);
  }
  let policy;
  try {
    const file = await request(`/repos/${repository}/contents/.github/local-validation-policy.json?ref=${pr.baseRefOid}`);
    assert(file.encoding === 'base64' && typeof file.content === 'string', 'Invalid trusted base policy response');
    policy = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
  } catch (error) {
    if (error.status === 404) return empty('policy-not-installed', 'The PR base has no local-validation policy; normal tests remain required', metadata);
    throw error;
  }
  // An edited body with a deleted/unavailable editor must not inherit the
  // original author's authority. Only an unedited body may use its author.
  const editor = pr.editor ?? (pr.lastEditedAt ? null : pr.author);
  const result = resolveLocalValidation({ policy, repository, head: pr.headRefOid, base: pr.baseRefOid, event: {
    action: 'opened', repository: { full_name: repository },
    sender: { id: editor?.databaseId, login: editor?.login, type: Number.isSafeInteger(editor?.databaseId) ? 'User' : 'Bot' },
    pull_request: { number: prNumber, body: pr.body, head: { sha: pr.headRefOid }, base: { sha: pr.baseRefOid, repo: { full_name: repository } } },
  } });
  const receipt = { ...result, ...metadata, targetRevision: target,
    browserGroups: policy.browser_groups ?? {}, componentGroups: policy.component_groups ?? {} };
  if (!receipt.accepted) return receipt;
  const targetCommit = await request(`/repos/${repository}/git/commits/${target}`);
  const headCommit = target === pr.headRefOid ? targetCommit : await request(`/repos/${repository}/git/commits/${pr.headRefOid}`);
  assert(targetCommit.sha === target && headCommit.sha === pr.headRefOid && sha.test(targetCommit.tree?.sha) && sha.test(headCommit.tree?.sha), 'Invalid Git tree identity');
  const mergePreview = expectedHead !== undefined && Array.isArray(targetCommit.parents)
    && targetCommit.parents.length === 2
    && targetCommit.parents.some(parent => parent.sha === expectedHead)
    && targetCommit.parents.some(parent => parent.sha === expectedBase);
  const matchedTarget = target === pr.headRefOid || (pr.merged && target === pr.mergeCommit?.oid) || mergePreview;
  receipt.targetTree = targetCommit.tree.sha;
  receipt.headTree = headCommit.tree.sha;
  if (!matchedTarget || receipt.targetTree !== receipt.headTree) return { ...receipt, accepted: false, declarations: [],
    reasons: [{ code: 'different-tested-tree', detail: 'The actual target must be this PR head, its exact merge, or its verified merge preview, with the same Git tree as the locally tested head' }] };
  if (receipt.declarations.some(entry => entry.group.startsWith('browser:'))
    && (!expectedCandidateSha256 || receipt.candidateSha256 !== expectedCandidateSha256)) {
    receipt.declarations = receipt.declarations.filter(entry => !entry.group.startsWith('browser:'));
    receipt.accepted = receipt.declarations.length > 0;
    receipt.reasons = [...receipt.reasons, { code: 'candidate-not-confirmed', detail: 'Browser exemptions require the exact current candidate archive SHA-256; component declarations are evaluated independently' }];
  }
  return receipt;
}

async function main() {
  const env = process.env;
  const receipt = await resolveForCommit({ request: githubRequest(env.GH_TOKEN || env.GITHUB_TOKEN),
    repository: env.REPOSITORY || env.GITHUB_REPOSITORY, target: env.TARGET_SHA || env.GITHUB_SHA,
    ...(env.PR_NUMBER ? { prNumber: Number(env.PR_NUMBER) } : {}),
    ...(env.HEAD_SHA || env.BASE_SHA ? { expectedHead: env.HEAD_SHA, expectedBase: env.BASE_SHA } : {}),
    ...(env.EXPECTED_CANDIDATE_SHA256 ? { expectedCandidateSha256: env.EXPECTED_CANDIDATE_SHA256 } : {}),
  });
  const output = env.OUTPUT_PATH || '.release/local-validation.json';
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
  const summary = localValidationSummary(receipt);
  if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, summary);
  if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, `accepted=${receipt.accepted}\n`);
  console.log(summary);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
