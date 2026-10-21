import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { archiveName, checkArchive, checkPublished, checkSource, readPublished, registry } from './release-policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: root, stdio: 'inherit', ...options });
const git = args => run('git', args, { encoding: 'utf8', stdio: 'pipe' }).trim();
const pkg = await json('packages/inkra/package.json');
const commit = git(['rev-parse', 'HEAD']);
const action = process.env.RELEASE_ACTION ?? 'validate';
checkSource({ pkg, lock: await json('package-lock.json'), action, ref: process.env.GITHUB_REF, commit });
assert(!git(['status', '--porcelain']), 'Release builds require a clean checkout');
if (process.env.GITHUB_SHA) assert.equal(commit, process.env.GITHUB_SHA, 'Checked-out commit does not match the workflow');
if (action !== 'validate') {
  assert.equal(process.env.GITHUB_REPOSITORY, 'inkrajs/inkra');
  run('git', ['merge-base', '--is-ancestor', commit, 'origin/main']);
}

const operation = process.argv[2];
if (operation === 'source') {
  assert(/^[0-9a-f]{40}$/.test(process.env.DOCS_REF ?? ''), 'DOCS_REF must be an exact docs commit');
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, 'version=' + pkg.version + '\n');
  console.log('Validated source ' + commit + ' for ' + action + ' (' + pkg.version + ').');
} else {
  const manifest = await json('.release/manifest.json');
  // Check the filename before constructing a filesystem path from the artifact.
  assert.equal(manifest.filename, archiveName(pkg));
  const archive = new URL('../.release/' + manifest.filename, import.meta.url);
  checkArchive(manifest, await readFile(archive), pkg, commit);
  const summary = text => process.env.GITHUB_STEP_SUMMARY
    ? appendFile(process.env.GITHUB_STEP_SUMMARY, text + '\n')
    : Promise.resolve(console.log(text));
  if (operation === 'candidate') {
    await summary('Candidate: ' + manifest.name + '@' + manifest.version + '\n\nSource: ' + commit + '\n\nSHA-256: ' + manifest.sha256);
  } else if (operation === 'publish' || operation === 'bootstrap-stage') {
    assert.equal(action, operation);
    const existing = await readPublished(manifest);
    if (existing) {
      await summary('This exact archive is already published; no duplicate publish was attempted.');
    } else {
      if (operation === 'bootstrap-stage') assert(process.env.NODE_AUTH_TOKEN, 'Configure NPM_BOOTSTRAP_TOKEN in the npm-release environment');
      const args = operation === 'bootstrap-stage' ? ['stage', 'publish'] : ['publish'];
      run('npm', [...args, fileURLToPath(archive), '--registry=' + registry, '--access=public', '--tag=latest', '--provenance', '--ignore-scripts']);
      await summary(operation === 'bootstrap-stage'
        ? 'Submitted for npm maintainer approval, NOT a completed release. For a new package npm exposes a 0.0.0-stage placeholder. Approve with 2FA on npm, then run verify for this same tag.'
        : 'Published the verified archive. Registry installation checks must pass before a GitHub Release is created.');
    }
  } else if (operation === 'verify') {
    let published;
    for (let attempt = 0; attempt < 6; attempt++) {
      published = await readPublished(manifest);
      if (published) break;
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    assert(published, 'Version is not public. For staged publishing, complete npm approval before verify.');
    const response = await fetch(published.dist.tarball, { signal: AbortSignal.timeout(30000) });
    assert(response.ok, 'Cannot download the published archive');
    checkArchive(manifest, Buffer.from(await response.arrayBuffer()), pkg, commit);
    checkPublished(manifest, published);
    await summary('Registry archive SHA-256 and integrity match the approved candidate.');
  } else {
    throw Error('Unknown release operation: ' + operation);
  }
}
