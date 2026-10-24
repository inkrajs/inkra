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
const source = readFileSync(new URL('../src/carousel/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/carousel/styles.css', import.meta.url), 'utf8');
const embla = readFileSync(require.resolve('embla-carousel'), 'utf8');
const autoplay = readFileSync(require.resolve('embla-carousel-autoplay'), 'utf8');
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
const { Carousel } = await import('../src/carousel/index.tsx');
hooks.deregister();

test('Carousel responsive variables target a descendant of the query container', () => {
  assert.match(styles, /\.inkra-carousel \{[\s\S]*container-type: inline-size/);
  assert.match(styles, /\.inkra-carousel__viewport \{[\s\S]*--inkra-carousel-visible: var\(--inkra-carousel-visible-base/);
  assert.match(styles, /@container \(min-width: 30rem\) \{\s*\.inkra-carousel__viewport/);
  assert.match(styles, /@container \(min-width: 48rem\) \{\s*\.inkra-carousel__viewport/);
  assert.doesNotMatch(styles, /@container[^}]+\{\s*\.inkra-carousel \{/);
});

test('Carousel slide basis subtracts gaps exactly once', () => {
  assert.match(styles, /\.inkra-carousel__container \{[\s\S]*column-gap: var\(--inkra-carousel-gap\)/);
  assert.match(styles, /flex: 0 0 calc\(\(100% - \(var\(--inkra-carousel-visible\) - 1\) \* var\(--inkra-carousel-gap\)\) \/ var\(--inkra-carousel-visible\)\)/);
  const containerBlock = styles.match(/\.inkra-carousel__container \{([^}]+)\}/)?.[1] ?? '';
  const slideBlock = styles.match(/\.inkra-carousel__slide \{([^}]+)\}/)?.[1] ?? '';
  assert.doesNotMatch(containerBlock, /margin-inline-end/);
  assert.doesNotMatch(slideBlock, /padding-inline-end/);
});

test('Carousel root and page indicators use distinct pencil focus surfaces', () => {
  const html = renderToStaticMarkup(h(Carousel, null,
    h('article', null, 'One'), h('article', null, 'Two'), h('article', null, 'Three')));
  assert.equal((html.match(/inkra-carousel__focus-ring/g) ?? []).length, 1);
  assert.match(source, /className="inkra-carousel__page-focus"/);
  assert.match(styles, /\.inkra-carousel:focus-visible > \.inkra-carousel__focus-ring \{ opacity: 1/);
  assert.match(styles, /\.inkra-carousel__page:focus-visible \.inkra-carousel__page-focus \{ opacity: 1/);
  assert.match(styles, /forced-colors: active[\s\S]*\.inkra-pencil-surface\.inkra-carousel__focus-ring/);
});

test('Carousel keeps controlled retries, count clamping and Embla reInit ownership', () => {
  assert.match(source, /const activeIndex = clampIndex\(controlled \? currentIndex : uncontrolledIndex, selectionCount\)/);
  assert.match(source, /if \(!emblaApi \|\| count === 0 \|\| selectedIndex === activeIndex\) return/);
  assert.match(source, /emblaApi\.scrollTo\(activeIndex, reducedMotion\)/);
  assert.match(source, /emblaApi\.on\('reInit', refresh\)/);
  assert.match(source, /setUncontrolledIndex\(index => clampIndex\(index, count\)\)/);
  assert.doesNotMatch(source, /pendingIndex|lastRequested|requestedIndex/);
});

test('Carousel preserves installed Embla focus and autoplay behavior', () => {
  assert.match(source, /watchResize: true/);
  assert.match(source, /watchSlides: true/);
  assert.doesNotMatch(source, /watchFocus: false/);
  assert.match(embla, /watchFocus: true/);
  assert.match(embla, /eventHandler\.emit\('slideFocusStart'\)/);
  assert.match(source, /pauseOnHover/);
  assert.match(source, /pauseOnFocus/);
  assert.match(source, /respectReducedMotion/);
  assert.match(autoplay, /stopOnFocusIn: true/);
  assert.match(source, /stopOnFocusIn: false/);
  assert.match(source, /const autoplayAllowed = autoplayEnabled && !\(autoplayOptions\.respectReducedMotion !== false && reducedMotion\)/);
});
