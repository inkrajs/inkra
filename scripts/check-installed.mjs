import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installRegistryVersion } from './registry-install.mjs';

const candidate = JSON.parse(await readFile(new URL('../.release/manifest.json', import.meta.url), 'utf8'));
const tarball = fileURLToPath(new URL(`../.release/${candidate.filename}`, import.meta.url));
assert.equal(createHash('sha256').update(await readFile(tarball)).digest('hex'), candidate.sha256);
const reactVersion = process.env.REACT_VERSION || '19.3.1';
assert(/^\d+\.\d+\.\d+$/.test(reactVersion), 'REACT_VERSION must be an exact stable version');
const major = Number(reactVersion.split('.')[0]);
assert([18, 19].includes(major), 'Only React 18 and 19 are in this validation matrix');
const directory = await mkdtemp(join(tmpdir(), 'inkra-installed-'));
const fromRegistry = process.argv.includes('--registry');
const browserChecks = process.argv.includes('--browser');
assert.equal(candidate.name, '@inkra/react');
assert(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(candidate.version), 'Invalid candidate version');
try {
  await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  const installSource = fromRegistry ? candidate.name + '@' + candidate.version : tarball;
  const install = (remainingMs = 180000) => {
    try {
      const output = execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...(fromRegistry ? ['--prefer-online'] : []), '--registry=https://registry.npmjs.org', installSource, `react@${reactVersion}`, `react-dom@${reactVersion}`, 'typescript@5.9.3', `@types/react@${major}`, `@types/react-dom@${major}`, ...(browserChecks ? ['vite@8.3.4'] : [])], {
        cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: Math.min(180000, remainingMs),
      });
      process.stdout.write(output);
    } catch (error) {
      process.stdout.write(String(error.stdout ?? ''));
      process.stderr.write(String(error.stderr ?? ''));
      throw error;
    }
  };
  if (fromRegistry) await installRegistryVersion(install, {
    name: candidate.name, version: candidate.version,
    onRetry: delay => console.log(`npm index has not exposed ${installSource}; retrying installation in ${delay / 1000}s (five-minute limit, no republish).`),
  });
  else install();
  const installedLock = JSON.parse(await readFile(join(directory, 'package-lock.json'), 'utf8'));
  assert.equal(installedLock.packages['node_modules/@inkra/react'].integrity, candidate.integrity, 'Installed bytes differ from candidate');
  assert(!(await lstat(join(directory, 'node_modules/@inkra/react'))).isSymbolicLink(), 'Must test the installed tarball, not a workspace link');
  await cp(new URL('./fixtures/installed-smoke.mjs', import.meta.url), join(directory, 'smoke.mjs'));
  await cp(new URL('./fixtures/installed-types.tsx', import.meta.url), join(directory, 'types.tsx'));
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: directory, stdio: 'inherit' });
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2020', '--jsx', 'react-jsx', 'types.tsx'], { cwd: directory, stdio: 'inherit' });
  if (browserChecks) await (await import('./check-hydration.mjs')).checkHydration(directory);
  console.log(`Installed ${fromRegistry ? 'registry package' : 'tarball'} SSR/import/type${browserChecks ? '/hydration' : ''} checks passed with React ${reactVersion}.`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
