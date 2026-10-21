import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { archiveName, checkArchive, releaseTag } from './release-policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(new URL('../packages/inkra/package.json', import.meta.url)));
const manifest = JSON.parse(await readFile(new URL('../.release/manifest.json', import.meta.url)));
assert.equal(manifest.filename, archiveName(pkg));
const archive = new URL('../.release/' + manifest.filename, import.meta.url);
checkArchive(manifest, await readFile(archive), pkg, process.env.GITHUB_SHA);
assert.equal(process.env.GITHUB_REF, 'refs/tags/' + releaseTag(pkg));
assert.equal(process.env.GITHUB_REPOSITORY, 'inkrajs/inkra');
const tag = releaseTag(pkg);
const gh = args => execFileSync('gh', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
let release;
try {
  release = JSON.parse(gh(['api', 'repos/inkrajs/inkra/releases/tags/' + tag]));
} catch (error) {
  if (!error.stderr?.toString().includes('(HTTP 404)')) throw error;
}
if (!release) {
  gh(['release', 'create', tag, '--repo', 'inkrajs/inkra', '--verify-tag',
    '--title', 'Inkra ' + pkg.version, '--generate-notes',
    fileURLToPath(archive), '.release/manifest.json']);
} else {
  assert.equal(release.tag_name, tag);
  assert.equal(release.draft, false);
  assert.equal(release.prerelease, false);
  const directory = await mkdtemp(join(tmpdir(), 'inkra-release-assets-'));
  try {
    for (const name of [manifest.filename, 'manifest.json']) {
      const local = join(root, '.release', name);
      if (release.assets.some(asset => asset.name === name)) {
        gh(['release', 'download', tag, '--repo', 'inkrajs/inkra', '--pattern', name, '--dir', directory]);
        assert.deepEqual(await readFile(join(directory, name)), await readFile(local), 'Existing release asset differs; refusing to replace it');
      } else {
        gh(['release', 'upload', tag, local, '--repo', 'inkrajs/inkra']);
      }
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
console.log('GitHub Release verified for ' + tag + '.');
