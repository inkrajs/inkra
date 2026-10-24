import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const sourceRoot = new URL('../src/', import.meta.url).href;
const source = readFileSync(new URL('../src/log/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/log/styles.css', import.meta.url), 'utf8');
const model = await import('../src/log/model.ts');
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(sourceRoot) && specifier.startsWith('.') && specifier.endsWith('.js')) {
      const base = new URL(specifier.slice(0, -3), context.parentURL);
      for (const extension of ['.ts', '.tsx']) {
        const url = `${base.href}${extension}`;
        if (existsSync(fileURLToPath(url))) return { url, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot) && /\.tsx?$/.test(url)) {
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});
const { Log } = await import('../src/log/index.tsx');
hooks.deregister();

test('Log current source preserves supplied order and stable ids', () => {
  const html = renderToStaticMarkup(h(Log, {
    items: [
      { id: 'second', level: 'warning', content: 'Second supplied record' },
      { id: 'first', level: 'info', content: 'First named record' },
    ],
    levels: [
      { value: 'info', label: 'Information' },
      { value: 'warning', label: 'Warning' },
    ],
    paused: true,
  }));
  assert(html.indexOf('Second supplied record') < html.indexOf('First named record'));
  assert.match(source, /key=\{item\.id\}/);
  assert.doesNotMatch(source, /\.sort\(/);
});

test('Log follow model only follows stable visible appends near bottom while active', () => {
  const base = {
    initial: false,
    nearBottom: true,
    paused: false,
    previousItemIds: ['a', 'b'],
    nextItemIds: ['a', 'b', 'c'],
    previousVisibleIds: ['a', 'b'],
    nextVisibleIds: ['a', 'b', 'c'],
  };
  assert.equal(model.shouldFollowLogUpdate(base), true);
  assert.equal(model.shouldFollowLogUpdate({ ...base, paused: true }), false);
  assert.equal(model.shouldFollowLogUpdate({ ...base, nearBottom: false }), false);
  assert.equal(model.shouldFollowLogUpdate({ ...base, nextItemIds: ['b', 'a', 'c'] }), false);
  assert.equal(model.shouldFollowLogUpdate({ ...base, nextVisibleIds: ['a', 'b'] }), false);
});

test('Log controlled filter and pause requests do not mutate controlled state locally', () => {
  assert.match(source, /if \(paused === undefined\) setUncontrolledPaused\(nextPaused\)/);
  assert.match(source, /if \(filteredLevels === undefined\) setUncontrolledLevels\(nextLevels\)/);
  assert.match(source, /const resolvedPaused = paused \?\? uncontrolledPaused/);
  assert.match(source, /const selectedLevels = \(filteredLevels \?\? uncontrolledLevels\)/);
  assert.doesNotMatch(source, /setUncontrolledPaused\(nextPaused\)[\s\S]{0,80}else/);
});

test('Log viewport uses pencil focus and a non-overlapping latest footer', () => {
  assert.match(source, /className="inkra-log__viewport-frame"/);
  assert.match(source, /className="inkra-log__focus-ring"/);
  assert.match(source, /const showLatest = \(!nearBottom \|\| resolvedPaused\) && visibleItems\.length > 0/);
  assert.match(source, /<PencilLine className="inkra-log__latest-divider"/);
  assert.match(styles, /\.inkra-log__focus-ring \{[\s\S]*--inkra-accent-strong: var\(--inkra-focus\)/);
  assert.match(styles, /viewport-frame:has\(\.inkra-log__viewport:focus-visible\)[^}]*opacity: 1/);
  assert.match(styles, /\.inkra-log:has\(> \.inkra-log__latest\)[\s\S]*grid-template-rows: minmax\(var\(--inkra-touch-target\), 1fr\) auto/);
  assert.match(styles, /\.inkra-log__latest \{[\s\S]*position: relative/);
  const latestBlock = styles.match(/\.inkra-log__latest \{([^}]+)\}/)?.[1] ?? '';
  assert.doesNotMatch(latestBlock, /position: absolute/);
  assert.match(styles, /\.inkra-pencil-surface\.inkra-log__focus-ring \{ display: none !important/);
  assert.match(styles, /forced-colors: active[\s\S]*outline: var\(--inkra-focus-width\) solid Highlight/);
});

test('Log latest scroll respects reduced motion and narrow controls wrap safely', () => {
  assert.match(source, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches/);
  assert.match(source, /\? 'auto'\s*: behavior/);
  assert.match(styles, /container-type: inline-size/);
  assert.match(styles, /\.inkra-log \{[\s\S]*box-sizing: border-box[\s\S]*inline-size: 100%/);
  assert.match(styles, /overflow-x: hidden;[\s\S]*overflow-y: auto/);
  assert.match(styles, /\.inkra-log__viewport-frame \{[\s\S]*min-block-size: var\(--inkra-touch-target\)/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.inkra-log__toolbar \{[\s\S]*max-inline-size: 100%;[\s\S]*min-inline-size: 0/);
  assert.match(styles, /\.inkra-log__viewport-frame \{[\s\S]*max-inline-size: 100%;[\s\S]*min-inline-size: 0/);
  assert.match(styles, /\.inkra-log__filters > \.inkra-button \{ flex: none; max-inline-size: 100%; \}/);
  assert.match(styles, /@container \(max-width: 36rem\)[\s\S]*\.inkra-log__follow-control \{ inline-size: 100%/);
  assert.match(styles, /\.inkra-log__filters > \.inkra-button \.inkra-pencil-text__source[\s\S]*white-space: normal; overflow-wrap: anywhere/);
  assert.match(styles, /\.inkra-log__follow-control \.inkra-pencil-text__source[\s\S]*white-space: normal; overflow-wrap: anywhere/);
  assert.match(styles, /\.inkra-log__follow-control \.inkra-button__surface \{[^}]*height: auto[^}]*min-height: var\(--inkra-button-visual-height\)/);
  assert.match(styles, /\.inkra-log__latest \.inkra-button__surface \{[^}]*height: auto[^}]*min-height: var\(--inkra-button-visual-height\)/);
  assert.doesNotMatch(styles, /inkra-log__(?:follow-control|latest)[^}]*min-(?:block-size|height): var\(--inkra-touch-target\)/);
});
