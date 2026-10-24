import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const sourceRoot = new URL('../src/', import.meta.url).href;
const source = readFileSync(new URL('../src/alert-dialog/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/alert-dialog/styles.css', import.meta.url), 'utf8');
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
await import('../src/alert-dialog/index.tsx');
hooks.deregister();

test('AlertDialog current source retains Radix alertdialog and pending guards', () => {
  assert.match(source, /role="alertdialog"/);
  assert.match(source, /aria-busy=\{context\?\.pending \|\| undefined\}/);
  assert.match(source, /className="inkra-alert-dialog__focus-ring"/);
  assert.match(source, /disabled=\{disabled \|\| context\?\.pending\}/);
  assert.match(source, /disabled=\{disabled \|\| pending\}/);
  assert.match(source, /if \(!nextOpen && pending\) return/);
  assert.match(source, /if \(context\?\.pending\) event\.preventDefault\(\)/);
  assert.match(source, /onInteractOutside[\s\S]*event\.preventDefault\(\)/);
});

test('AlertDialog uses physical centering compatible with RTL', () => {
  assert.match(styles, /\.inkra-alert-dialog__content \{[\s\S]*left: 50%/);
  assert.match(styles, /transform: translate\(-50%, -50%\)/);
  assert.doesNotMatch(styles, /inset-inline-start: 50%/);
  assert.match(styles, /width: min\(32rem, calc\(100vw - var\(--inkra-space-8\)\)\)/);
});

test('AlertDialog chooses only an enabled Cancel for initial focus', () => {
  assert.match(source, /const cancel = context\?\.cancelRef\.current/);
  assert.match(source, /cancel && !cancel\.disabled && cancel\.isConnected/);
  assert.match(source, /if \(ownerDocument\?\.activeElement === cancel\) return/);
  assert.match(source, /if \(content\?\.isConnected\) content\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /event\.preventDefault\(\);\s*queueMicrotask/);
});

test('AlertDialog keeps long short-height content internally scrollable', () => {
  assert.match(styles, /max-height: min\(80vh, calc\(100dvh - var\(--inkra-space-8\)\)\)/);
  assert.match(styles, /@media \(max-height: 30rem\)[\s\S]*max-height: calc\(100dvh - var\(--inkra-space-4\)\)/);
  assert.match(styles, /\.inkra-alert-dialog__surface,[\s\S]*\.inkra-alert-dialog__layout[\s\S]*max-height: inherit[\s\S]*min-height: 0/);
  assert.match(styles, /\.inkra-alert-dialog__surface \{[^}]*overflow: hidden/);
  assert.match(styles, /\.inkra-alert-dialog__layout \{ overflow: auto/);
  assert.match(styles, /\.inkra-alert-dialog__layout:has\(> \.inkra-alert-dialog__body\) \{ overflow: hidden/);
  assert.match(styles, /\.inkra-alert-dialog__body \{[^}]*flex: 1 1 auto; min-height: 0; overflow: auto/);
  assert.match(styles, /\.inkra-alert-dialog__header,[\s\S]*\.inkra-alert-dialog__footer \{ flex: none/);
});

test('AlertDialog content fallback uses pencil focus with forced-color system fallback', () => {
  assert.match(source, /className="inkra-alert-dialog__focus-ring"/);
  assert.match(styles, /\.inkra-alert-dialog__focus-ring \{[\s\S]*--inkra-accent-strong: var\(--inkra-focus\)/);
  assert.match(styles, /\.inkra-alert-dialog__content:focus > \.inkra-alert-dialog__focus-ring \{\s*opacity: 1/);
  assert.match(styles, /\.inkra-pencil-surface\.inkra-alert-dialog__focus-ring \{ display: none !important/);
  assert.match(styles, /\.inkra-alert-dialog__content:focus \{ outline: var\(--inkra-focus-width\) solid Highlight; outline-offset: calc\(-1 \* var\(--inkra-focus-width\)\)/);
});
