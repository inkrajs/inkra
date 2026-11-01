import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
import { acquireLock, checkPull, normalizePlan, processRunner, ship, verifyCandidate, verifyDocsPin, waitForChecks } from '../ship.mjs';

const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40), d = 'd'.repeat(40), e = 'e'.repeat(40), f = 'f'.repeat(40);
const zero = '0'.repeat(40), one = '1'.repeat(40), two = '2'.repeat(40), three = '3'.repeat(40);
const repositories = { library: 'inkrajs/inkra', docs: 'inkrajs/docs', website: 'inkrajs/inkrajs.github.io' };
const plan = { schemaVersion: 1, id: 'test-run', title: 'Publish a reviewed change', library: { directory: 'library', ref: 'feature' }, docs: { directory: 'docs', ref: 'feature' }, website: { directory: 'website' }, pollSeconds: 2, timeoutMinutes: 1 };
const digest = (name, bytes) => createHash(name).update(bytes).digest(name === 'sha512' ? 'base64' : 'hex');

test('plan rejects wrong options and cross-origin live paths; paths are portable', () => {
  const p = normalizePlan(plan, '/workspace');
  assert.equal(p.docs.directory, '/workspace/docs');
  for (const change of [{ id: '../escape' }, { npmPublish: true }, { livePaths: ['//elsewhere.invalid'] }, { livePaths: ['/\\elsewhere.invalid'] }, { docs: { ref: '--upload-pack=oops' } }, { pollSeconds: 0 }]) {
    assert.throws(() => normalizePlan({ ...plan, ...change }, '/workspace'));
  }
});

test('pending checks do not pass; a skipped required check or missing matrix waits to timeout', async () => {
  let time = 0, reads = 0;
  const checks = await waitForChecks({ read: async () => ++reads === 1 ? [] : [{ name: 'build', state: 'SUCCESS' }, { name: 'browser', state: 'SKIPPED' }], required: ['build'], now: () => time, sleep: async ms => { time += ms; }, timeoutMs: 100, intervalMs: 10 });
  assert.equal(reads, 2); assert.equal(checks.length, 2);
  await assert.rejects(waitForChecks({ read: async () => [{ name: 'build', state: 'SKIPPED' }], required: ['build'], now: () => time, sleep: async ms => { time += ms; }, timeoutMs: 20, intervalMs: 10 }), /timed out/);
  await assert.rejects(waitForChecks({ read: async () => [{ name: 'build', state: 'FAILURE', link: 'https://github.com/check' }], required: ['build'], now: () => time, timeoutMs: 20, intervalMs: 10 }), /CI failed/);
});

test('PR head/base drift and closed unmerged PRs cannot be merged', () => {
  const pr = { head: { sha: a, ref: 'ship/test/library' }, base: { sha: b }, state: 'open', merged: false };
  checkPull(pr, { head: a, base: b, branch: pr.head.ref });
  assert.throws(() => checkPull(pr, { head: c, base: b, branch: pr.head.ref }), /head changed/);
  assert.throws(() => checkPull(pr, { head: a, base: c, branch: pr.head.ref }), /base changed/);
  assert.throws(() => checkPull({ ...pr, state: 'closed' }, { head: a, base: b, branch: pr.head.ref }), /closed/);
});

test('archive reuse verifies both digests, source identity and safe filename', async t => {
  const path = await mkdtemp(resolve(tmpdir(), 'inkra-ship-archive-')); t.after(() => rm(path, { recursive: true, force: true }));
  const bytes = Buffer.from('verified candidate');
  const m = { name: '@inkra/react', version: '0.12.0', filename: 'inkra-react-0.12.0.tgz', commit: a, sha256: digest('sha256', bytes), integrity: 'sha512-' + digest('sha512', bytes) };
  await writeFile(resolve(path, m.filename), bytes); await verifyCandidate(path, m);
  await assert.rejects(verifyCandidate(path, { ...m, filename: '../elsewhere.tgz' }));
  await assert.rejects(verifyCandidate(path, { ...m, name: 'another-package' }));
  await writeFile(resolve(path, m.filename), 'tampered'); await assert.rejects(verifyCandidate(path, m), /checksum/);
});

test('generated docs pin cannot include unrelated package scripts or another candidate', () => {
  const pkg = { scripts: { build: 'original' }, dependencies: { '@inkra/react': '0.12.0' } };
  const candidate = { name: '@inkra/react', version: '0.12.0', sha256: 'hash', integrity: 'integrity', commit: a };
  const pinned = { ...pkg, dependencies: { '@inkra/react': 'file:vendor/inkra.tgz' } };
  const metadata = { ...candidate, revision: a };
  verifyDocsPin(pkg, pinned, metadata, candidate, a);
  assert.throws(() => verifyDocsPin(pkg, { ...pinned, scripts: { build: 'changed' } }, metadata, candidate, a), /exceed/);
  assert.throws(() => verifyDocsPin(pkg, pinned, { ...metadata, revision: b }, candidate, a), /revision changed/);
});

test('publication lock rejects a second active owner', async t => {
  const path = await mkdtemp(resolve(tmpdir(), 'inkra-ship-lock-')); t.after(() => rm(path, { recursive: true, force: true }));
  const unlock = await acquireLock(resolve(path, 'lock'));
  await assert.rejects(acquireLock(resolve(path, 'lock')), /Another publication/);
  await unlock(); const again = await acquireLock(resolve(path, 'lock')); await again();
});

test('runner preserves valid JSON stdout independently from diagnostic stderr', async () => {
  const output = await processRunner(process.execPath, ['-e', 'process.stderr.write("diagnostic"); process.stdout.write(JSON.stringify({ok:true}))']);
  assert.deepEqual(JSON.parse(output), { ok: true });
  const noChecks = await processRunner(process.execPath, ['-e', 'process.stderr.write("no checks reported"); process.exitCode=1'], { allow: [0, 1], stderrFallback: true });
  assert.equal(noChecks, 'no checks reported');
});

test('command timeouts stop the owned process instead of hanging a publication', async () => {
  await assert.rejects(processRunner(process.execPath, ['-e', 'setTimeout(()=>{},5000)'], { timeoutMs: 30 }), /timed out/);
});

async function fixture(t, { loseMergeResponse = false } = {}) {
  const root = await mkdtemp(resolve(tmpdir(), 'inkra-ship-fixture-')); t.after(() => rm(root, { recursive: true, force: true }));
  const main = { library: zero, docs: b, website: e }, initial = { library: a, docs: b, website: e };
  const heads = new Map(), staged = new Set(), remote = {}, prs = {}, calls = [], parents = { [a]: [zero], [d]: [b], [one]: [a], [two]: [d], [f]: [e], [three]: [f] };
  let next = 1, lost = false, candidate, buildCount = 0;
  for (const name of Object.keys(repositories)) { await mkdir(resolve(root, name)); heads.set(resolve(root, name), initial[name]); }
  const isAncestor = (x, y) => x === y || (parents[y] || []).some(parent => isAncestor(x, parent));
  const run = async (command, args, options = {}) => {
    calls.push({ command, args, cwd: options.cwd });
    const name = basename(options.cwd || '');
    const ref = value => value === 'origin/main' ? main[name] : value === 'HEAD' ? heads.get(options.cwd) : value;
    if (command === 'git') {
      if (args[0] === 'remote') return `https://github.com/${repositories[name]}.git`;
      if (args[0] === 'status') return '';
      if (args[0] === 'fetch' || args[0] === 'add') { if (args[0] === 'add') staged.add(options.cwd); return ''; }
      if (args[0] === 'rev-parse') {
        if (args.includes('--git-common-dir')) return resolve(root, 'common');
        const last = args.at(-1).replace(/\^\{commit\}$/, '');
        if (last === 'feature') return initial[name];
        if (last === 'HEAD^') return parents[heads.get(options.cwd)][0];
        return ref(last);
      }
      if (args[0] === 'show') return args[1].endsWith(':package.json')
        ? JSON.stringify({ dependencies: { '@inkra/react': 'file:vendor/inkra.tgz' } })
        : JSON.stringify({ revision: c, source: 'candidate', name: '@inkra/react', version: '0.12.0' });
      if (args[0] === 'rev-list') { const [right, left] = args[1].split('..'); return isAncestor(ref(left), ref(right)) ? '' : ref(left); }
      if (args[0] === 'worktree') {
        await mkdir(args[3], { recursive: true }); heads.set(args[3], args[4]);
        if (name === 'docs') await writeFile(resolve(args[3], 'package.json'), JSON.stringify({ dependencies: { '@inkra/react': 'file:vendor/inkra.tgz' } }));
        return '';
      }
      if (args[0] === 'diff') return staged.has(options.cwd) ? name === 'docs' ? 'library-candidate.json\npackage-lock.json' : 'release.json' : '';
      if (args[0] === 'diff-tree') return name === 'docs' ? 'library-candidate.json\npackage-lock.json' : 'release.json';
      if (args[0] === 'log') return 'Ship-Run: test-run';
      if (args[0] === 'commit') { heads.set(options.cwd, name === 'docs' ? d : f); staged.delete(options.cwd); return ''; }
      if (args[0] === 'ls-remote') return remote[name] ? `${remote[name]}\t${args[2]}` : '';
      if (args[0] === 'push') { remote[name] = args[2].split(':')[0]; return ''; }
      throw new Error('Unexpected git operation ' + args.join(' '));
    }
    if (command === 'npm') {
      if (args.includes('build')) buildCount++;
      if (args.includes('check:package')) {
        const bytes = Buffer.from('fixture package'); candidate = { name: '@inkra/react', version: '0.12.0', filename: 'inkra-react-0.12.0.tgz', commit: a, sha256: digest('sha256', bytes), integrity: 'sha512-' + digest('sha512', bytes) };
        await mkdir(resolve(options.cwd, '.release'), { recursive: true });
        await writeFile(resolve(options.cwd, '.release', candidate.filename), bytes); await writeFile(resolve(options.cwd, '.release/manifest.json'), JSON.stringify(candidate));
      }
      if (args.includes('prepare:library')) { await writeFile(resolve(options.cwd, 'library-candidate.json'), JSON.stringify({ ...candidate, revision: a })); await writeFile(resolve(options.cwd, 'package-lock.json'), '{}'); }
      return '';
    }
    assert.equal(command, 'gh');
    if (args[0] === 'pr') return JSON.stringify((name === 'unused' ? [] : ['Resolve trusted local tests', 'Node 22 / React 18.3.1', 'Node 24 / React 19.3.1', 'build', 'docs']).map(name => ({ name, state: 'SUCCESS' })));
    const path = args[1]; if (path === 'user') return JSON.stringify({ id: 51358815, login: 'maintainer' });
    const key = Object.keys(repositories).find(k => path.startsWith('repos/' + repositories[k] + '/'));
    if (path.includes('/actions/workflows/')) return JSON.stringify({ workflow_runs: [{ id: 90, head_sha: three, status: 'completed', conclusion: 'success', html_url: 'https://github.com/deploy' }] });
    if (path.includes('/pulls?')) return JSON.stringify(prs[key] ? [prs[key]] : []);
    if (path.endsWith('/pulls')) {
      const body = JSON.parse(options.input); const number = next++;
      prs[key] = { number, html_url: `https://github.com/${repositories[key]}/pull/${number}`, body: body.body, state: 'open', merged: false, head: { sha: remote[key], ref: body.head }, base: { sha: main[key] } };
      return JSON.stringify(prs[key]);
    }
    if (path.endsWith('/merge')) {
      const pr = prs[key]; assert.equal(JSON.parse(options.input).sha, pr.head.sha);
      const merged = { library: one, docs: two, website: three }[key]; pr.merged = true; pr.state = 'closed'; pr.merge_commit_sha = merged; main[key] = merged;
      if (loseMergeResponse && !lost && key === 'library') { lost = true; throw new Error('lost merge response'); }
      return JSON.stringify({ merged: true, sha: merged });
    }
    if (/\/pulls\/\d+$/.test(path)) return JSON.stringify(prs[key]);
    throw new Error('Unexpected GitHub read ' + path);
  };
  const request = async url => ({ url: String(url), ok: true, json: async () => ({ site: three, docs: two, library: a, package: { name: candidate.name, version: candidate.version, integrity: candidate.integrity } }), body: { cancel: async () => {} } });
  return { root, run, request, calls, getBuildCount: () => buildCount };
}

test('preview has no auth/network/npm/write actions and names only committed source', async t => {
  const fixtureData = await fixture(t); const output = [];
  await ship(plan, { base: fixtureData.root, run: fixtureData.run, print: value => output.push(value) });
  assert.equal(fixtureData.calls.some(c => c.command !== 'git'), false);
  assert.equal(existsSync(resolve(fixtureData.root, '.release')), false);
  assert.equal(JSON.parse(output[0]).mode, 'preview');
});

test('three-repository publication resumes an uncertain merge without duplicate PRs/builds/pushes', async t => {
  const fx = await fixture(t, { loseMergeResponse: true });
  const options = { base: fx.root, execute: true, run: fx.run, request: fx.request, print: () => {} };
  await assert.rejects(ship(plan, options), /lost merge response/);
  const builds = fx.getBuildCount();
  const state = JSON.parse(await readFile(resolve(fx.root, '.release/ship/test-run/state.json')));
  assert.equal(state.currentStep, 'library-merged'); assert.match(state.lastError, /lost merge/);
  const result = await ship(plan, options); assert.equal(result.currentStep, 'complete');
  assert.equal(fx.getBuildCount(), builds, 'Already-passed local builds are not repeated');
  assert.equal(fx.calls.filter(c => c.command === 'git' && c.args[0] === 'push').length, 3);
  assert.equal(fx.calls.filter(c => c.command === 'gh' && c.args[1].endsWith('/pulls') && c.args.includes('POST')).length, 3);
  assert.equal(fx.calls.filter(c => c.command === 'gh' && c.args[1].endsWith('/merge')).length, 3);
  await ship(plan, options); assert.equal(fx.getBuildCount(), builds, 'A completed id is a no-op');
  await assert.rejects(ship({ ...plan, title: 'Different approved content' }, options), /Plan changed/);
});

test('prepare-only checkpoint has no push or PR side effects', async t => {
  const fx = await fixture(t);
  const result = await ship(plan, { base: fx.root, execute: true, until: 'prepared', run: fx.run, request: fx.request, print: () => {} });
  assert.equal(result.done.prepared.value, d);
  assert.equal(fx.calls.some(c => c.command === 'git' && c.args[0] === 'push'), false);
  assert.equal(fx.calls.some(c => c.command === 'gh' && c.args.includes('POST')), false);
});

test('stale local-test receipts stop before any push or PR creation', async t => {
  const fx = await fixture(t);
  const path = resolve(fx.root, 'receipt.json');
  await writeFile(path, JSON.stringify({ schemaVersion: 1, tested_commit: c, base_commit: zero, local_passed: [] }));
  await assert.rejects(ship({ ...plan, library: { ...plan.library, localValidation: path } }, { base: fx.root, execute: true, run: fx.run, request: fx.request, print: () => {} }), /another head/);
  assert.equal(fx.calls.some(c => c.command === 'git' && c.args[0] === 'push'), false);
  assert.equal(fx.calls.some(c => c.command === 'gh' && c.args.includes('POST')), false);
});


test('live verification follows canonical same-origin page redirects', async t => {
  const fx = await fixture(t);
  const request = async (url, options) => {
    assert.equal(options.redirect, 'follow');
    const response = await fx.request(url);
    response.url = String(url).includes('/version.json') ? String(url) : String(url).replace(/\/?$/, '/');
    return response;
  };
  const result = await ship(plan, { base: fx.root, execute: true, run: fx.run, request, print: () => {} });
  assert.equal(result.currentStep, 'complete');
});

test('a live redirect outside the website is rejected', async t => {
  const fx = await fixture(t);
  const request = async url => ({ ...await fx.request(url), url: 'https://example.org/moved' });
  await assert.rejects(ship(plan, { base: fx.root, execute: true, run: fx.run, request, print: () => {} }), /redirected outside/);
});
