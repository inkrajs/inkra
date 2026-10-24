// Production package-consumer sizes, not isolated component implementation costs.
import { readFile, writeFile, mkdir, realpath, readdir } from 'node:fs/promises';
import { spawnSync, execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { benchmarkProvenance } from './benchmark-provenance.mjs';
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const script = fileURLToPath(import.meta.url);
const entry = resolve(repo, 'packages/inkra/dist/index.js');
const output = resolve(process.env.BUNDLE_OUTPUT || resolve(repo, '.local/component-bundles'));
const timeout = Number(process.env.BUNDLE_TIMEOUT_MS || 90000);
const heap = Number(process.env.BUNDLE_HEAP_MIB || 1536);
const external = id => /^(react|react-dom)(\/|$)/.test(id);
const require = createRequire(import.meta.url);
async function hashTree(path) {
  const records = [];
  async function walk(dir) { for (const ent of (await readdir(dir, {withFileTypes: true})).sort((a,b)=>a.name.localeCompare(b.name))) { const path = resolve(dir, ent.name); if (ent.isDirectory()) await walk(path); else if (ent.isFile()) records.push({file:relative(repo,path),sha256:createHash('sha256').update(await readFile(path)).digest('hex')}); } }
  await walk(path); return records;
}
async function installedVersion(name) {
  try { let dir = dirname(require.resolve(name)); while (dir !== dirname(dir)) { try { const p = JSON.parse(await readFile(resolve(dir,'package.json'),'utf8')); if (p.name === name) return p.version; } catch {} dir = dirname(dir); } } catch {} return null;
}
const clean = id => id.startsWith(repo) ? relative(repo, id) : id;
if (process.argv[2] === '--case') {
  const id = process.argv[3];
  const vite = await import(process.env.VITE_MODULE ? pathToFileURL(resolve(process.env.VITE_MODULE)).href : 'vite');
  const parts = id.split('.');
  if (!['__baseline__', '__unused__'].includes(id) && !parts.every(p => /^[A-Za-z_$][\w$]*$/.test(p))) throw new Error('Invalid export identity');
  const source = id === '__baseline__' ? 'globalThis.__inkraBundleBenchmark = null;' : id === '__unused__'
    ? `import * as unused from ${JSON.stringify(entry)}; globalThis.__inkraBundleBenchmark = null;`
    : `import { ${parts[0]} as component } from ${JSON.stringify(entry)}; globalThis.__inkraBundleBenchmark = component${parts.slice(1).map(p => '.' + p).join('')};`;
  const warnings = [];
  const result = await vite.build({
    configFile: false, root: repo, logLevel: 'silent', mode: 'production',
    plugins: [{ name: 'minimal-consumer', resolveId(id) { if (id === 'virtual:inkra-consumer') return '\0inkra-consumer'; }, load(id) { if (id === '\0inkra-consumer') return source; } }],
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, emptyOutDir: false, minify: 'oxc', target: 'es2020', sourcemap: false, cssCodeSplit: true,
      rolldownOptions: { input: 'virtual:inkra-consumer', external, onwarn(w) { warnings.push({ code: w.code, message: w.message.replace(/\x1b\[[0-9;]*m/g, '').split('\n')[0] }); }, output: { format: 'es', entryFileNames: 'entry.js', chunkFileNames: 'chunks/[name]-[hash].js', assetFileNames: 'assets/[name]-[hash][extname]' } } }
  });
  const emitted = (Array.isArray(result) ? result : [result]).flatMap(r => r.output);
  const files = emitted.map(f => {
    const bytes = Buffer.from(f.type === 'chunk' ? f.code : f.source);
    return { file: f.fileName, kind: f.type === 'chunk' ? 'javascript' : f.fileName.endsWith('.css') ? 'css' : 'asset', rawBytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length,
      sha256: createHash('sha256').update(bytes).digest('hex'), ...(f.type === 'chunk' ? { isEntry: f.isEntry, imports: f.imports, dynamicImports: f.dynamicImports, modules: Object.entries(f.modules).map(([name,m]) => ({ id: clean(name), renderedLength: m.renderedLength ?? null, originalLength: m.originalLength ?? null })) } : {}) };
  });
  const sums = kind => files.filter(f => !kind || f.kind === kind).reduce((a,f) => ({ rawBytes: a.rawBytes+f.rawBytes, gzipBytes: a.gzipBytes+f.gzipBytes }), { rawBytes: 0, gzipBytes: 0 });
  const names = new Set(files.map(f => f.file));
  const externals = [...new Set(files.flatMap(f => [...f.imports || [], ...f.dynamicImports || []]).filter(i => !names.has(i)))];
  const unexpectedExternals = externals.filter(i => !external(i));
  if (unexpectedExternals.length) throw new Error(`Unexpected external dependencies: ${unexpectedExternals}`);
  console.log(JSON.stringify({ id, status: 'measured', vite: vite.version, source, totals: sums(), javascript: sums('javascript'), css: sums('css'), assets: sums('asset'), files, externals, warnings, maxRssKiB: process.resourceUsage().maxRSS }));
} else {
  await mkdir(output, { recursive: true });
  const inventoryPath = resolve(process.env.BUNDLE_INVENTORY || resolve(repo, 'docs/component-performance-inventory.json'));
  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  const selected = inventory.components.filter(c => !process.env.BUNDLE_FILTER || process.env.BUNDLE_FILTER.split(',').includes(c.component));
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), ...benchmarkProvenance(repo), packageEntry: await realpath(entry), packageEntrySha256: createHash('sha256').update(await readFile(entry)).digest('hex'), environment: { node: process.version, platform: process.platform, arch: process.arch }, method: { production: true, format: 'es', target: 'es2020', minifier: 'oxc', gzipLevel: 9, serial: true, timeoutMs: timeout, maxOldSpaceMiB: heap, peerExternals: ['react', 'react/*', 'react-dom', 'react-dom/*'], vendorDependencies: 'All other transitive runtime dependencies bundled.', importStyle: process.env.BUNDLE_IMPORT_STYLE || 'canonical', attribution: 'Each canonical inventory identity independently retained through a global property assignment from the package root. Compound properties can retain sibling implementations. This is incremental standalone consumer payload including shared dependencies, NOT isolated component own bytes.', closure: 'All emitted JS chunks including lazy chunks counted once; raw/gzip summed per file. This is complete emitted closure, not initial network transfer. React peer payload excluded.', css: 'Only CSS imported by the JS graph is counted; separately imported package styles.css and tokens.css are not automatically charged. Their raw/gzip sizes are reported separately.', treeShaking: 'Baseline compared against unused namespace import of the complete package root. Per-case emitted module graph shows retained reachability, not proof of runtime code coverage.', limitations: 'No browser execution, parsing/evaluation timing, network latency, runtime memory, LCP, INP or CLS measured. Size results depend on bundler, target, minifier, import shape, dependency versions, and app deduplication.' }, packageCss: [], controls: [], results: [] };
  report.sourceFiles = await hashTree(resolve(repo,'packages/inkra/src'));
  report.compiledFiles = await hashTree(resolve(repo,'packages/inkra/dist'));
  const pkg = JSON.parse(await readFile(resolve(repo,'packages/inkra/package.json'),'utf8'));
  report.environment.dependencies = Object.fromEntries(await Promise.all([...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)].map(async name=>[name,await installedVersion(name)])));
  for (const name of ['styles.css', 'tokens.css']) {
    try { const bytes = await readFile(resolve(repo,'packages/inkra/dist',name)); report.packageCss.push({ file: name, rawBytes: bytes.length, gzipBytes: gzipSync(bytes,{level:9}).length }); } catch (error) { report.packageCss.push({ file: name, status:'unavailable', reason: String(error) }); }
  }
  const cssText = await readFile(resolve(repo,'packages/inkra/dist/styles.css'),'utf8');
  report.packageCssRelationship = 'styles.css imports tokens.css. Source CSS sizes are unminified published files, not a Vite-processed app CSS build. Referenced assets below are optional/on-demand depending on actual font and Leaflet styles used; do not add them unconditionally to initial transfer.';
  report.packageCssAssets = [];
  for (const asset of [...new Set([...cssText.matchAll(/url\(\s*[\"']?([^\"'\s)]+)[\"']?\s*\)/g)].map(m=>m[1]))].filter(a=>!a.startsWith('#')&&!a.startsWith('data:'))) {
    try { const bytes=await readFile(resolve(repo,'packages/inkra/dist',asset)); report.packageCssAssets.push({file:asset,rawBytes:bytes.length,gzipBytes:gzipSync(bytes,{level:9}).length}); } catch(error) {report.packageCssAssets.push({file:asset,status:'unavailable',reason:String(error)});}
  }
  if (process.env.VITE_MODULE) { const vr=createRequire(pathToFileURL(resolve(process.env.VITE_MODULE))); try {report.environment.rolldown=vr('rolldown/package.json').version;} catch {} }
  const ids = ['__baseline__', '__unused__', ...selected.map(c => c.component)];
  for (const id of ids) {
    const identity = selected.find(c=>c.component===id);
    const importIdentity = process.env.BUNDLE_IMPORT_STYLE === 'named' && identity ? identity.aliases.find(alias=>!alias.includes('.')) : id;
    if (!importIdentity) { report.results.push({id,status:'blocked',reason:'No named alias in inventory',aliases:identity.aliases}); continue; }
    const child = spawnSync(process.execPath, [`--max-old-space-size=${heap}`,script,'--case',importIdentity], { cwd: repo, encoding:'utf8', timeout, maxBuffer: 64*1024*1024, env: {...process.env,NODE_ENV:'production'} });
    let result;
    try { if (child.status !== 0) throw new Error(child.error?.message || `exit=${child.status}, signal=${child.signal}`); result = JSON.parse(child.stdout.trim()); result.importIdentity = importIdentity; result.id = id; }
    catch (error) { result = { id, status: child.error?.code === 'ETIMEDOUT' ? 'timeout' : 'failed', reason: String(error), stderr: child.stderr?.slice(-8000) }; }
    if (id.startsWith('__')) report.controls.push(result);
    else { const identity = selected.find(c => c.component === id); report.results.push({...result, aliases: identity.aliases, group: identity.group}); }
    await writeFile(resolve(output,'bundle-results.json'), JSON.stringify(report,null,2)+'\n');
    console.log(`${id}: ${result.status}${result.totals ? ` ${result.totals.rawBytes} raw / ${result.totals.gzipBytes} gzip` : ''}`);
  }
  const baseline = report.controls.find(c => c.id === '__baseline__'), unused = report.controls.find(c => c.id === '__unused__');
  report.treeShaking = baseline?.status === 'measured' && unused?.status === 'measured' ? { status: 'measured', unusedMinusBaselineRaw: unused.totals.rawBytes - baseline.totals.rawBytes, unusedMinusBaselineGzip: unused.totals.gzipBytes - baseline.totals.gzipBytes, identicalOutputHashes: JSON.stringify(baseline.files.map(f=>f.sha256)) === JSON.stringify(unused.files.map(f=>f.sha256)), retainedUnusedModules: unused.files.flatMap(f=>f.modules || []).map(m=>m.id) } : {status:'blocked'};
  for (const result of report.results) if (result.status === 'measured' && baseline?.status === 'measured') result.consumerMinusBaseline = { rawBytes: result.totals.rawBytes-baseline.totals.rawBytes, gzipBytes:result.totals.gzipBytes-baseline.totals.gzipBytes };
  report.coverage = { inventoryTotal: inventory.components.length, selected: selected.length, measured: report.results.filter(r=>r.status === 'measured').length, failures: report.results.filter(r=>r.status !== 'measured').map(r=>r.id) };
  await writeFile(resolve(output,'bundle-results.json'), JSON.stringify(report,null,2)+'\n');
  if (report.coverage.failures.length || report.treeShaking.status === 'blocked') process.exitCode=1;
}
