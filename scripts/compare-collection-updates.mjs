// Deterministic operation-count/correctness comparison, not a browser benchmark.
// npm run build && node scripts/compare-collection-updates.mjs [baseline-git-ref]
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
const directory = await mkdtemp(join(local, 'collection-comparison-'));
const modules = ['choice-grid/index', 'data-table/index', 'log/index', 'overflow-list/index', 'select/MultipleSelect', 'select/SearchableSelect', 'sortable/index', 'tag-input/index', 'tree-select/index', 'virtual-list/index'];
try {
  // Unchanged dependencies are identical in both runs. Only audited wrappers are
  // replaced with the integration baseline, keeping renderer changes isolated.
  await cp(join(root, 'packages/inkra/dist'), directory, { recursive: true });
  for (const module of modules) {
    const source = execFileSync('git', ['show', `${baseline}:packages/inkra/src/${module}.tsx`], { cwd: root, encoding: 'utf8' });
    const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
    await writeFile(join(directory, `${module}.js`), compiled.outputText);
  }
  console.log(`Node ${process.version}; baseline ${baseline}. Expected baseline regression failures are shown explicitly.`);
  const run = (name, moduleRoot) => {
    console.log(`\n=== ${name} ===`);
    return spawnSync(process.execPath, ['--test', 'packages/inkra/test/collection-updates-runtime.test.mjs', 'packages/inkra/test/collection-updates-ssr.test.mjs', 'packages/inkra/test/collection-wrappers-runtime.test.mjs'], {
      cwd: root, stdio: 'inherit', env: { ...process.env, INKRA_COLLECTION_DIST: moduleRoot }, timeout: 120000,
    });
  };
  const previous = run('Baseline wrappers', pathToFileURL(`${directory}/`).href);
  const current = run('Current wrappers', pathToFileURL(join(root, 'packages/inkra/dist/')).href);
  console.log(`Baseline exit ${previous.status}; current exit ${current.status}. These are synthetic component/model tests, not real-DOM or crash-reproduction results.`);
  if (previous.error) throw previous.error;
  if (current.error) throw current.error;
  process.exitCode = current.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
