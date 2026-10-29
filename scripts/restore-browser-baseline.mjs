import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFile, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const repository = 'inkrajs/inkra';
export const workflowPath = '.github/workflows/publish.yml';
export const artifactName = 'release-browser-reuse';
const maxAge = 90 * 24 * 60 * 60 * 1000;
const sha = /^[0-9a-f]{40}$/;
const positive = value => Number.isSafeInteger(value) && value > 0;
const digest = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

export function validateBaselineSource(run, artifact, { currentRunId, now = Date.now() } = {}) {
  assert(positive(run.id) && run.id !== currentRunId, 'Baseline must come from a previous workflow run');
  assert.equal(run.repository?.full_name, repository, 'Unexpected workflow repository');
  assert.equal(run.head_repository?.full_name, repository, 'Fork results cannot seed release reuse');
  assert.equal(run.path, workflowPath, 'Unexpected baseline workflow');
  assert.equal(run.event, 'workflow_dispatch', 'PR workflows cannot seed release reuse');
  assert.equal(run.status, 'completed', 'Baseline workflow has not completed');
  assert.equal(run.conclusion, 'success', 'Only successful workflows can seed release reuse');
  assert(sha.test(run.head_sha) && positive(run.run_attempt), 'Invalid workflow source identity');
  const timestamp = Date.parse(run.updated_at);
  assert(Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= maxAge, 'Baseline workflow is expired');
  assert.equal(artifact.name, artifactName, 'Unexpected baseline artifact');
  assert(positive(artifact.id) && artifact.expired === false, 'Baseline artifact is unavailable');
  assert(/^sha256:[0-9a-f]{64}$/.test(artifact.digest), 'Baseline artifact has no immutable SHA-256');
  assert.equal(artifact.workflow_run?.id, run.id, 'Artifact workflow mismatch');
  assert.equal(artifact.workflow_run?.head_sha, run.head_sha, 'Artifact source mismatch');
}

export async function restoreBrowserBaseline({ api, download, readReceipt, isAncestor, currentHead, currentRunId, now = Date.now() }) {
  assert(sha.test(currentHead), 'Current release source must be an exact commit');
  const miss = reason => ({ schemaVersion: 1, trusted: false, reason });
  // Never let a PR or an unmerged release branch establish reusable evidence.
  if (!(await isAncestor(currentHead, 'origin/main'))) return miss('Current source is not on origin/main');
  const reasons = [];
  let inspected = 0;
  for (let page = 1; page <= 3; page++) {
    const listed = await api(`/repos/${repository}/actions/workflows/publish.yml/runs?status=success&event=workflow_dispatch&per_page=100&page=${page}`);
    assert(Array.isArray(listed.workflow_runs), 'Malformed workflow listing');
    for (const candidate of listed.workflow_runs) {
      if (candidate.id === currentRunId) continue;
      if (++inspected > 20) return miss(reasons.at(-1) || 'No compatible baseline in the latest 20 successful release runs');
      if (now - Date.parse(candidate.updated_at) > maxAge) return miss(reasons.at(-1) || 'No recent compatible baseline');
      try {
        if (!positive(candidate.id) || !sha.test(candidate.head_sha ?? '') || !(await isAncestor(candidate.head_sha, currentHead))) continue;
        const artifacts = await api(`/repos/${repository}/actions/runs/${candidate.id}/artifacts?per_page=100`);
        assert(Array.isArray(artifacts.artifacts), 'Malformed artifact listing');
        const matches = artifacts.artifacts.filter(item => item.name === artifactName);
        if (matches.length !== 1) continue;
        const artifact = matches[0];
        // Re-fetch metadata instead of trusting a possibly stale listing snapshot.
        const run = await api(`/repos/${repository}/actions/runs/${candidate.id}`);
        validateBaselineSource(run, artifact, { currentRunId, now });
        const archive = await download(`/repos/${repository}/actions/artifacts/${artifact.id}/zip`);
        assert.equal(digest(archive), artifact.digest, 'Downloaded baseline archive digest mismatch');
        const receipt = await readReceipt(archive);
        assert.equal(receipt.schemaVersion, 1, 'Unsupported baseline receipt');
        assert.equal(receipt.kind, 'inkra-browser-reuse', 'Unexpected baseline receipt kind');
        assert.equal(receipt.repository, repository, 'Receipt repository mismatch');
        assert.equal(receipt.runId, run.id, 'Receipt run mismatch');
        assert.equal(receipt.runAttempt, run.run_attempt, 'Receipt run attempt mismatch');
        assert.equal(receipt.headSha, run.head_sha, 'Receipt source mismatch');
        return { schemaVersion: 1, trusted: true, origin: {
          repository, runId: run.id, runAttempt: run.run_attempt, headSha: run.head_sha,
          artifactId: artifact.id, artifactDigest: artifact.digest, workflowPath,
        }, receipt };
      } catch (error) {
        // Unavailable/expired/invalid evidence grants no exemption. Continue to an older baseline.
        reasons.push(error.message);
      }
    }
    if (listed.workflow_runs.length < 100) break;
  }
  return miss(reasons.at(-1) || 'No successful release has a reusable browser receipt yet');
}

async function unzipReceipt(archive) {
  const directory = await mkdtemp(join(tmpdir(), 'inkra-browser-baseline-'));
  try {
    const path = join(directory, 'baseline.zip');
    await writeFile(path, archive);
    const files = execFileSync('unzip', ['-Z1', path], { encoding: 'utf8', maxBuffer: 65536 }).trim().split('\n');
    assert.deepEqual(files, ['browser-reuse-receipt.json'], 'Baseline ZIP must contain only its receipt');
    const json = execFileSync('unzip', ['-p', path, 'browser-reuse-receipt.json'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    return JSON.parse(json);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export function githubBaselineClient(token, request = fetch) {
  assert(token, 'A read-only GitHub token is required');
  const get = async path => {
    assert(path.startsWith(`/repos/${repository}/actions/`), 'Unexpected GitHub API path');
    const response = await request('https://api.github.com' + path, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
      redirect: 'manual', signal: AbortSignal.timeout(30000),
    });
    if (!response.ok && response.status !== 302) throw Error(`Baseline GitHub API HTTP ${response.status}`);
    return response;
  };
  return {
    api: async path => (await get(path)).json(),
    download: async path => {
      const redirect = await get(path);
      assert.equal(redirect.status, 302, 'Artifact API must return a signed download URL');
      const location = new URL(redirect.headers.get('location'));
      assert(location.protocol === 'https:' && !location.username && !location.password, 'Unsafe artifact URL');
      // The GitHub token must never accompany the storage download.
      const response = await request(location.href, { redirect: 'error', signal: AbortSignal.timeout(30000) });
      assert(response.ok, `Baseline storage HTTP ${response.status}`);
      const chunks = [];
      let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.length;
        assert(bytes <= 8 * 1024 * 1024, 'Baseline archive is too large');
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    },
  };
}

async function main() {
  const output = resolve(process.env.BROWSER_BASELINE_OUTPUT || '.consumer/.ci-plan/browser-baseline.json');
  let result;
  try {
    assert.equal(process.env.GITHUB_REPOSITORY, repository, 'Release reuse is restricted to the source repository');
    const client = githubBaselineClient(process.env.GH_TOKEN);
    result = await restoreBrowserBaseline({ ...client, readReceipt: unzipReceipt,
      currentHead: process.env.GITHUB_SHA, currentRunId: Number(process.env.GITHUB_RUN_ID),
      isAncestor: (ancestor, descendant) => sha.test(ancestor ?? '')
        && (sha.test(descendant ?? '') || descendant === 'origin/main')
        && spawnSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { stdio: 'ignore' }).status === 0,
    });
  } catch (error) { result = { schemaVersion: 1, trusted: false, reason: error.message }; }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  const message = result.trusted
    ? `Restored browser baseline from https://github.com/${repository}/actions/runs/${result.origin.runId}; per-check inputs must still match.`
    : `No browser history reused: ${result.reason}. Normal coverage remains enabled.`;
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Browser history baseline\n\n${message}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
