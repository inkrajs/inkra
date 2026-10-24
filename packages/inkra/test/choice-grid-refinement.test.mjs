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
const source = readFileSync(new URL('../src/choice-grid/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/choice-grid/styles.css', import.meta.url), 'utf8');
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
const { ChoiceGrid, ChoiceGridOption } = await import('../src/choice-grid/index.tsx');
hooks.deregister();

test('ChoiceGrid current source pencils string labels and preserves ReactNode labels', () => {
  const html = renderToStaticMarkup(createElement(
    ChoiceGrid,
    { label: 'Layout', name: 'layout' },
    createElement(ChoiceGridOption, { label: 'Compact layout', value: 'compact' }),
    createElement(ChoiceGridOption, {
      label: createElement('strong', { 'data-custom-label': true }, 'Custom layout'),
      value: 'custom',
    }),
  ));
  assert.match(html, /inkra-pencil-text__source">Compact layout/);
  assert.match(html, /data-custom-label="true">Custom layout<\/strong>/);
  assert.doesNotMatch(html, /inkra-pencil-text__source">Custom layout/);
});

test('ChoiceGrid option owns distinct selection, focus and outline pencil layers', () => {
  const html = renderToStaticMarkup(createElement(
    ChoiceGrid,
    { defaultValues: ['notes'], label: 'Sections', name: 'sections', type: 'multiple' },
    createElement(ChoiceGridOption, { label: 'Notes', value: 'notes' }),
  ));
  assert.equal((html.match(/inkra-choice-grid__selection/g) ?? []).length, 1);
  assert.equal((html.match(/inkra-choice-grid__focus/g) ?? []).length, 1);
  assert.equal((html.match(/inkra-choice-grid__outline/g) ?? []).length, 1);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /checked=""/);
});

test('ChoiceGrid focus uses pencil material while forced colors retain system focus', () => {
  assert.match(source, /className="inkra-choice-grid__focus"/);
  assert.match(styles, /\.inkra-choice-grid__focus \{[\s\S]*--inkra-accent-strong: var\(--inkra-focus\)/);
  assert.match(styles, /focus-visible\) \.inkra-choice-grid__focus \{\s*opacity: 1/);
  assert.match(styles, /\.inkra-choice-grid__control \.inkra-selection-control__focus-ring \{\s*display: none !important/);
  assert.doesNotMatch(styles.split('@media (forced-colors: active)')[0], /outline:\s*var\(--inkra-focus-width\) solid var\(--inkra-focus\)/);
  assert.match(styles, /@media \(forced-colors: active\)[\s\S]*focus-visible\)[\s\S]*solid Highlight/);
  assert.match(styles, /\.inkra-choice-grid__selection,[\s\S]*\.inkra-choice-grid__focus,[\s\S]*\.inkra-choice-grid__outline[\s\S]*display: none/);
});

test('ChoiceGrid retains narrow layout, long-text and native-target contracts', () => {
  assert.match(styles, /repeat\(auto-fit, minmax\(min\(100%, var\(--inkra-choice-grid-min-item/);
  assert.match(styles, /@media \(max-width: 640px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /container-type:\s*inline-size/);
  assert.match(styles, /@container \(max-width: 640px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.inkra-choice-grid__option-label \{[\s\S]*overflow-wrap: anywhere/);
  assert.match(styles, /\.inkra-choice-grid__control \{[\s\S]*block-size: 100%/);
  assert.match(source, /<RadioGroupItem[\s\S]*label=\{content\}/);
  assert.match(source, /<Checkbox[\s\S]*label=\{content\}/);
  assert.doesNotMatch(source, /ResizeObserver/);
});
