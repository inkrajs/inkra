import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { checkArchive, checkSource, readPublished, waitForPublished } from '../release-policy.mjs';

const commit = 'a'.repeat(40);
const pkg = { name: '@inkra/react', version: '0.1.0', repository: { url: 'git+https://github.com/inkrajs/inkra.git' },
  publishConfig: { registry: 'https://registry.npmjs.org/', access: 'public', tag: 'latest' } };
const lock = { packages: { 'packages/inkra': { version: pkg.version } } };
const source = { pkg, lock, action: 'publish', ref: 'refs/tags/react-v0.1.0', commit };
const bytes = Buffer.from('verified candidate');
const manifest = { name: pkg.name, version: pkg.version, filename: 'inkra-react-0.1.0.tgz', commit,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') };
const metadata = { name: pkg.name, version: pkg.version,
  dist: { integrity: manifest.integrity, tarball: 'https://registry.npmjs.org/@inkra/react/-/react-0.1.0.tgz' } };

test('stable releases require matching tag, version, lockfile and latest', () => {
  checkSource(source);
  for (const change of [
    { ref: 'refs/heads/main' }, { ref: 'refs/tags/react-v0.2.0' }, { ref: 'refs/tags/v0.1.0' }, { commit: 'main' },
    { pkg: { ...pkg, name: 'inkra' } },
    { action: 'unknown' }, { lock: { packages: { 'packages/inkra': { version: '0.0.1' } } } },
    { pkg: { ...pkg, publishConfig: { ...pkg.publishConfig, tag: 'alpha' } } },
  ]) assert.throws(() => checkSource({ ...source, ...change }));
});

test('validation supports unpublished alpha without allowing it to release', () => {
  const alpha = { ...pkg, version: '0.0.1-alpha.0' };
  const candidate = { ...source, pkg: alpha, lock: { packages: { 'packages/inkra': { version: alpha.version } } } };
  checkSource({ ...candidate, action: 'validate', ref: 'refs/heads/main' });
  assert.throws(() => checkSource(candidate), /stable/);
});

test('candidate checks reject altered bytes, traversal and cross-commit artifacts', () => {
  checkArchive(manifest, bytes, pkg, commit);
  assert.throws(() => checkArchive(manifest, Buffer.from('different'), pkg, commit), /SHA-256/);
  assert.throws(() => checkArchive({ ...manifest, filename: '../stolen.tgz' }, bytes, pkg, commit));
  assert.throws(() => checkArchive(manifest, bytes, pkg, 'b'.repeat(40)), /another commit/);
});

test('only 404 means unpublished; auth, network and rate limits fail closed', async () => {
  assert.equal(await readPublished(manifest, async url => {
    assert.equal(url, 'https://registry.npmjs.org/%40inkra%2Freact/0.1.0');
    return { status: 404 };
  }), null);
  for (const status of [401, 403, 429, 500]) {
    await assert.rejects(readPublished(manifest, async () => ({ status, ok: false })), /lookup failed/);
  }
  await assert.rejects(readPublished(manifest, async () => { throw Error('offline'); }), /offline/);
});

test('idempotent retry requires exactly matching registry bytes and host', async () => {
  assert.deepEqual(await readPublished(manifest, async () => ({ ok: true, json: async () => metadata })), metadata);
  for (const dist of [
    { ...metadata.dist, integrity: 'different' },
    { ...metadata.dist, tarball: 'https://other.example/inkra.tgz' },
  ]) await assert.rejects(readPublished(manifest, async () => ({ ok: true, json: async () => ({ ...metadata, dist }) })));
});

function clock() {
  let time = 0;
  const delays = [];
  return {
    delays, now: () => time,
    advance: milliseconds => { time += milliseconds; },
    sleep: async milliseconds => { delays.push(milliseconds); time += milliseconds; },
  };
}

test('registry wait returns immediately for an available archive', async () => {
  const timing = clock();
  assert.equal(await waitForPublished(manifest, { ...timing, read: async () => metadata }), metadata);
  assert.deepEqual(timing.delays, []);
});

test('registry 404 retries back off and stop when processing completes', async () => {
  const timing = clock();
  let attempts = 0;
  const published = await waitForPublished(manifest, {
    ...timing, read: async () => ++attempts === 6 ? metadata : null,
  });
  assert.equal(published, metadata);
  assert.deepEqual(timing.delays, [5000, 10000, 20000, 30000, 30000]);
});

test('registry waiting has a deadline including lookup time and no attempt after it', async () => {
  const timing = clock();
  let attempts = 0;
  assert.equal(await waitForPublished(manifest, {
    ...timing, timeoutMs: 12000,
    read: async (_, remainingMs) => { assert(remainingMs <= 12000); attempts++; timing.advance(1000); return null; },
  }), null);
  assert.equal(attempts, 2);
  assert.equal(timing.now(), 12000);
  assert.deepEqual(timing.delays, [5000, 5000]);
  const exhausted = clock();
  assert.equal(await waitForPublished(manifest, {
    ...exhausted, timeoutMs: 1000, read: async () => { exhausted.advance(1000); return null; },
  }), null);
  assert.deepEqual(exhausted.delays, []);
});

test('registry errors are never retried or treated as unpublished', async () => {
  for (const message of ['HTTP 401', 'HTTP 403', 'HTTP 429', 'HTTP 500', 'offline', 'integrity mismatch']) {
    const timing = clock();
    let attempts = 0;
    await assert.rejects(waitForPublished(manifest, {
      ...timing, read: async () => { attempts++; throw Error(message); },
    }), error => error.message === message);
    assert.equal(attempts, 1);
    assert.deepEqual(timing.delays, []);
  }
  await assert.rejects(waitForPublished(manifest, { timeoutMs: 0 }), /positive timeout/);
});
