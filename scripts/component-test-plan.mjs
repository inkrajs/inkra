import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { posix, resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(new URL('../packages/inkra/package.json', import.meta.url));
const ts = require('typescript');

export const PLAN_SCHEMA = 'inkra-component-tests/v1';
const SOURCE_ROOT = 'packages/inkra/src/';
const TEST_ROOT = 'packages/inkra/test/';
const TEST_PATTERN = /^packages\/inkra\/test\/[^/]+\.test\.mjs$/;
const SOURCE_PATTERN = /^packages\/inkra\/src\/.*\.(?:tsx?|css)$/;
const SCRIPT_EXTENSIONS = /\.(?:m?[jt]sx?)$/;

const FULL_FALLBACK_PATTERNS = [
  /^package-lock\.json$/,
  /^package\.json$/,
  /^packages\/inkra\/package\.json$/,
  /^packages\/inkra\/tsconfig\.json$/,
  /^packages\/inkra\/scripts\//,
  /^\.github\/workflows\//,
  /(^|\/)(?:tsconfig|vite|eslint|prettier|rollup|webpack|babel|vitest|jest)(?:\.|$)/,
];

const GLOBAL_SOURCE_FILES = new Set([
  'packages/inkra/src/index.ts',
  'packages/inkra/src/styles.css',
  'packages/inkra/src/tokens.css',
]);

function git(root, args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

function normalize(path) {
  const normalized = posix.normalize(path.replaceAll('\\', '/')).replace(/^\.\//, '');
  if (!normalized || normalized.startsWith('/') || normalized === '..' || normalized.startsWith('../') || normalized.includes('\0') || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`Unsafe repository path: ${JSON.stringify(path)}`);
  }
  return normalized;
}

function sorted(values) {
  return [...new Set(values)].sort();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalPlanDigest(plan) {
  const copy = structuredClone(plan);
  delete copy.planSha256;
  return sha256(JSON.stringify(copy));
}

export function sealPlan(plan) {
  plan.planSha256 = canonicalPlanDigest(plan);
  return plan;
}

function snapshotPaths(root, ref) {
  return git(root, ['ls-tree', '-r', '--name-only', '-z', ref])
    .split('\0')
    .filter(Boolean)
    .map(normalize);
}

function snapshotReader(root, ref, availablePaths) {
  const cache = new Map();
  return path => {
    path = normalize(path);
    if (!availablePaths.has(path)) return null;
    if (!cache.has(path)) cache.set(path, git(root, ['show', `${ref}:${path}`]));
    return cache.get(path);
  };
}

function scriptKind(path) {
  if (path.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (path.endsWith('.ts')) return ts.ScriptKind.TS;
  if (path.endsWith('.jsx')) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function ast(path, source) {
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, scriptKind(path));
}

function sourceCandidates(path) {
  const extension = posix.extname(path);
  const base = extension ? path.slice(0, -extension.length) : path;
  const candidates = [path];
  if (extension === '.js' || extension === '.jsx' || extension === '.mjs' || !extension) {
    candidates.push(`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`);
  }
  if (extension === '.css') candidates.push(path);
  return sorted(candidates.map(normalize));
}

function distToSource(path) {
  path = normalize(path);
  const distPrefix = 'packages/inkra/dist/';
  if (!path.startsWith(distPrefix)) return [path];
  const relative = path.slice(distPrefix.length);
  if (relative === 'styles.css') return ['packages/inkra/src/styles.css'];
  if (relative === 'tokens.css') return ['packages/inkra/src/tokens.css'];
  if (relative.startsWith('styles/') && relative.endsWith('.css')) {
    const name = relative.slice('styles/'.length, -'.css'.length);
    if (name === 'base') return ['packages/inkra/src/styles.css'];
    if (name === 'leaflet') return ['packages/inkra/src/journey-map/styles.css'];
    return [`packages/inkra/src/${name}/styles.css`];
  }
  return sourceCandidates(`packages/inkra/src/${relative}`);
}

function resolveSourcePath(importer, specifier, sourcePaths) {
  if (!specifier.startsWith('.')) return [];
  const resolved = normalize(posix.join(posix.dirname(importer), specifier));
  const candidates = resolved.startsWith('packages/inkra/dist/')
    ? distToSource(resolved)
    : sourceCandidates(resolved);
  return sorted(candidates.filter(candidate => sourcePaths.has(candidate)));
}

function exportedDeclarationNames(node) {
  if (!node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) return [];
  if (node.name && ts.isIdentifier(node.name)) return [node.name.text];
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations.flatMap(declaration => ts.isIdentifier(declaration.name) ? [declaration.name.text] : []);
  }
  return [];
}

function analyzeSourceSnapshot(paths, read) {
  paths = [...paths];
  const sourcePaths = new Set(paths.filter(path => SOURCE_PATTERN.test(path)));
  const dependencies = new Map();
  const reexports = new Map();
  const localExports = new Map();
  const importBindings = new Map();
  const unresolved = [];

  for (const path of sourcePaths) {
    if (!SCRIPT_EXTENSIONS.test(path)) continue;
    const source = read(path);
    const file = ast(path, source);
    const imports = new Set();
    const exportEdges = [];
    const names = new Set();
    const bindings = new Map();

    for (const statement of file.statements) {
      for (const name of exportedDeclarationNames(statement)) names.add(name);
      if (ts.isExportAssignment(statement)) names.add('default');
      if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)) {
        const specifier = statement.moduleSpecifier.text;
        const targets = resolveSourcePath(path, specifier, sourcePaths);
        if (specifier.startsWith('.') && targets.length === 0) unresolved.push(`${path}: ${specifier}`);
        for (const target of targets) {
          imports.add(target);
          const clause = statement.importClause;
          if (!clause) continue;
          if (clause.name) bindings.set(clause.name.text, { imported: 'default', target });
          if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
            for (const element of clause.namedBindings.elements) {
              bindings.set(element.name.text, { imported: element.propertyName?.text ?? element.name.text, target });
            }
          } else if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
            bindings.set(clause.namedBindings.name.text, { imported: '*', target });
          }
        }
      }
      if (ts.isExportDeclaration(statement)) {
        if (!statement.moduleSpecifier || !ts.isStringLiteralLike(statement.moduleSpecifier)) {
          if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
            for (const element of statement.exportClause.elements) {
              const localName = element.propertyName?.text ?? element.name.text;
              const binding = bindings.get(localName);
              if (binding) exportEdges.push({ exported: element.name.text, ...binding });
              else names.add(element.name.text);
            }
          }
          continue;
        }
        const specifier = statement.moduleSpecifier.text;
        const targets = resolveSourcePath(path, specifier, sourcePaths);
        if (specifier.startsWith('.') && targets.length === 0) unresolved.push(`${path}: ${specifier}`);
        for (const target of targets) {
          imports.add(target);
          if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
            for (const element of statement.exportClause.elements) {
              exportEdges.push({ exported: element.name.text, imported: element.propertyName?.text ?? element.name.text, target });
            }
          } else {
            exportEdges.push({ exported: '*', imported: '*', target });
          }
        }
      }
    }
    function visitDynamicImport(node) {
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const specifier = node.arguments.length ? staticText(node.arguments[0]) : null;
        if (specifier?.startsWith('.')) {
          const targets = resolveSourcePath(path, specifier, sourcePaths);
          if (targets.length === 0) unresolved.push(`${path}: dynamic ${specifier}`);
          for (const target of targets) imports.add(target);
        } else if (!specifier) {
          unresolved.push(`${path}: non-literal dynamic import`);
        }
        return;
      }
      ts.forEachChild(node, visitDynamicImport);
    }
    visitDynamicImport(file);
    dependencies.set(path, imports);
    reexports.set(path, exportEdges);
    localExports.set(path, names);
    importBindings.set(path, bindings);
  }

  const exportCache = new Map();
  function exportsOf(path, stack = new Set()) {
    if (exportCache.has(path)) return exportCache.get(path);
    if (stack.has(path)) return new Map();
    const nextStack = new Set(stack).add(path);
    const result = new Map();
    for (const name of localExports.get(path) ?? []) result.set(name, new Set([path]));
    for (const edge of reexports.get(path) ?? []) {
      const targetExports = exportsOf(edge.target, nextStack);
      if (edge.exported === '*') {
        for (const [name, origins] of targetExports) {
          if (name === 'default') continue;
          if (!result.has(name)) result.set(name, new Set());
          for (const origin of origins) result.get(name).add(origin);
        }
      } else {
        const origins = targetExports.get(edge.imported) ?? new Set([edge.target]);
        if (!result.has(edge.exported)) result.set(edge.exported, new Set());
        for (const origin of origins) result.get(edge.exported).add(origin);
      }
    }
    exportCache.set(path, result);
    return result;
  }
  for (const path of sourcePaths) exportsOf(path);

  return { dependencies, exportsOf, sourcePaths, unresolved };
}

function mergeReverseGraphs(...snapshots) {
  const reverse = new Map();
  for (const snapshot of snapshots) {
    for (const [consumer, dependencies] of snapshot.dependencies) {
      for (const dependency of dependencies) {
        if (!reverse.has(dependency)) reverse.set(dependency, new Set());
        reverse.get(dependency).add(consumer);
      }
    }
  }
  return reverse;
}

function importedNames(node) {
  const clause = node.importClause;
  if (!clause) return { names: [], namespace: true };
  const names = [];
  if (clause.name) names.push('default');
  if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
    for (const element of clause.namedBindings.elements) names.push(element.propertyName?.text ?? element.name.text);
  }
  return { names, namespace: Boolean(clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) };
}

function staticText(node) {
  return ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;
}

function templatePattern(node) {
  if (!ts.isTemplateExpression(node)) return null;
  let value = node.head.text;
  for (const span of node.templateSpans) value += '*' + span.literal.text;
  return value;
}

function globSourcePattern(importer, pattern, sourcePaths) {
  const resolved = normalize(posix.join(posix.dirname(importer), pattern));
  const sourcePattern = resolved.startsWith('packages/inkra/dist/')
    ? normalize(distToSource(resolved.replaceAll('*', '__INKRA_WILDCARD__'))[0]).replaceAll('__INKRA_WILDCARD__', '*')
    : resolved;
  const regex = new RegExp(`^${sourcePattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return sorted([...sourcePaths].filter(path => regex.test(path)));
}

function analyzeCoverageFile(path, source, sourceSnapshot, allSnapshotPaths) {
  const dependencies = new Set();
  const fixtureDependencies = new Set();
  const notes = [];
  let dynamicSourceReference = false;
  const file = ast(path, source);
  const urlBases = new Map();

  function addSpecifier(specifier, names = [], namespace = false, rootDynamic = true) {
    if (!specifier.startsWith('.')) return;
    const resolved = normalize(posix.join(posix.dirname(path), specifier));
    if (resolved.startsWith(TEST_ROOT)) {
      let found = false;
      for (const candidate of sourceCandidates(resolved)) {
        if (allSnapshotPaths.has(candidate)) {
          fixtureDependencies.add(candidate);
          found = true;
        }
      }
      if (!found) {
        dynamicSourceReference = true;
        notes.push(`unresolved test helper ${specifier}`);
      }
      return;
    }
    const targets = resolveSourcePath(path, specifier, sourceSnapshot.sourcePaths);
    const rootIndex = targets.find(target => target === 'packages/inkra/src/index.ts');
    if (!rootIndex) {
      for (const target of targets) dependencies.add(target);
      return;
    }
    if (rootDynamic && (namespace || names.length === 0)) {
      dependencies.add(rootIndex);
      dynamicSourceReference = true;
      notes.push('root entrypoint namespace or dynamic import');
      return;
    }
    if (!rootDynamic && names.length === 0) {
      dependencies.add(rootIndex);
      return;
    }
    const rootExports = sourceSnapshot.exportsOf(rootIndex);
    for (const name of names) {
      const origins = rootExports.get(name);
      if (!origins) {
        dynamicSourceReference = true;
        notes.push(`unresolved root export ${name}`);
        continue;
      }
      for (const origin of origins) dependencies.add(origin);
    }
  }

  function addPathText(value) {
    if (!value?.startsWith('.')) return;
    if (/[\u0000-\u001f\u007f]/.test(value)) return;
    const joined = posix.join(posix.dirname(path), value);
    if (/^\.\/?$/.test(joined) || joined === '..' || joined.startsWith('../') || joined.startsWith('/')) return;
    const resolved = normalize(joined);
    if (resolved.startsWith(TEST_ROOT)) {
      let found = false;
      for (const candidate of sourceCandidates(resolved)) {
        if (allSnapshotPaths.has(candidate)) {
          fixtureDependencies.add(candidate);
          found = true;
        }
      }
      if (!found && value.includes('fixture')) {
        dynamicSourceReference = true;
        notes.push(`unresolved test helper path ${value}`);
      }
      return;
    }
    if (!value.includes('../src/') && !value.includes('../dist/')) return;
    if (value.endsWith('/src/') || value.endsWith('/dist/')) return;
    if (value.includes('*')) {
      const targets = globSourcePattern(path, value, sourceSnapshot.sourcePaths);
      for (const target of targets) dependencies.add(target);
      if (targets.length === 0) dynamicSourceReference = true;
      return;
    }
    addSpecifier(value, [], false, false);
  }

  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      let initializer = declaration.initializer;
      if (ts.isPropertyAccessExpression(initializer) && initializer.name.text === 'href') initializer = initializer.expression;
      if (ts.isNewExpression(initializer) && initializer.expression.getText(file) === 'URL' && initializer.arguments?.length) {
        const value = staticText(initializer.arguments[0]);
        if (value) urlBases.set(declaration.name.text, value);
      }
    }
  }

  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const shape = importedNames(node);
      addSpecifier(node.moduleSpecifier.text, shape.names, shape.namespace);
      return;
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const value = node.arguments.length ? staticText(node.arguments[0]) : null;
      if (value) addSpecifier(value, [], true);
      else dynamicSourceReference = true;
      return;
    } else if (ts.isNewExpression(node) && node.expression.getText(file) === 'URL' && node.arguments?.length) {
      const first = staticText(node.arguments[0]) ?? templatePattern(node.arguments[0]);
      if (first) {
        if (node.arguments[1] && ts.isIdentifier(node.arguments[1]) && urlBases.has(node.arguments[1].text)) {
          addPathText(posix.join(urlBases.get(node.arguments[1].text), first));
        } else {
          addPathText(first);
        }
      } else if (node.getText(file).includes('src') || node.getText(file).includes('dist')) {
        dynamicSourceReference = true;
      }
      return;
    } else if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      addPathText(node.text);
      return;
    } else if (ts.isTemplateExpression(node)) {
      addPathText(templatePattern(node));
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(file);

  return { dependencies, dynamicSourceReference, fixtureDependencies, notes: sorted(notes) };
}

function analyzeTests(paths, read, sourceSnapshot) {
  paths = [...paths];
  const allPaths = new Set(paths);
  const tests = sorted(paths.filter(path => TEST_PATTERN.test(path)));
  const coverage = new Map();
  const fixtureConsumers = new Map();
  const alwaysRun = new Map();
  const helperCache = new Map();

  function helperCoverage(path, stack = new Set()) {
    if (helperCache.has(path)) return helperCache.get(path);
    if (stack.has(path)) return { dependencies: new Set(), dynamicSourceReference: true, fixtures: new Set([path]), notes: [`cyclic test helper ${path}`] };
    const direct = analyzeCoverageFile(path, read(path), sourceSnapshot, allPaths);
    const result = {
      dependencies: new Set(direct.dependencies),
      dynamicSourceReference: direct.dynamicSourceReference,
      fixtures: new Set([path, ...direct.fixtureDependencies]),
      notes: [...direct.notes],
    };
    const nextStack = new Set(stack).add(path);
    for (const child of direct.fixtureDependencies) {
      const nested = helperCoverage(child, nextStack);
      for (const dependency of nested.dependencies) result.dependencies.add(dependency);
      for (const fixture of nested.fixtures) result.fixtures.add(fixture);
      result.dynamicSourceReference ||= nested.dynamicSourceReference;
      result.notes.push(...nested.notes);
    }
    result.notes = sorted(result.notes);
    helperCache.set(path, result);
    return result;
  }

  for (const test of tests) {
    const direct = analyzeCoverageFile(test, read(test), sourceSnapshot, allPaths);
    const dependencies = new Set(direct.dependencies);
    const fixtures = new Set(direct.fixtureDependencies);
    const notes = [...direct.notes];
    let dynamicSourceReference = direct.dynamicSourceReference;
    for (const fixture of direct.fixtureDependencies) {
      const nested = helperCoverage(fixture);
      for (const dependency of nested.dependencies) dependencies.add(dependency);
      for (const child of nested.fixtures) fixtures.add(child);
      dynamicSourceReference ||= nested.dynamicSourceReference;
      notes.push(...nested.notes);
    }
    coverage.set(test, dependencies);
    for (const fixture of fixtures) {
      if (!fixtureConsumers.has(fixture)) fixtureConsumers.set(fixture, new Set());
      fixtureConsumers.get(fixture).add(test);
    }
    if (dynamicSourceReference) {
      alwaysRun.set(test, notes.length ? sorted(notes) : ['unresolved dynamic source or dist reference']);
    }
  }
  return { alwaysRun, coverage, fixtureConsumers, tests };
}

function parseChangedEntries(root, base, head) {
  const fields = git(root, ['diff', '--name-status', '-z', '--find-renames', base, head]).split('\0');
  const entries = [];
  for (let index = 0; index < fields.length - 1;) {
    const status = fields[index++];
    if (!status) break;
    if (status.startsWith('R') || status.startsWith('C')) {
      entries.push({ status: status[0], score: Number(status.slice(1)), oldPath: normalize(fields[index++]), path: normalize(fields[index++]) });
    } else {
      entries.push({ status: status[0], path: normalize(fields[index++]) });
    }
  }
  return entries;
}

function reason(code, detail, files = []) {
  return { code, detail, files: sorted(files) };
}

function inventoryHash(read, tests) {
  return sha256(tests.map(path => `${path}\0${sha256(read(path))}`).join('\0'));
}

function componentName(path) {
  if (!path.startsWith(SOURCE_ROOT)) return null;
  const relative = path.slice(SOURCE_ROOT.length);
  const first = relative.split('/')[0];
  return first.includes('.') ? first.replace(/\.(?:tsx?|css)$/, '') : first;
}

export function createPlanFromEntries({
  base,
  basePaths,
  baseRead,
  changedEntries,
  requestedHead,
  testedRevision,
  headPaths,
  headRead,
}) {
  const reasons = [];
  const fullFiles = [];
  for (const entry of changedEntries) {
    if (entry.status === 'D' || entry.status === 'R') {
      reasons.push(reason('deleted-or-renamed', 'Deleted and renamed paths use full coverage because old ownership may no longer be reconstructable safely.', [entry.oldPath, entry.path].filter(Boolean)));
    }
    const path = entry.path;
    if (FULL_FALLBACK_PATTERNS.some(pattern => pattern.test(path))) fullFiles.push(path);
    else if (GLOBAL_SOURCE_FILES.has(path)) reasons.push(reason('shared-global-source', 'The public barrel, global styles or tokens affect every component or exported contract.', [path]));
    else if (SOURCE_PATTERN.test(path) || TEST_PATTERN.test(path) || path.startsWith(`${TEST_ROOT}fixtures/`)) {
      // Handled by graph selection below.
    } else {
      reasons.push(reason('unknown-change', 'The changed path has no proven component-test ownership.', [path]));
    }
  }
  if (fullFiles.length) reasons.push(reason('configuration-or-build-change', 'Package, lockfile, compiler, workflow or build-tool changes require full component coverage.', fullFiles));

  const hasSourceChanges = changedEntries.some(entry => SOURCE_PATTERN.test(entry.path));
  const headSource = analyzeSourceSnapshot(headPaths, headRead);
  const baseSource = analyzeSourceSnapshot(basePaths, baseRead);
  if (hasSourceChanges && (headSource.unresolved.length || baseSource.unresolved.length)) {
    reasons.push(reason('unresolved-source-edge', 'A relative source import or re-export could not be resolved.', [...headSource.unresolved, ...baseSource.unresolved]));
  }
  const tests = analyzeTests(headPaths, headRead, headSource);
  const full = reasons.length > 0;
  const selected = new Set();
  const changedTests = changedEntries.filter(entry => TEST_PATTERN.test(entry.path)).map(entry => entry.path);
  for (const test of changedTests) if (tests.tests.includes(test)) selected.add(test);
  if (hasSourceChanges) for (const [test] of tests.alwaysRun) selected.add(test);

  const changedFixtures = changedEntries.filter(entry => entry.path.startsWith(`${TEST_ROOT}fixtures/`)).map(entry => entry.path);
  for (const fixture of changedFixtures) {
    const consumers = tests.fixtureConsumers.get(fixture);
    if (!consumers?.size) {
      reasons.push(reason('unmapped-test-fixture', 'A changed test fixture has no statically known consumer.', [fixture]));
    } else {
      for (const test of consumers) selected.add(test);
    }
  }

  const seeds = new Set();
  for (const entry of changedEntries) {
    if (!SOURCE_PATTERN.test(entry.path)) continue;
    seeds.add(entry.path);
    if (entry.path.endsWith('.css') || entry.path.endsWith('.d.ts')) {
      const directory = posix.dirname(entry.path);
      for (const sourcePath of headSource.sourcePaths) if (posix.dirname(sourcePath) === directory) seeds.add(sourcePath);
      for (const sourcePath of baseSource.sourcePaths) if (posix.dirname(sourcePath) === directory) seeds.add(sourcePath);
    }
  }
  const affected = new Set(seeds);
  const reverse = mergeReverseGraphs(baseSource, headSource);
  const queue = [...seeds];
  while (queue.length) {
    const dependency = queue.shift();
    for (const consumer of reverse.get(dependency) ?? []) {
      if (affected.has(consumer)) continue;
      affected.add(consumer);
      queue.push(consumer);
    }
  }
  for (const [test, dependencies] of tests.coverage) {
    if ([...dependencies].some(dependency => affected.has(dependency))) selected.add(test);
  }

  const finalFull = full || reasons.some(item => ['unmapped-test-fixture', 'unresolved-source-edge'].includes(item.code));
  if (finalFull) for (const test of tests.tests) selected.add(test);
  const selectedTests = sorted(selected);
  const skippedTests = tests.tests.filter(test => !selected.has(test));
  const plan = {
    schema: PLAN_SCHEMA,
    base,
    requestedHead: requestedHead ?? testedRevision,
    testedRevision,
    mergePreview: Boolean(requestedHead && requestedHead !== testedRevision),
    comparison: `${base}..${testedRevision}`,
    mode: finalFull ? 'full' : 'incremental',
    reasons,
    changedFiles: changedEntries.map(entry => ({ ...entry })),
    affectedSourceFiles: sorted(affected),
    affectedComponents: sorted([...affected].map(componentName).filter(Boolean)),
    alwaysRunTests: [...tests.alwaysRun].map(([path, why]) => ({ path, reasons: why })),
    selectedTests,
    skippedTests,
    counts: { total: tests.tests.length, selected: selectedTests.length, skipped: skippedTests.length },
    testInventorySha256: inventoryHash(headRead, tests.tests),
  };
  return sealPlan(plan);
}

export function planComponentTests({ root, base, requestedHead, testedRevision = 'HEAD' }) {
  root = resolvePath(root);
  let resolvedBase;
  let resolvedHead;
  try {
    resolvedBase = git(root, ['rev-parse', '--verify', `${base}^{commit}`]).trim();
    resolvedHead = git(root, ['rev-parse', '--verify', `${testedRevision}^{commit}`]).trim();
  } catch (error) {
    const currentHead = git(root, ['rev-parse', 'HEAD']).trim();
    const headPaths = new Set(snapshotPaths(root, currentHead));
    const headRead = snapshotReader(root, currentHead, headPaths);
    const source = analyzeSourceSnapshot(headPaths, headRead);
    const tests = analyzeTests(headPaths, headRead, source);
    const selectedTests = tests.tests;
    const plan = {
      schema: PLAN_SCHEMA,
      base,
      requestedHead: requestedHead ?? testedRevision,
      testedRevision: currentHead,
      mergePreview: Boolean(requestedHead && requestedHead !== currentHead),
      comparison: null,
      mode: 'full',
      reasons: [reason('missing-history', 'The requested base or head commit is unavailable locally, so all component tests are selected.')],
      changedFiles: [],
      affectedSourceFiles: [],
      affectedComponents: [],
      alwaysRunTests: [...tests.alwaysRun].map(([path, why]) => ({ path, reasons: why })),
      selectedTests,
      skippedTests: [],
      counts: { total: selectedTests.length, selected: selectedTests.length, skipped: 0 },
      testInventorySha256: inventoryHash(headRead, tests.tests),
    };
    return sealPlan(plan);
  }
  let resolvedRequestedHead = requestedHead ?? resolvedHead;
  let requestedHeadReason = null;
  if (requestedHead) {
    try {
      resolvedRequestedHead = git(root, ['rev-parse', '--verify', `${requestedHead}^{commit}`]).trim();
    } catch {
      requestedHeadReason = reason('missing-requested-head', 'The requested PR head commit is unavailable locally, so the tested tree cannot be proven to include it.', [requestedHead]);
    }
  }
  if (!requestedHeadReason && resolvedRequestedHead !== resolvedHead) {
    const requestedInTested = spawnSync('git', ['merge-base', '--is-ancestor', resolvedRequestedHead, resolvedHead], { cwd: root });
    if (requestedInTested.status !== 0) {
      requestedHeadReason = reason('requested-head-not-tested', 'The requested PR head is not an ancestor of the tested revision, so this checkout cannot represent that PR head or its merge preview.', [resolvedRequestedHead, resolvedHead]);
    }
  }
  if (requestedHeadReason) {
    const headPaths = new Set(snapshotPaths(root, resolvedHead));
    const headRead = snapshotReader(root, resolvedHead, headPaths);
    const source = analyzeSourceSnapshot(headPaths, headRead);
    const tests = analyzeTests(headPaths, headRead, source);
    return sealPlan({
      schema: PLAN_SCHEMA,
      base: resolvedBase,
      requestedHead: resolvedRequestedHead,
      testedRevision: resolvedHead,
      mergePreview: true,
      comparison: `${resolvedBase}..${resolvedHead}`,
      mode: 'full',
      reasons: [requestedHeadReason],
      changedFiles: [], affectedSourceFiles: [], affectedComponents: [],
      alwaysRunTests: [...tests.alwaysRun].map(([path, why]) => ({ path, reasons: why })),
      selectedTests: tests.tests, skippedTests: [],
      counts: { total: tests.tests.length, selected: tests.tests.length, skipped: 0 },
      testInventorySha256: inventoryHash(headRead, tests.tests),
    });
  }
  const ancestor = spawnSync('git', ['merge-base', '--is-ancestor', resolvedBase, resolvedHead], { cwd: root });
  if (ancestor.status !== 0) {
    const headPaths = new Set(snapshotPaths(root, resolvedHead));
    const headRead = snapshotReader(root, resolvedHead, headPaths);
    const source = analyzeSourceSnapshot(headPaths, headRead);
    const tests = analyzeTests(headPaths, headRead, source);
    const plan = {
      schema: PLAN_SCHEMA,
      base: resolvedBase,
      requestedHead: resolvedRequestedHead,
      testedRevision: resolvedHead,
      mergePreview: resolvedRequestedHead !== resolvedHead,
      comparison: `${resolvedBase}..${resolvedHead}`,
      mode: 'full',
      reasons: [reason('non-ancestor-base', 'The exact base is not an ancestor of head, so the requested comparison is not a safe PR range.')],
      changedFiles: [], affectedSourceFiles: [], affectedComponents: [],
      alwaysRunTests: [...tests.alwaysRun].map(([path, why]) => ({ path, reasons: why })),
      selectedTests: tests.tests, skippedTests: [],
      counts: { total: tests.tests.length, selected: tests.tests.length, skipped: 0 },
      testInventorySha256: inventoryHash(headRead, tests.tests),
    };
    return sealPlan(plan);
  }
  const basePaths = new Set(snapshotPaths(root, resolvedBase));
  const headPaths = new Set(snapshotPaths(root, resolvedHead));
  return createPlanFromEntries({
    base: resolvedBase,
    basePaths,
    baseRead: snapshotReader(root, resolvedBase, basePaths),
    changedEntries: parseChangedEntries(root, resolvedBase, resolvedHead),
    requestedHead: resolvedRequestedHead,
    testedRevision: resolvedHead,
    headPaths,
    headRead: snapshotReader(root, resolvedHead, headPaths),
  });
}

export function validatePlan(plan, root) {
  if (plan.schema !== PLAN_SCHEMA) throw new Error(`Unsupported component test plan schema: ${plan.schema}`);
  if (plan.planSha256 !== canonicalPlanDigest(plan)) throw new Error('Component test plan digest does not match its contents.');
  if (!['incremental', 'full'].includes(plan.mode)) throw new Error(`Unsupported component test plan mode: ${plan.mode}`);
  const tests = sorted(git(root, ['ls-files', 'packages/inkra/test/*.test.mjs']).trim().split('\n').filter(Boolean));
  const selected = sorted(plan.selectedTests ?? []);
  const skipped = sorted(plan.skippedTests ?? []);
  if (JSON.stringify(selected) !== JSON.stringify(plan.selectedTests)) throw new Error('Selected tests must be unique and sorted.');
  if (JSON.stringify(skipped) !== JSON.stringify(plan.skippedTests)) throw new Error('Skipped tests must be unique and sorted.');
  if (selected.some(path => skipped.includes(path))) throw new Error('Selected and skipped component tests must be disjoint.');
  if (selected.some(path => !tests.includes(path)) || skipped.some(path => !tests.includes(path))) throw new Error('Plan contains a test outside the tracked inventory.');
  if (new Set([...selected, ...skipped]).size !== tests.length) throw new Error('Plan does not partition the complete tracked test inventory.');
  if (plan.mode === 'full' && selected.length !== tests.length) throw new Error('Full plans must select every tracked component test.');
  if (plan.counts?.total !== tests.length || plan.counts?.selected !== selected.length || plan.counts?.skipped !== skipped.length) throw new Error('Plan counts do not match its test lists.');
  const inventory = sha256(tests.map(path => `${path}\0${sha256(readFileSync(resolvePath(root, path), 'utf8'))}`).join('\0'));
  if (inventory !== plan.testInventorySha256) throw new Error('Tracked component tests changed after the plan was generated.');
  const currentHead = git(root, ['rev-parse', 'HEAD']).trim();
  if (currentHead !== plan.testedRevision) throw new Error(`Plan tested revision ${plan.testedRevision} does not match checked out HEAD ${currentHead}.`);
  if (git(root, ['status', '--porcelain', '--untracked-files=no']).trim()) throw new Error('Tracked files changed after checkout; regenerate the component test plan for the actual execution tree.');
  const recomputed = planComponentTests({ root, base: plan.base, requestedHead: plan.requestedHead, testedRevision: plan.testedRevision });
  if (recomputed.planSha256 !== plan.planSha256) throw new Error('Component test plan does not match a fresh selection for its recorded base and tested revision.');
  return { selected, skipped, tests };
}

export function formatPlanSummary(plan) {
  const reasonSummary = plan.reasons.length
    ? plan.reasons.map(item => `${item.code}: ${item.detail}${item.files.length ? ` [${item.files.join(', ')}]` : ''}`).join('\n')
    : 'graph selection completed without a full-fallback reason';
  return [
    `Component test plan: ${plan.mode}`,
    `Base: ${plan.base}`,
    `Requested PR head: ${plan.requestedHead}`,
    `Tested revision: ${plan.testedRevision}${plan.mergePreview ? ' (merge preview)' : ''}`,
    `Tests: ${plan.counts.selected} selected, ${plan.counts.skipped} skipped, ${plan.counts.total} total`,
    `Affected components: ${plan.affectedComponents.join(', ') || '(none)'}`,
    `Reasons:\n${reasonSummary}`,
  ].join('\n');
}

export function repositoryRootFrom(importMetaUrl) {
  return resolvePath(new URL('../', importMetaUrl).pathname);
}

export function planFileUrl(path) {
  return pathToFileURL(resolvePath(path));
}
