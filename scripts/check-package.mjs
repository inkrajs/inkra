import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = new URL('../.release/', import.meta.url);
await mkdir(directory, { recursive: true });
const packageJson = JSON.parse(await readFile(new URL('../packages/inkra/package.json', import.meta.url), 'utf8'));
const [pack] = JSON.parse(execFileSync('npm', ['pack', '--workspace=inkra', '--ignore-scripts', '--json', '--pack-destination', fileURLToPath(directory)], { cwd: root, encoding: 'utf8' }));
const paths = new Set(pack.files.map(file => file.path));
for (const file of paths) {
  assert(/^(dist\/|README\.md$|LICENSE$|THIRD_PARTY_NOTICES\.md$|Yozai-OFL\.txt$|package\.json$)/.test(file), `Unexpected package entry: ${file}`);
  assert(!/\.map$|node_modules|\.env|\.test\./.test(file), `Unexpected development artifact: ${file}`);
}
const targets = value => typeof value === 'string' ? [value] : Object.values(value).flatMap(targets);
for (const entry of targets(packageJson.exports)) assert(paths.has(entry.replace(/^\.\//, '')), `Missing exported file: ${entry}`);
for (const path of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'Yozai-OFL.txt', 'dist/assets/ui-hand-yozai.woff2']) assert(paths.has(path), `Missing required asset: ${path}`);
assert.equal(pack.version, packageJson.version);
assert.equal(packageJson.repository.url, 'git+https://github.com/inkrajs/inkra.git');
assert(!packageJson.dependencies.react && !packageJson.dependencies['react-dom'], 'React must stay a peer dependency');
const sha256 = createHash('sha256').update(await readFile(new URL(pack.filename, directory))).digest('hex');
await writeFile(new URL('manifest.json', directory), JSON.stringify({ name: pack.name, version: pack.version, filename: pack.filename, sha256, integrity: pack.integrity, commit: process.env.GITHUB_SHA ?? null, entries: pack.entryCount }, null, 2) + '\n');
console.log(`Package candidate: ${pack.filename}, ${pack.entryCount} files, sha256=${sha256}`);
