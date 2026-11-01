import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveLocalValidation } from './local-validation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = /^[0-9a-f]{40}$/;
const repos = { library: 'inkrajs/inkra', docs: 'inkrajs/docs', website: 'inkrajs/inkrajs.github.io' };
const expectedChecks = {
  library: ['Resolve trusted local tests', 'Node 22 / React 18.3.1', 'Node 24 / React 19.3.1'],
  docs: ['Resolve trusted local tests', 'build', 'docs'], website: [],
};
const passed = new Set(['SUCCESS', 'SKIPPED', 'NEUTRAL']);
const failed = new Set(['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pause = ms => new Promise(done => setTimeout(done, ms));
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const atomic = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path + '.tmp', JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await rename(path + '.tmp', path);
};
function fields(value, allowed, name) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
  assert(Object.keys(value).every(key => allowed.includes(key)), `Unknown ${name} option`);
}

export function normalizePlan(input, base = root) {
  fields(input, ['schemaVersion', 'id', 'title', 'library', 'docs', 'website', 'livePaths', 'pollSeconds', 'timeoutMinutes'], 'plan');
  assert.equal(input.schemaVersion, 1, 'Unsupported ship plan version');
  assert(/^[a-z0-9][a-z0-9-]{0,63}$/.test(input.id || ''), 'Use a stable lowercase run id');
  assert(typeof input.title === 'string' && input.title.trim() && input.title.length <= 150 && !/[\r\n]/.test(input.title), 'A short reviewable release title is required');
  const result = { ...input };
  for (const [name, fallback] of Object.entries({ library: '.', docs: 'apps/docs', website: '../inkra-website' })) {
    const value = input[name] || {};
    fields(value, name === 'website' ? ['directory'] : ['directory', 'ref', 'localValidation'], name);
    assert(value.ref === undefined || (typeof value.ref === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value.ref)), `Invalid ${name} ref`);
    result[name] = { ...value, directory: resolve(base, value.directory || fallback) };
    if (value.localValidation !== undefined) {
      assert(typeof value.localValidation === 'string' && value.localValidation.length > 0, 'localValidation must name an existing report file');
      result[name].localValidation = resolve(base, value.localValidation);
    }
  }
  result.docs.ref ||= 'HEAD';
  result.pollSeconds = input.pollSeconds ?? 15;
  result.timeoutMinutes = input.timeoutMinutes ?? 45;
  assert(Number.isFinite(result.pollSeconds) && result.pollSeconds >= 2 && result.pollSeconds <= 60, 'pollSeconds must be 2..60');
  assert(Number.isFinite(result.timeoutMinutes) && result.timeoutMinutes >= 1 && result.timeoutMinutes <= 90, 'timeoutMinutes must be 1..90');
  result.livePaths = [...new Set(['/', '/docs/getting-started', ...(input.livePaths || [])])];
  assert(result.livePaths.every(path => typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && !/[\r\n]/.test(path)
    && new URL(path, 'https://inkrajs.github.io').origin === 'https://inkrajs.github.io'), 'Live paths must stay on the Inkra website');
  return result;
}

export function processRunner(command, args, { cwd, env, input, allow = [0], log, stderrFallback = false, timeoutMs = command === 'npm' ? 1200000 : 60000 } = {}) {
  assert(Number.isFinite(timeoutMs) && timeoutMs > 0, 'Command timeout must be positive');
  return new Promise((done, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, shell: false, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', errors = '', expired = false;
    const timer = setTimeout(() => {
      expired = true;
      try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM'); else child.kill('SIGTERM'); } catch {}
    }, timeoutMs);
    timer.unref();
    child.stdout.on('data', bytes => { output += bytes; });
    child.stderr.on('data', bytes => { errors += bytes; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
    child.on('close', async code => {
      clearTimeout(timer);
      try {
        if (log) await appendFile(log, output + errors);
        assert(!expired, `${command} timed out${log ? `; see ${log}` : ''}`);
        assert(allow.includes(code), `${command} exited ${code}${log ? `; see ${log}` : `: ${(output + errors).slice(-1200)}`}`);
        done((output || (stderrFallback ? errors : '')).trim());
      } catch (error) { reject(error); }
    });
  });
}

export async function acquireLock(path) {
  await mkdir(dirname(path), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const file = await open(path, 'wx', 0o600);
      await file.writeFile(JSON.stringify({ pid: process.pid })); await file.close();
      return async () => { await unlink(path); };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = await json(path);
      assert(Number.isSafeInteger(owner.pid) && owner.pid > 0, 'Unrecognized publication lock; inspect it manually');
      try { process.kill(owner.pid, 0); throw new Error('Another publication process is running'); }
      catch (probe) { if (probe.code !== 'ESRCH') throw probe; }
      await unlink(path); // Only recover a lock whose local owner no longer exists.
    }
  }
  throw new Error('Could not acquire publication lock');
}

export async function waitForChecks({ read, required, sleep = pause, now = Date.now, timeoutMs, intervalMs }) {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    const checks = await read();
    const bad = checks.find(check => failed.has(check.state));
    assert(!bad, `CI failed: ${bad?.name}; ${bad?.link || ''}`);
    if (required.every(name => checks.some(check => check.name === name && check.state === 'SUCCESS'))
        && checks.length && checks.every(check => passed.has(check.state))) return checks;
    await sleep(Math.min(intervalMs, Math.max(0, deadline - now())));
  }
  throw new Error('CI wait timed out; resume the same run after inspecting its status');
}

export function checkPull(pr, { head, base, branch, merged = false }) {
  assert.equal(pr.head.sha, head, 'PR head changed; stop and review');
  assert.equal(pr.head.ref, branch, 'Unexpected PR branch');
  if (!pr.merged || !merged) assert.equal(pr.base.sha, base, 'PR base changed; refresh validation before merging');
  assert(pr.state === 'open' || pr.merged, 'PR was closed without merging');
}

export async function verifyCandidate(path, manifest) {
  assert.equal(manifest.name, '@inkra/react', 'Unexpected candidate package');
  assert.equal(manifest.filename, `inkra-react-${manifest.version}.tgz`, 'Unexpected candidate archive');
  assert(sha.test(manifest.commit || ''), 'Candidate must name an exact source commit');
  assert(/^[a-zA-Z0-9.-]+\.tgz$/.test(manifest.filename || ''), 'Invalid candidate archive name');
  const bytes = await readFile(resolve(path, manifest.filename));
  assert.equal(hash(bytes), manifest.sha256, 'Candidate archive checksum changed');
  assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), manifest.integrity, 'Candidate archive integrity changed');
}

export function verifyDocsPackage(sourcePackage, currentPackage, allowLocalPin) {
  const expected = structuredClone(sourcePackage);
  const dependency = currentPackage.dependencies?.['@inkra/react'];
  assert(dependency === sourcePackage.dependencies?.['@inkra/react'] || (allowLocalPin && dependency === 'file:vendor/inkra.tgz'), 'Unexpected docs library dependency');
  expected.dependencies['@inkra/react'] = dependency;
  assert.deepEqual(currentPackage, expected, 'Docs package changes exceed the selected library pin');
}

export function verifyDocsPin(sourcePackage, currentPackage, currentCandidate, manifest, librarySource) {
  verifyDocsPackage(sourcePackage, currentPackage, Boolean(librarySource));
  if (librarySource) {
    assert.equal(currentPackage.dependencies['@inkra/react'], 'file:vendor/inkra.tgz', 'Local candidate must be installed from its archive');
    for (const [field, value] of Object.entries({ name: manifest.name, version: manifest.version, revision: librarySource, sha256: manifest.sha256, integrity: manifest.integrity })) {
      assert.equal(currentCandidate[field], value, `Prepared docs candidate ${field} changed`);
    }
  } else assert.deepEqual(currentCandidate, manifest, 'Registry source metadata changed');
}

export async function ship(input, { execute = false, until, run = processRunner, sleep = pause, request = fetch, base = root, print = console.log } = {}) {
  const plan = normalizePlan(input, base);
  const directory = resolve(base, '.release/ship', plan.id);
  const statePath = resolve(directory, 'state.json');
  const digest = hash(JSON.stringify(plan));
  let state = existsSync(statePath) ? await json(statePath) : null;
  if (state) assert.equal(state.planDigest, digest, 'Plan changed; use a new run id');
  const git = (name, args, options = {}) => run('git', args, { cwd: plan[name].directory, ...options });
  const api = async (path, body) => JSON.parse(await run('gh', ['api', path, ...(body ? ['--method', 'POST', '--input', '-'] : [])], { input: body ? JSON.stringify(body) : undefined }));
  const get = async path => {
    for (let attempt = 0; ; attempt++) {
      try { return await api(path); }
      catch (error) { if (attempt === 2) throw error; await sleep(1000 * 2 ** attempt); }
    }
  };
  const resolveRef = async (name, ref) => {
    const value = await git(name, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]);
    assert(sha.test(value), 'Expected an exact source commit'); return value;
  };
  for (const name of ['library', 'docs', 'website']) {
    const remote = await git(name, ['remote', 'get-url', 'origin']);
    assert([`https://github.com/${repos[name]}.git`, `git@github.com:${repos[name]}.git`, `https://github.com/${repos[name]}`, `git@github.com:${repos[name]}`].includes(remote), `Wrong ${name} repository`);
  }
  if (!state) {
    const docs = await resolveRef('docs', plan.docs.ref);
    const pinned = JSON.parse(await git('docs', ['show', `${docs}:library-candidate.json`]));
    const library = plan.library.ref ? await resolveRef('library', plan.library.ref)
      : pinned.source === 'registry' ? null : await resolveRef('library', pinned.revision);
    state = { schemaVersion: 1, planDigest: digest, id: plan.id, sources: { docs, library }, done: {}, pullRequests: {}, startedAt: new Date().toISOString() };
  }
  const dirty = {};
  for (const name of ['library', 'docs', 'website']) dirty[name] = Boolean(await git(name, ['status', '--porcelain']));
  if (!execute) {
    print(JSON.stringify({ mode: 'preview', id: plan.id, title: plan.title, committedSources: state.sources, dirtyWorkingTreesExcluded: dirty,
      stages: ['isolated worktrees', 'verified candidate and docs build', 'PR gates and sequential merges', 'website pin and deployment', 'live source identity and HTTP routes'],
      statePath, resume: `npm run ship -- --plan <same-plan.json> --execute`, npmPublication: false }, null, 2));
    return state;
  }
  const common = await git('library', ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  if (state.currentStep === 'complete') { print(JSON.stringify({ status: 'already-completed', statePath, completedAt: state.completedAt }, null, 2)); return state; }
  const releaseLock = await acquireLock(resolve(common, 'inkra-ship.lock'));
  await mkdir(directory, { recursive: true });
  const save = () => atomic(statePath, state);
  const step = async (key, operation) => {
    if (Object.hasOwn(state.done, key)) return state.done[key].value;
    state.currentStep = key; state.lastError = null; await save();
    const started = Date.now(); print(`[ship:${plan.id}] ${key}`);
    const value = await operation();
    state.done[key] = { value, durationMs: Date.now() - started, completedAt: new Date().toISOString() }; await save();
    return value;
  };
  const work = name => resolve(directory, name);
  const local = (name, command, args, env) => run(command, args, { cwd: work(name), env, log: resolve(directory, `${name}.log`) });
  const ancestor = async (name, a, b) => (await git(name, ['rev-list', `${b}..${a}`])).length === 0;
  const makeWorktree = async (name, commit) => {
    if (!existsSync(work(name))) await git(name, ['worktree', 'add', '--detach', work(name), commit]);
    const head = await local(name, 'git', ['rev-parse', 'HEAD']);
    if (head !== commit) {
      // Adopt only our own deterministic pin commit after a crash before checkpointing.
      const parent = await local(name, 'git', ['rev-parse', 'HEAD^']);
      const body = await local(name, 'git', ['log', '-1', '--format=%B']);
      const changed = (await local(name, 'git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'])).split('\n');
      const allowed = name === 'docs' ? ['package.json', 'library-candidate.json', 'package-lock.json'] : ['release.json'];
      assert(name !== 'library' && parent === commit && body.includes(`Ship-Run: ${plan.id}`) && changed.every(path => allowed.includes(path)), 'Worktree changed outside this publication; inspect it');
    }
    if (name === 'library') assert.equal(await local(name, 'git', ['status', '--porcelain']), '', 'Isolated library source changed');
    if (name === 'docs') verifyDocsPackage(JSON.parse(await local('docs', 'git', ['show', `${state.sources.docs}:package.json`])),
      await json(resolve(work('docs'), 'package.json')), Boolean(state.sources.library));
  };
  const commitPin = async (name, files) => {
    await local(name, 'git', ['add', '--', ...files]);
    if (await local(name, 'git', ['diff', '--cached', '--name-only'])) {
      await local(name, 'git', ['commit', '-m', plan.title, '-m', `Ship-Run: ${plan.id}`]);
    }
    assert.equal(await local(name, 'git', ['status', '--porcelain']), '', 'Publication worktree is not clean');
    return local(name, 'git', ['rev-parse', 'HEAD']);
  };
  const publish = async (name, head) => {
    const repository = repos[name], baseSha = state.bases[name], branch = `ship/${plan.id}/${name}`;
    await git(name, ['fetch', 'origin', 'main']);
    if (await ancestor(name, head, 'origin/main')) return head;
    assert.equal(await resolveRef(name, 'origin/main'), baseSha, 'Main changed; review/rebase and create a new plan id');
    const remote = await git(name, ['ls-remote', 'origin', `refs/heads/${branch}`]);
    if (remote) assert.equal(remote.split(/\s/)[0], head, 'Publication branch already names different source');
    const pulls = await get(`repos/${repository}/pulls?state=all&head=inkrajs:${encodeURIComponent(branch)}&base=main`);
    let pr = pulls.find(item => item.head.sha === head);
    let declaration = null;
    let body = `${plan.title}\n\nSource: ${head}\n\nPrepared by the resumable Inkra ship entry. Mandatory CI, candidate identity and website production checks remain enabled. No npm publication.\n`;
    if (plan[name].localValidation) {
      declaration = await json(plan[name].localValidation);
      assert.equal(declaration.tested_commit, head, 'Local test receipt belongs to another head');
      assert.equal(declaration.base_commit, baseSha, 'Local test receipt belongs to another base');
      if (declaration.candidate_sha256 || declaration.local_passed?.some(group => group.group.startsWith('browser:'))) assert.equal(declaration.candidate_sha256, state.done.candidate?.value?.sha256, 'Local test receipt belongs to another candidate');
      body += '\n```ci-local-validation\n' + JSON.stringify(declaration, null, 2) + '\n```\n';
      const policy = JSON.parse(await git(name, ['show', `${baseSha}:.github/local-validation-policy.json`]));
      const validation = resolveLocalValidation({ repository, head, base: baseSha, policy, event: {
        action: 'opened', sender: { ...state.actor, type: 'User' }, repository: { full_name: repository },
        pull_request: { number: pr?.number || 1, body, head: { sha: head }, base: { sha: baseSha, repo: { full_name: repository } } },
      } });
      assert(validation.accepted, 'Local validation declaration is not eligible at the trusted base');
    }
    if (!remote) await git(name, ['push', 'origin', `${head}:refs/heads/${branch}`]);
    if (!pr) pr = await api(`repos/${repository}/pulls`, { title: plan.title, head: branch, base: 'main', body });
    checkPull(pr, { head, base: baseSha, branch, merged: true });
    assert.equal(pr.body, body, 'Existing PR description changed; review it rather than silently overwriting it');
    state.pullRequests[name] = { number: pr.number, url: pr.html_url, head, base: baseSha }; await save();
    if (pr.merged) return pr.merge_commit_sha;
    if (expectedChecks[name].length) {
      const checks = await waitForChecks({ required: expectedChecks[name], sleep, timeoutMs: plan.timeoutMinutes * 60000, intervalMs: plan.pollSeconds * 1000,
        read: async () => {
          const live = await get(`repos/${repository}/pulls/${pr.number}`); checkPull(live, { head, base: baseSha, branch });
          const output = await run('gh', ['pr', 'checks', String(pr.number), '--repo', repository, '--json', 'name,state,link'], { allow: [0, 1, 8], stderrFallback: true });
          return /^no checks (?:reported|found)/i.test(output) ? [] : JSON.parse(output);
        },
      });
      if (declaration) {
        const resolver = checks.find(check => check.name === 'Resolve trusted local tests');
        const match = resolver.link.match(/\/actions\/runs\/(\d+)\/job\/(\d+)/);
        assert(match, 'Cannot inspect CI local-validation decision');
        const log = await run('gh', ['api', `repos/${repository}/actions/jobs/${match[2]}/logs`]);
        assert(log.includes('Decision: **accepted maintainer attestation**') && log.includes(head) && log.includes(baseSha), 'CI did not accept this exact local declaration');
        for (const group of declaration.local_passed) assert(log.includes(group.group) && group.environments.every(env => log.includes(env)), 'CI local validation group/environment mismatch');
        state.pullRequests[name].localValidation = 'accepted'; await save();
      }
    }
    // No admin bypass, force-push or blind retries. A lost response is reconciled on resume.
    const live = await get(`repos/${repository}/pulls/${pr.number}`); checkPull(live, { head, base: baseSha, branch });
    const merged = JSON.parse(await run('gh', ['api', `repos/${repository}/pulls/${pr.number}/merge`, '--method', 'PUT', '--input', '-'], { input: JSON.stringify({ sha: head, merge_method: 'merge' }) }));
    assert(merged.merged && sha.test(merged.sha), 'GitHub did not confirm the merge');
    return merged.sha;
  };
  try {
    await save();
    await step('preflight', async () => {
      const [major, minor] = process.versions.node.split('.').map(Number);
      assert(major > 22 || (major === 22 && minor >= 12), 'Use Node >=22.12 for repository builds');
      state.actor = await get('user'); state.bases = {};
      for (const name of ['library', 'docs', 'website']) {
        await git(name, ['fetch', 'origin', 'main']); state.bases[name] = await resolveRef(name, 'origin/main');
        const source = state.sources[name];
        if (source) assert(await ancestor(name, state.bases[name], source) || await ancestor(name, source, state.bases[name]), `${name} diverged from main; review/rebase first`);
      }
      return state.bases;
    });
    if (state.sources.library) await makeWorktree('library', state.sources.library);
    await makeWorktree('docs', state.sources.docs);
    const candidate = await step('candidate', async () => {
      if (!state.sources.library) return JSON.parse(await local('docs', 'git', ['show', 'HEAD:library-candidate.json']));
      const path = resolve(work('library'), '.release');
      const manifestPath = resolve(path, 'manifest.json');
      if (existsSync(manifestPath)) {
        const cached = await json(manifestPath);
        assert.equal(cached.commit, state.sources.library); await verifyCandidate(path, cached); return cached;
      }
      await local('library', 'npm', ['ci', '--ignore-scripts']);
      await local('library', 'npm', ['run', 'build']);
      await local('library', 'npm', ['run', 'check:package'], { GITHUB_SHA: state.sources.library });
      const manifest = await json(manifestPath); await verifyCandidate(path, manifest); return manifest;
    });
    if (state.sources.library) await verifyCandidate(resolve(work('library'), '.release'), candidate);
    const docsHead = await step('prepared', async () => {
      if (state.sources.library) await local('docs', 'npm', ['run', 'prepare:library', '--', work('library'), '--lockfile-only']);
      await local('docs', 'npm', ['ci', '--ignore-scripts']);
      await local('docs', 'npm', ['run', 'build']);
      verifyDocsPin(JSON.parse(await local('docs', 'git', ['show', `${state.sources.docs}:package.json`])),
        await json(resolve(work('docs'), 'package.json')), await json(resolve(work('docs'), 'library-candidate.json')), candidate, state.sources.library);
      return commitPin('docs', ['package.json', 'library-candidate.json', 'package-lock.json']);
    });
    assert.equal(await local('docs', 'git', ['rev-parse', 'HEAD']), docsHead, 'Prepared docs head changed');
    assert.equal(await local('docs', 'git', ['status', '--porcelain']), '', 'Prepared docs changed');
    if (until === 'prepared') { print(`Prepared only: ${docsHead}; resume with the same plan and --execute`); return state; }
    if (state.sources.library) await step('library-merged', () => publish('library', state.sources.library));
    const docsRevision = await step('docs-merged', () => publish('docs', docsHead));
    const siteHead = await step('website-prepared', async () => {
      await makeWorktree('website', state.bases.website);
      await writeFile(resolve(work('website'), 'release.json'), JSON.stringify({ docsRepository: repos.docs, docsRevision }, null, 2) + '\n');
      return commitPin('website', ['release.json']);
    });
    const siteRevision = await step('website-merged', () => publish('website', siteHead));
    const deployment = await step('deployed', async () => {
      const deadline = Date.now() + plan.timeoutMinutes * 60000;
      while (Date.now() < deadline) {
        const runs = await get(`repos/${repos.website}/actions/workflows/deploy.yml/runs?head_sha=${siteRevision}&event=push&per_page=10`);
        const run = runs.workflow_runs?.filter(item => item.head_sha === siteRevision).sort((a,b) => b.id-a.id)[0];
        if (run?.status === 'completed') { assert.equal(run.conclusion, 'success', `Website deployment failed: ${run.html_url}`); return { id: run.id, url: run.html_url }; }
        await sleep(plan.pollSeconds * 1000);
      }
      throw new Error('Deployment wait timed out; resume the same run');
    });
    await step('live-verified', async () => {
      const deadline = Date.now() + 120000;
      while (Date.now() < deadline) {
        const response = await request(`https://inkrajs.github.io/version.json?ship=${encodeURIComponent(siteRevision)}`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
        if (response.ok) {
          const version = await response.json();
          if (version.site === siteRevision && version.docs === docsRevision && version.library === (state.sources.library || candidate.revision)) {
            assert.equal(version.package.name, candidate.name, 'Live package name differs');
            assert.equal(version.package.version, candidate.version, 'Live package version differs');
            assert.equal(version.package.integrity, candidate.integrity, 'Live package identity differs');
            for (const path of plan.livePaths) {
              const result = await request(new URL(path, 'https://inkrajs.github.io'), { redirect: 'error', signal: AbortSignal.timeout(15000) });
              assert(result.ok, `Live route failed: ${path}`); await result.body?.cancel();
            }
            return { version, paths: plan.livePaths, checks: 'Source identity and HTTP routes; browser checks ran in website CI' };
          }
        }
        await sleep(plan.pollSeconds * 1000);
      }
      throw new Error('CDN has not served the expected release; resume instead of redeploying');
    });
    state.currentStep = 'complete'; state.completedAt = new Date().toISOString(); await save();
    print(JSON.stringify({ status: 'complete', deployment, sources: { library: state.sources.library, docs: docsRevision, website: siteRevision }, pullRequests: state.pullRequests, statePath }, null, 2));
    return state;
  } catch (error) {
    state.lastError = error.message; await save();
    print(`Stopped at ${state.currentStep}. State retained: ${statePath}. No failed gate was bypassed.`);
    throw error;
  } finally { await releaseLock(); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log('npm run ship -- --plan plan.json [--execute] [--until prepared]\nnpm run ship -- --status <run-id>\nDefault: read-only committed-source preview. --execute authorizes push, PR merge and website deployment, never npm publication.'); return; }
  if (args[0] === '--status') {
    assert(args.length === 2 && /^[a-z0-9][a-z0-9-]{0,63}$/.test(args[1]), 'Pass a valid run id');
    console.log(JSON.stringify(await json(resolve(root, '.release/ship', args[1], 'state.json')), null, 2)); return;
  }
  let path, execute = false, until;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--plan') path = args[++i];
    else if (args[i] === '--execute') execute = true;
    else if (args[i] === '--until') until = args[++i];
    else throw new Error(`Unknown ship argument: ${args[i]}`);
  }
  assert(path && (!until || until === 'prepared'), 'Use --plan plan.json; --until supports prepared only');
  await ship(await json(resolve(path)), { execute, until });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
