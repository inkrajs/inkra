import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const source = resolve(process.argv[2]);
assert.equal(process.env.GITHUB_REPOSITORY, 'inkrajs/inkra');
assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
assert(process.env.NODE_AUTH_TOKEN, 'Missing protected bootstrap credential');
const git = args => execFileSync('git', args, { cwd: source, encoding: 'utf8' }).trim();
const commit = '3f3af14a9f6db230cf39db2c7fe5b30e606795f3';
assert.equal(git(['rev-parse', 'HEAD']), commit);
assert.equal(git(['rev-parse', 'v0.1.0^{commit}']), commit);
assert.equal(git(['status', '--porcelain']), '');
git(['merge-base', '--is-ancestor', commit, 'origin/main']);
const { checkSource, checkArchive, readPublished } = await import(pathToFileURL(resolve(source, 'scripts/release-policy.mjs')));
const json = async path => JSON.parse(await readFile(resolve(source, path), 'utf8'));
const pkg = await json('packages/inkra/package.json');
checkSource({ pkg, lock: await json('package-lock.json'), action: 'publish', ref: 'refs/tags/v0.1.0', commit });
const manifest = await json('.release/manifest.json');
const archive = resolve(source, '.release/inkra-0.1.0.tgz');
checkArchive(manifest, await readFile(archive), pkg, commit);
if (await readPublished(manifest)) {
  console.log('The exact candidate is already public; no duplicate publish.');
} else {
  // Keep the real workflow identity intact for the provenance attestation.
  execFileSync('npm', ['publish', archive, '--registry=https://registry.npmjs.org/', '--access=public', '--tag=latest', '--provenance', '--ignore-scripts'], { cwd: source, stdio: 'inherit' });
}
