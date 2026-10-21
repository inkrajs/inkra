import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const registry = 'https://registry.npmjs.org/';
export const releaseActions = ['validate', 'publish', 'bootstrap-stage', 'verify'];
export const archiveName = pkg => 'inkra-react-' + pkg.version + '.tgz';
export const releaseTag = pkg => 'react-v' + pkg.version;

export function checkSource({ pkg, lock, action, ref, commit }) {
  assert(releaseActions.includes(action), 'Unknown release action');
  assert.equal(pkg.name, '@inkra/react');
  assert.equal(pkg.repository.url, 'git+https://github.com/inkrajs/inkra.git');
  assert.equal(pkg.publishConfig.registry, registry);
  assert.equal(pkg.publishConfig.access, 'public');
  assert.equal(lock.packages['packages/inkra'].version, pkg.version, 'Lockfile version mismatch');
  assert(/^[0-9a-f]{40}$/.test(commit), 'An exact source commit is required');
  if (action !== 'validate') {
    assert(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(pkg.version), 'Only stable versions can be released');
    assert.equal(ref, 'refs/tags/' + releaseTag(pkg), 'Select the exact version tag, not a branch');
    assert.equal(pkg.publishConfig.tag, 'latest', 'Stable releases require the latest dist-tag');
  }
}

export function checkArchive(manifest, bytes, pkg, commit) {
  assert.equal(manifest.name, pkg.name);
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.filename, archiveName(pkg));
  assert.equal(manifest.commit, commit, 'Candidate belongs to another commit');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256, 'Candidate SHA-256 mismatch');
  assert.equal('sha512-' + createHash('sha512').update(bytes).digest('base64'), manifest.integrity, 'Candidate integrity mismatch');
}

export function checkPublished(manifest, metadata) {
  assert.equal(metadata.name, manifest.name);
  assert.equal(metadata.version, manifest.version);
  assert.equal(metadata.dist?.integrity, manifest.integrity, 'Registry version already exists with different bytes');
  assert.equal(new URL(metadata.dist.tarball).origin, new URL(registry).origin);
}

export async function readPublished(manifest, request = fetch) {
  const response = await request(registry + encodeURIComponent(manifest.name) + '/' + encodeURIComponent(manifest.version), {
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 404) return null;
  assert(response.ok, 'Registry lookup failed with HTTP ' + response.status);
  const metadata = await response.json();
  checkPublished(manifest, metadata);
  return metadata;
}
