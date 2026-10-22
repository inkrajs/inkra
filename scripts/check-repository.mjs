import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'));
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!entry.resolved || entry.link) continue;
  assert.equal(new URL(entry.resolved).origin, 'https://registry.npmjs.org', `Non-public dependency URL: ${path}`);
  assert(entry.integrity, `Missing integrity: ${path}`);
}

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
for (const path of files) {
  assert(!/(^|\/)(node_modules|dist|\.release|\.env|\.local)(\/|$)/.test(path), `Local artifact included: ${path}`);
  if (!/\.(?:m?[jt]sx?|json|css|md|ya?ml|txt)$/.test(path)) continue;
  const source = await readFile(new URL(path, new URL('../', import.meta.url)), 'utf8');
  if (path.startsWith('packages/inkra/test/')) {
    assert(!source.includes('apps/docs'), `Library tests must not depend on the separate docs checkout: ${path}`);
  }
  assert(!/\/Users\/[^/\s]+\/|\/var\/folders\//.test(source), `Machine-specific path: ${path}`);
  assert(!/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}|\bnpm_[A-Za-z0-9]{30,}/.test(source), `Potential credential: ${path}`);
}
console.log(`Repository portability checks passed for ${files.length} files. This is not a comprehensive secret audit.`);
