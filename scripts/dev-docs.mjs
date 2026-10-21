import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const docs = resolve(root, process.env.INKRA_DOCS_DIR || 'apps/docs');
if (!existsSync(resolve(docs, 'package.json'))) {
  throw new Error('Docs are a separate repository. Set INKRA_DOCS_DIR to an inkrajs/docs checkout.');
}
const child = spawn('npm', ['run', 'dev', '--', '--port', '4180', ...process.argv.slice(2)], { cwd: docs, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
