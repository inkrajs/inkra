import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const sourceRoot = new URL('../src/', import.meta.url).href;
const source = readFileSync(new URL('../src/rating/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/rating/styles.css', import.meta.url), 'utf8');
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
const { Rating, normalizeRatingValue } = await import('../src/rating/index.tsx');
hooks.deregister();

test('Rating keeps count as a reachable endpoint when count is not divisible by step', () => {
  assert.equal(normalizeRatingValue(5, 5, 1.5), 5);
  assert.equal(normalizeRatingValue(3.5, 5, 1.5), 3);
  assert.equal(normalizeRatingValue(5, 5, 3), 5);
  assert.equal(normalizeRatingValue(2, 5, 3), 3);
  assert.equal(normalizeRatingValue(1, 1, 0.1), 1);
  assert.match(source, /const previousIndex = Math\.max\(0, Math\.ceil\(count \/ step\) - 1\)/);
});

test('Rating current source renders a shared pencil focus layer without changing slider semantics', () => {
  const html = renderToStaticMarkup(createElement(Rating, {
    'aria-label': 'Score',
    defaultValue: 2.5,
    form: 'survey',
    name: 'score',
    step: 0.5,
  }));
  assert.match(html, /role="slider"/);
  assert.match(html, /aria-valuenow="2.5"/);
  assert.equal((html.match(/inkra-rating__focus-ring/g) ?? []).length, 1);
  const hidden = html.match(/<input[^>]*type="hidden"[^>]*>/)?.[0] ?? '';
  assert.match(hidden, /name="score"/);
  assert.match(hidden, /form="survey"/);
  assert.match(hidden, /value="2.5"/);
});

test('Rating pointer focus preserves caller cancellation and keyboard continuity', () => {
  assert.match(source, /onPointerDown\?\.\(event\)/);
  assert.match(source, /if \(!event\.defaultPrevented && !disabled\) \{[\s\S]*rootRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /onClick=\{\(event\) => commit\(valueFromPointer\(event, index\)\)\}/);
  assert.match(source, /onKeyDown=\{handleKeyDown\}/);
});

test('Rating keyboard changes reveal the logical value in narrow containers', () => {
  assert.match(source, /const scroller = symbolsRef\.current/);
  assert.match(source, /querySelector<HTMLElement>\(`\[data-index="\$\{targetIndex\}"\]`\)/);
  assert.match(source, /scroller\.scrollLeft \+= delta/);
  assert.doesNotMatch(source, /scrollIntoView/);
  assert.match(source, /pendingKeyboardValueRef\.current = normalized/);
  assert.match(source, /if \(pending === committedValue\) revealValue\(committedValue\)/);
  assert.match(source, /previousRatingValue\(committedValue, count, step\)/);
  assert.match(source, /event\.key === 'ArrowRight'[\s\S]*previousRatingValue\(committedValue, count, step\)/);
  assert.match(source, /event\.key === 'ArrowLeft'[\s\S]*previousRatingValue\(committedValue, count, step\)/);
  assert.match(source, /onBlur=\{\(event\) => \{\s*clearPendingKeyboard\(\)/);
  assert.match(source, /onPointerDown\?\.\(event\)[\s\S]*clearPendingKeyboard\(\)/);
  assert.match(source, /\}, 100\)/);
  assert.doesNotMatch(source, /queueMicrotask|scrollIntoView/);
});

test('Rating retains hover, form and reset separation while changing focus presentation', () => {
  assert.match(source, /const displayValue = previewing \? normalizeRatingValue\(previewValue, count, step\) : committedValue/);
  assert.match(source, /aria-valuenow=\{committedValue\}/);
  assert.match(source, /type="hidden" name=\{name\} form=\{form\} value=\{committedValue\}/);
  assert.match(source, /if \(event\.defaultPrevented\) return/);
  const resetBlock = source.match(/const reset = \(event: Event\) => \{[\s\S]*?\n    \};/)?.[0] ?? '';
  assert.doesNotMatch(resetBlock, /onValueChange|commit\(/);
  assert.match(styles, /\.inkra-rating__symbol-target \{[\s\S]*block-size: var\(--inkra-touch-target\)[\s\S]*inline-size: var\(--inkra-touch-target\)/);
  assert.match(styles, /\.inkra-rating:focus-visible > \.inkra-rating__focus-ring \{\s*opacity: 1/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*outline: var\(--inkra-focus-width\) solid Highlight/);
  assert.match(styles, /@media \(prefers-reduced-motion: no-preference\)[\s\S]*transition: opacity var\(--inkra-motion-fast\)/);
});
