import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const candidate = JSON.parse(await readFile(new URL('../.release/manifest.json', import.meta.url), 'utf8'));
const tarball = fileURLToPath(new URL(`../.release/${candidate.filename}`, import.meta.url));
assert.equal(createHash('sha256').update(await readFile(tarball)).digest('hex'), candidate.sha256);
const reactVersion = process.env.REACT_VERSION || '19.3.1';
assert(/^\d+\.\d+\.\d+$/.test(reactVersion), 'REACT_VERSION must be an exact stable version');
const major = Number(reactVersion.split('.')[0]);
assert([18, 19].includes(major), 'Only React 18 and 19 are in this validation matrix');
const directory = await mkdtemp(join(tmpdir(), 'inkra-installed-'));
try {
  await writeFile(join(directory, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org', tarball, `react@${reactVersion}`, `react-dom@${reactVersion}`, 'typescript@5.9.3', `@types/react@${major}`, `@types/react-dom@${major}`], { cwd: directory, stdio: 'inherit', timeout: 180000 });
  assert(!(await lstat(join(directory, 'node_modules/inkra'))).isSymbolicLink(), 'Must test the installed tarball, not a workspace link');
  await cp(new URL('./fixtures/installed-smoke.mjs', import.meta.url), join(directory, 'smoke.mjs'));
  await cp(new URL('./fixtures/installed-types.tsx', import.meta.url), join(directory, 'types.tsx'));
  execFileSync(process.execPath, ['smoke.mjs'], { cwd: directory, stdio: 'inherit' });
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2020', '--jsx', 'react-jsx', 'types.tsx'], { cwd: directory, stdio: 'inherit' });
  console.log(`Installed tarball SSR/import/type checks passed with React ${reactVersion}. Browser hydration is a separate release gate.`);
} finally {
  await rm(directory, { recursive: true, force: true });
}
