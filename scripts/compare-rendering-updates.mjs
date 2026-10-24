// Replay focused component regressions with only the audited modules replaced.
// This checks operation counts and behavior, not browser performance.
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(new URL('../packages/inkra/package.json', import.meta.url));
const ts = require('typescript');
const root = fileURLToPath(new URL('../', import.meta.url));
// The audited checkpoint's tree identity survives reconstructed commit metadata.
// It is retained in the historical optimization ancestry; shallow clones must
// fetch that history or pass an available baseline ref explicitly.
const baseline = process.argv[2] ?? '4d8a261400ebb0cf55dcbdbc36c332d301519625';
try {
  execFileSync('git', ['cat-file', '-e', `${baseline}^{tree}`], { cwd: root, stdio: 'pipe' });
} catch {
  throw new Error(`Baseline tree ${baseline} is unavailable. Fetch the optimization history (unshallow if needed), or pass an explicit baseline ref. No comparison was run.`);
}
const local = join(root, 'packages/inkra/.local');
await mkdir(local, { recursive: true });
const directory = await mkdtemp(join(local, 'rendering-comparison-'));
const modules = ['overlay/themeBridge.tsx', 'dockable-panel/index.tsx', 'display/ProgressRing.tsx', 'pencil.ts', 'PencilText.tsx'];
const tests = ['overlay-performance', 'dockable-performance', 'progress-ring-performance', 'pencil-helper-performance', 'text-performance'];
try {
  const dist = join(directory, 'dist');
  await cp(join(root, 'packages/inkra/dist'), dist, { recursive: true });
  for (const module of modules) {
    const source = execFileSync('git', ['show', `${baseline}:packages/inkra/src/${module}`], { cwd: root, encoding: 'utf8' });
    const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
    await writeFile(join(dist, module.replace(/\.tsx?$/, '.js')), compiled.outputText);
  }
  for (const name of tests) {
    const source = await readFile(join(root, `packages/inkra/test/${name}.test.mjs`), 'utf8');
    await writeFile(join(directory, `${name}.test.mjs`), source.replaceAll("'../dist/", `'${pathToFileURL(`${dist}/`).href}`));
  }
  console.log(`Node ${process.version}; baseline ${baseline}. Expected baseline regression failures are shown explicitly.`);
  const run = (label, paths) => {
    console.log(`\n=== ${label} ===`);
    const result = spawnSync(process.execPath, ['--test', ...paths], { cwd: root, stdio: 'inherit', timeout: 120000 });
    if (result.error) throw result.error;
    return result.status;
  };
  const previous = run('Baseline components', tests.map(name => join(directory, `${name}.test.mjs`)));
  const current = run('Current components', tests.map(name => `packages/inkra/test/${name}.test.mjs`));
  console.log(`Baseline exit ${previous}; current exit ${current}. Simulated lifecycle/model evidence only, not crash reproduction.`);
  process.exitCode = current ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
