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
const source = readFileSync(new URL('../src/accordion/Accordion.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/accordion/styles.css', import.meta.url), 'utf8');
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
const { Accordion } = await import('../src/accordion/index.tsx');
hooks.deregister();

function accordionMarkup(value, contentProps = {}) {
  return renderToStaticMarkup(h(Accordion.Root, { type: 'single', value, onValueChange() {} },
    h(Accordion.Item, { value: 'details' },
      h(Accordion.Header, null, h(Accordion.Trigger, null, 'Details')),
      h(Accordion.Content, { forceMount: true, ...contentProps }, h('a', { href: '/details' }, 'Read details')),
    )));
}

test('Accordion forceMount is inert and hidden in closed SSR markup', () => {
  const html = accordionMarkup('');
  const content = html.match(/<div[^>]*class="inkra-accordion__content"[^>]*>/)?.[0] ?? '';
  assert.match(content, /data-state="closed"/);
  assert.match(content, /aria-hidden="true"/);
  assert.match(content, /inert=""/);
  assert.match(html, /href="\/details"/);
});

test('Accordion open content restores caller aria-hidden and inert values', () => {
  const defaultOpen = accordionMarkup('details');
  const openContent = defaultOpen.match(/<div[^>]*class="inkra-accordion__content"[^>]*>/)?.[0] ?? '';
  assert.match(openContent, /data-state="open"/);
  assert.doesNotMatch(openContent, /aria-hidden=|inert=/);

  const callerHidden = accordionMarkup('details', { 'aria-hidden': true, inert: true });
  const callerContent = callerHidden.match(/<div[^>]*class="inkra-accordion__content"[^>]*>/)?.[0] ?? '';
  assert.match(callerContent, /aria-hidden="true"/);
  assert.match(callerContent, /inert=""/);
});

test('Accordion mirrors Radix value without observers or event ownership changes', () => {
  assert.match(source, /const controlled = props\.value !== undefined/);
  assert.match(source, /if \(!controlled\) setUncontrolledValues\(values\(nextValue\)\)/);
  assert.match(source, /props\.onValueChange\?\.\(nextValue as string\)/);
  assert.match(source, /props\.onValueChange\?\.\(nextValue as string\[\]\)/);
  assert.doesNotMatch(source, /MutationObserver|addEventListener\(['"](?:keydown|click|pointerdown)/);
});

test('Accordion closed content preserves refs/events while removing focusability immediately', () => {
  assert.match(source, /aria-hidden=\{open \? callerAriaHidden : true\}/);
  assert.match(source, /inert=\{open \? callerInert : true\}/);
  assert.match(source, /const setContentRef = useCallback/);
  assert.match(source, /const cleanup = assignRef\(ref, node\)/);
  assert.match(source, /if \(typeof cleanup === 'function'\) cleanup\(\)/);
  assert.match(source, /callerOnBlurCapture\?\.\(event\)/);
  assert.match(source, /callerOnFocusCapture\?\.\(event\)/);
  assert.match(source, /content\.ownerDocument\.getElementById\(triggerId\)\?\.focus\(\{ preventScroll: true \}\)/);
});

test('Accordion close motion reaches a collapsed endpoint and focus stays inside clipped bounds', () => {
  assert.match(styles, /\.inkra-accordion__content\[data-state="closed"\] \{[\s\S]*animation:[^;]*both;[\s\S]*height: 0/);
  assert.match(styles, /\.inkra-accordion__content-body\.inkra-accordion__content\[data-state="closed"\]\s*\{\s*padding: 0/);
  assert.match(styles, /horizontal[^}]*\.inkra-accordion__content\[data-state="closed"\][\s\S]*height: auto;[\s\S]*width: 0/);
  assert.match(styles, /\.inkra-accordion__focus-ring \{[\s\S]*inset: var\(--inkra-focus-width\)/);
  assert.match(styles, /forced-colors: active[\s\S]*outline-offset: calc\(-1 \* var\(--inkra-focus-width\)\)/);
  assert.match(styles, /\.inkra-pencil-surface\.inkra-accordion__focus-ring\s*\{\s*display: none !important/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*animation: none !important/);
});
