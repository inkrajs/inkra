import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const sourceUrl = new URL('../src/carousel/index.tsx', import.meta.url);
const cssUrl = new URL('../src/carousel/styles.css', import.meta.url);

test('Carousel delegates drag, inertia, resize and optional autoplay to Embla', () => {
  const source = readFileSync(sourceUrl, 'utf8');
  assert.match(source, /from 'embla-carousel-react'/);
  assert.match(source, /from 'embla-carousel-autoplay'/);
  assert.match(source, /watchResize: true/);
  assert.match(source, /watchSlides: true/);
  assert.match(source, /stopOnInteraction(?:,|:)/);
  assert.doesNotMatch(source, /setPointerCapture|requestAnimationFrame|touchmove/);
});

test('Carousel keeps responsive geometry stable and supplies reduced-motion and forced-color fallbacks', () => {
  const css = readFileSync(cssUrl, 'utf8');
  assert.match(css, /container-type: inline-size/);
  assert.match(css, /flex: 0 0 calc\(/);
  assert.match(css, /touch-action: pan-y pinch-zoom/);
  assert.match(css, /@container \(min-width: 30rem\)/);
  assert.match(css, /@container \(min-width: 48rem\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.doesNotMatch(css, /font-size:\s*(?:clamp|min|max)\(/);
});

test('Carousel source includes controlled selection, keyboard, RTL and autoplay pause contracts', () => {
  const source = readFileSync(sourceUrl, 'utf8');
  assert.match(source, /currentIndex\?: number/);
  assert.match(source, /onCurrentIndexChange\?: \(index: number\) => void/);
  assert.match(source, /event\.key === 'ArrowLeft'/);
  assert.match(source, /event\.key === 'ArrowRight'/);
  assert.match(source, /event\.key === 'Home'/);
  assert.match(source, /event\.key === 'End'/);
  assert.match(source, /direction: resolvedDir/);
  assert.match(source, /pauseOnHover/);
  assert.match(source, /pauseOnFocus/);
  assert.match(source, /autoplayControlPointerRef/);
  assert.match(source, /onPointerDown=\{\(\) => \{ autoplayControlPointerRef\.current = true; \}\}/);
  assert.match(source, /respectReducedMotion/);
  assert.match(source, /aria-roledescription="carousel"/);
  assert.match(source, /aria-roledescription="slide"/);
});

test('Carousel renders semantic empty, single and multiple-item SSR markup after integration build', async t => {
  let Carousel;
  try {
    ({ Carousel } = await import('../dist/carousel/index.js'));
  } catch {
    t.skip('Run after integration installs Embla and builds @inkra/react.');
    return;
  }

  const empty = renderToStaticMarkup(createElement(Carousel, {
    'aria-label': 'Featured work',
    emptyState: createElement('p', null, 'Nothing featured'),
  }));
  assert.match(empty, /aria-roledescription="carousel"/);
  assert.match(empty, /Nothing featured/);
  assert.doesNotMatch(empty, /Previous slide|Next slide|Carousel pages/);

  const single = renderToStaticMarkup(createElement(Carousel, null, createElement('article', null, 'Only item')));
  assert.equal((single.match(/aria-roledescription="slide"/g) ?? []).length, 1);
  assert.doesNotMatch(single, /Previous slide|Next slide|Carousel pages/);
  assert.doesNotMatch(single, /tabindex="0"/i);

  const multiple = renderToStaticMarkup(createElement(Carousel, {
    currentIndex: 1,
    dir: 'rtl',
    labels: { slide: (index, count) => `Card ${index} of ${count}` },
  }, [
    createElement('article', { key: 'one' }, 'One'),
    createElement('article', { key: 'two' }, createElement('button', null, 'Open two')),
    createElement('article', { key: 'three' }, 'Three'),
  ]));
  assert.match(multiple, /dir="rtl"/);
  assert.match(multiple, /tabindex="0"/i);
  assert.equal((multiple.match(/aria-roledescription="slide"/g) ?? []).length, 3);
  assert.match(multiple, /aria-label="Card 2 of 3"/);
  assert.match(multiple, /data-current="true"/);
  assert.match(multiple, /Open two/);
});

