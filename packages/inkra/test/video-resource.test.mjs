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
const source = readFileSync(new URL('../src/image-viewer/VideoResource.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/image-viewer/video.css', import.meta.url), 'utf8');
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
const { VideoResource } = await import('../src/image-viewer/VideoResource.tsx');
hooks.deregister();

test('VideoResource renders a native inline video without browser controls or autoplay', () => {
  const html = renderToStaticMarkup(createElement(VideoResource, {
    alt: 'Artwork video',
    poster: '/poster.png',
    src: '/artwork.webm',
  }));
  assert.match(html, /<video[^>]*aria-label="Artwork video"/);
  assert.match(html, /playsInline=""/);
  assert.match(html, /poster="\/poster\.png"/);
  assert.match(html, /src="\/artwork\.webm"/);
  assert.doesNotMatch(html, /controls=""|autoplay=""/);
  assert.match(html, /role="group"/);
  assert.match(html, /aria-label="Video controls"/);
  assert.match(html, /aria-label="Seek video"/);
  assert.match(html, /aria-label="Video volume"/);
  assert.match(html, /aria-label="Playback speed"/);
  assert.match(html, /dir="auto"/);
  assert.match(html, /class="inkra-pencil-text inkra-image-viewer__video-time"/);
  assert.match(html, /inkra-image-viewer__video-time[^>]*>[\s\S]*inkra-pencil-text__source/);
});

test('VideoResource owns safe native playback and resource cleanup', () => {
  assert.match(source, /const mountedRef = useRef\(false\)/);
  assert.match(source, /const generationRef = useRef\(0\)/);
  assert.match(source, /const playRequestRef = useRef\(0\)/);
  assert.match(source, /const generation = generationRef\.current/);
  assert.match(source, /const source = sourceRef\.current/);
  assert.match(source, /const request = \+\+playRequestRef\.current/);
  assert.match(source, /await video\.play\(\)/);
  assert.match(source, /!mountedRef\.current \|\| generation !== generationRef\.current \|\| source !== sourceRef\.current \|\| request !== playRequestRef\.current/);
  assert.match(source, /setPlaybackError\(true\)/);
  const playBlock = source.match(/const togglePlay = async \(\) => \{[\s\S]*?\n  \};/)?.[0] ?? '';
  assert.doesNotMatch(playBlock, /callbacksRef\.current\.onError/);
  assert.match(source, /if \(!video\.paused\) \{ playRequestRef\.current \+= 1; video\.pause\(\); return; \}/);
  assert.match(source, /video\.pause\(\);[\s\S]*video\.currentTime = 0[\s\S]*video\.load\(\)/);
  assert.match(source, /mountedRef\.current = false;[\s\S]*generationRef\.current \+= 1;[\s\S]*playRequestRef\.current \+= 1;[\s\S]*videoRef\.current\?\.pause\(\)/);
  assert.match(source, /return \(\) => Object\.entries\(handlers\)\.forEach\(\(\[name, handler\]\) => video\.removeEventListener/);
  assert(source.indexOf('const handlers:') < source.indexOf('video.load();'),
    'native listeners are registered before the explicit source load effect');
  assert.doesNotMatch(source, /autoPlay|controls=\{true\}|requestAnimationFrame|setInterval/);
  assert.match(source, /playbackError: string/);
  assert.match(source, /role="alert">\{labels\.playbackError\}/);
});

test('VideoResource delegates every visible control to existing Inkra components', () => {
  assert.match(source, /import \{ Button \}/);
  assert.match(source, /import \{ Slider \}/);
  assert.match(source, /import \{ Select \}/);
  assert.match(source, /<Button[\s\S]*togglePlay/);
  assert.match(source, /<Slider aria-label=\{labels\.seek\}/);
  assert.match(source, /<Slider aria-label=\{labels\.volume\}/);
  assert.match(source, /<Select\.Root onValueChange=\{value => setRate/);
  assert.match(source, /video\.volume = clamp/);
  assert.match(source, /video\.muted = next/);
  assert.match(source, /video\.playbackRate = rate/);
  assert.match(source, /video\.currentTime = clamp/);
  assert.doesNotMatch(source, /<input[^>]+type="range"|<select/);
});

test('VideoResource keeps callbacks current without resetting the resource', () => {
  assert.match(source, /const callbacksRef = useRef\(\{ onError, onLoad \}\)/);
  assert.match(source, /callbacksRef\.current = \{ onError, onLoad \}/);
  assert.match(source, /callbacksRef\.current\.onLoad\?\.\(\)/);
  assert.match(source, /callbacksRef\.current\.onError\?\.\(\)/);
  assert.match(source, /\}, \[src\]\)/);
  assert.doesNotMatch(source, /\}, \[src, onError|\}, \[src, onLoad/);
});

test('VideoResource layout reserves media height and keeps controls in two stable rows', () => {
  assert.match(styles, /\.inkra-image-viewer__video-resource \{[\s\S]*container-type: inline-size[\s\S]*grid-template-rows: minmax\(var\(--inkra-touch-target\), 1fr\) auto/);
  assert.match(styles, /\.inkra-image-viewer__video-media \{[\s\S]*block-size: 100%[\s\S]*object-fit: contain/);
  assert.match(styles, /grid-template-areas:\s*"play seek time"\s*"settings settings settings"/);
  assert.match(styles, /\.inkra-image-viewer__video-controls \{[\s\S]*box-sizing: border-box/);
  assert.match(styles, /grid-template-columns: var\(--inkra-touch-target\) minmax\(var\(--inkra-touch-target\), 1fr\) minmax\(0, 6\.5rem\)/);
  assert.match(styles, /grid-template-areas: "mute volume rate"/);
  assert.match(styles, /grid-template-columns: var\(--inkra-touch-target\) minmax\(var\(--inkra-touch-target\), 1fr\) minmax\(5\.5rem, max-content\)/);
  assert.match(styles, /\.inkra-image-viewer__video-settings > \.inkra-select__trigger \{ grid-area: rate; inline-size: 100%/);
  assert.match(styles, /@container \(max-width: 22rem\)/);
  assert.match(styles, /unicode-bidi: isolate/);
  assert.doesNotMatch(styles, /grid-column: 1 \/ -1; inline-size: 100%; min-inline-size: 0/);
  assert.match(styles, /forced-colors: active/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(styles, /@media \(max-width:/);
});
