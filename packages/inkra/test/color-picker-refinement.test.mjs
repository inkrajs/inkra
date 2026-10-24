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
const source = readFileSync(new URL('../src/color-picker/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/color-picker/styles.css', import.meta.url), 'utf8');
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
const { ColorPicker } = await import('../src/color-picker/index.tsx');
hooks.deregister();

test('ColorPicker source SSR associates its hidden value with an external form', () => {
  const html = renderToStaticMarkup(createElement(ColorPicker, {
    defaultValue: '#abc',
    form: 'external-color-form',
    name: 'accent',
  }));
  const fieldset = html.match(/<fieldset[^>]*>/)?.[0] ?? '';
  const hidden = html.match(/<input[^>]*type="hidden"[^>]*>/)?.[0] ?? '';
  assert.match(fieldset, /class="inkra-color-picker"/);
  assert.match(fieldset, /form="external-color-form"/);
  assert.match(hidden, /form="external-color-form"/);
  assert.match(hidden, /name="accent"/);
  assert.match(hidden, /value="#aabbccff"/);
});

test('ColorPicker reset contract restores only uncontrolled state without callbacks', () => {
  assert.match(source, /const ownerForm = hiddenInputRef\.current\?\.form \?\? fieldsetRef\.current\?\.form/);
  assert.match(source, /ownerForm\.addEventListener\('reset', reset\)/);
  assert.match(source, /setTimeout\(\(\) => \{[\s\S]*if \(event\.defaultPrevented\) return/);
  assert.match(source, /const restored = controlled \? currentValueRef\.current : defaultValueRef\.current/);
  assert.match(source, /if \(!controlled\) setUncontrolledValue\(restored\)/);
  const resetBlock = source.match(/const reset = \(event: Event\) => \{[\s\S]*?\n    \};/)?.[0] ?? '';
  assert.doesNotMatch(resetBlock, /onValueChange|commit\(/);
});

test('ColorPicker canonical input commits once and remains safe during IME or disabled state', () => {
  assert.match(source, /if \(disabled \|\| composingRef\.current\) return/);
  assert.match(source, /if \(JSON\.stringify\(next\) === JSON\.stringify\(currentValue\)\) \{[\s\S]*setDraft\(currentColor\);[\s\S]*return/);
  assert.match(source, /event\.nativeEvent\.isComposing \|\| event\.nativeEvent\.keyCode === 229/);
  assert.match(source, /skipNextBlurRef\.current = true;[\s\S]*submitDraft\(\)/);
  assert.match(source, /if \(skipNextBlurRef\.current\) \{[\s\S]*skipNextBlurRef\.current = false;[\s\S]*return/);
  assert.match(source, /onCompositionStart=\{\(\) => \{ composingRef\.current = true; \}\}/);
  assert.match(source, /onCompositionEnd=\{\(\) => \{ composingRef\.current = false; \}\}/);
});

test('ColorPicker palette and presets use the shared pencil focus surface', () => {
  assert.equal((source.match(/className="inkra-color-picker__focus"/g) ?? []).length, 1);
  assert.match(source, /<ColorSwatch/);
  assert.match(styles, /\.inkra-color-picker__focus \{[\s\S]*--inkra-accent-strong: var\(--inkra-focus\)/);
  assert.match(styles, /focus-within \.inkra-color-picker__focus/);
  const swatch = readFileSync(new URL('../src/color-swatch/index.tsx', import.meta.url), 'utf8');
  assert.match(swatch, /<Button/);
  assert.match(styles, /forced-colors: active[\s\S]*outline: var\(--inkra-focus-width\) solid Highlight/);
});
