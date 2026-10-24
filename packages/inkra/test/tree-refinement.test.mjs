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
const source = readFileSync(new URL('../src/tree/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/tree/styles.css', import.meta.url), 'utf8');
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
const { Tree } = await import('../src/tree/index.tsx');
hooks.deregister();

test('Tree current source keeps React Aria item semantics and accessible names', () => {
  const html = renderToStaticMarkup(h(Tree.Root, { 'aria-label': 'Project files', defaultExpandedKeys: ['root'] },
    h(Tree.Item, { id: 'root', textValue: 'Workspace' },
      h(Tree.ItemContent, { expandLabel: 'Expand workspace', collapseLabel: 'Collapse workspace' },
        h(Tree.ItemTitle, null, 'Workspace'),
        h(Tree.ItemDescription, null, 'Project files')),
      h(Tree.Item, { id: 'child', textValue: 'Draft' },
        h(Tree.ItemContent, null, h(Tree.ItemTitle, null, 'Draft'))))));
  assert.match(html, /aria-label="Project files"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /aria-label="Collapse workspace"/);
  assert.match(html, /inkra-pencil-text__source">Workspace/);
  assert.match(html, /inkra-tree__description[^>]*>.*inkra-pencil-text/);
  assert.match(html, /inkra-pencil-text__source">Project files/);
  assert.match(html, /role="row"|role="treegrid"|role="grid"/);
});

test('Tree leaves keyboard, selection and expansion ownership with React Aria', () => {
  assert.match(source, /Tree as AriaTree/);
  assert.match(source, /TreeItem as AriaTreeItem/);
  assert.match(source, /TreeItemContent as AriaTreeItemContent/);
  assert.match(source, /Button as AriaButton/);
  assert.doesNotMatch(source, /onKeyDown|addEventListener|useState|useReducer/);
  assert.doesNotMatch(source, /role=['"](?:tree|treeitem|row|grid)['"]/);
});

test('Tree deep rows preserve readable space without overflowing narrow containers', () => {
  assert.match(styles, /--inkra-tree-reserved-inline:/);
  assert.match(styles, /box-sizing: border-box/);
  assert.match(styles, /inline-size: 100%/);
  assert.match(styles, /padding-inline-start: min\([\s\S]*max\(0px, calc\(100% - var\(--inkra-tree-reserved-inline\)\)\)/);
  assert.match(styles, /data-has-icon[\s\S]*28px[\s\S]*5rem/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /align-items: start/);
  assert.match(styles, /\.inkra-tree__icon \{[^}]*margin-block-start: var\(--inkra-space-1\)/);
  assert.match(source, /TreeItemDescription[\s\S]*typeof children === 'string' \? <PencilText>\{children\}<\/PencilText> : children/);
});

test('Tree description keeps arbitrary ReactNode content unchanged', () => {
  const html = renderToStaticMarkup(h(Tree.Root, { 'aria-label': 'Custom descriptions' },
    h(Tree.Item, { id: 'custom', textValue: 'Custom' },
      h(Tree.ItemContent, null,
        h(Tree.ItemTitle, null, 'Custom'),
        h(Tree.ItemDescription, null, h('strong', { 'data-custom-description': true }, 'Custom description'))))));
  assert.match(html, /data-custom-description="true">Custom description<\/strong>/);
  assert.doesNotMatch(html, /inkra-pencil-text__source">Custom description/);
});

test('Tree focus is inset and forced colors use only system state outlines', () => {
  assert.match(styles, /\.inkra-tree__focus \{ inset: 1px; z-index: 2; \}/);
  assert.match(styles, /\.inkra-pencil-surface\.inkra-tree__selection,[\s\S]*\.inkra-pencil-surface\.inkra-tree__focus,[\s\S]*\.inkra-pencil-surface\.inkra-tree__disclosure-focus \{ display: none !important; \}/);
  assert.match(styles, /data-focus-visible[\s\S]*outline: 2px solid Highlight; outline-offset: -2px/);
  assert.match(styles, /:dir\(rtl\)[\s\S]*rotate\(90deg\)/);
  assert.match(styles, /min-height: var\(--inkra-touch-target\)/);
});
