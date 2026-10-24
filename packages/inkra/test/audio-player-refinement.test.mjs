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
const source = readFileSync(new URL('../src/audio-player/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/audio-player/styles.css', import.meta.url), 'utf8');
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
const { AudioPlayer } = await import('../src/audio-player/index.tsx');
hooks.deregister();

test('AudioPlayer callback identity cannot reload media or rebind native listeners', () => {
  assert.match(source, /const callbacksRef = useRef\(/);
  assert.match(source, /callbacksRef\.current = \{ onVolumeChange, onMutedChange, onPlaybackRateChange, onTimeChange, onStateChange, onError \}/);
  assert.match(source, /const update = useCallback\([\s\S]*?\}, \[\]\)/);
  assert.match(source, /const sync = useCallback\([\s\S]*?\}, \[update\]\)/);
  assert.match(source, /\}, \[src, update\]\)/);
  assert.match(source, /\}, \[applyControlledSettings, sync, update\]\)/);
  assert.doesNotMatch(source, /\}, \[onStateChange\]\)/);
  assert.doesNotMatch(source, /\[onError, onMutedChange, onTimeChange, onVolumeChange, sync, src, update\]/);
});

test('AudioPlayer source lifecycle resets both changed and empty sources while preserving settings', () => {
  assert.match(source, /if \(!src\) audio\.removeAttribute\('src'\)/);
  assert.match(source, /status: src \? 'loading' : 'idle'/);
  assert.match(source, /audio\.pause\(\)[\s\S]*audio\.load\(\)/);
  assert.match(source, /audio\.volume = clamp\(controlledRef\.current\.volume \?\? current\.volume/);
  assert.match(source, /audio\.muted = controlledRef\.current\.muted \?\? current\.muted/);
  assert.match(source, /audio\.defaultPlaybackRate = rate/);
  assert.match(source, /const requestedSourceRef = useRef\(src\)/);
  assert.match(source, /requestedSourceRef\.current = src/);
  assert.match(source, /const hasSource = \(\) => Boolean\(requestedSourceRef\.current \|\| audio\.getAttribute\('src'\)\)/);
  assert.doesNotMatch(source, /const hasSource = \(\) => Boolean\(audio\.currentSrc/);
  assert.match(source, /pause: \(\) => update\(\{ status: hasSource\(\) \?/);
  assert.match(source, /error: \(\) => \{ if \(!hasSource\(\)\) \{ update\(\{ status: 'idle'/);
  assert.match(source, /emptied: \(\) => \{ if \(!hasSource\(\)\) update\(\{ status: 'idle'/);
  assert.match(source, /useEffect\(\(\) => \{ applyControlledSettings\(\); sync\(\); \}, \[applyControlledSettings, muted, playbackRate, sync, volume\]\)/);
  assert.doesNotMatch(source, /\[applyControlledSettings, defaultMuted, defaultPlaybackRate, defaultVolume/);
  assert(source.indexOf("audio.volume = clamp(controlledRef.current.volume ?? current.volume")
    < source.indexOf('useEffect(() => { applyControlledSettings(); sync(); }'),
  'source initialization applies default settings before native state is synchronized');
});

test('AudioPlayer controlled settings propose changes without mutating native media', () => {
  assert.match(source, /if \(controlledRef\.current\.volume === undefined\) \{ audio\.volume = value; sync\(\); \}/);
  assert.match(source, /if \(controlledRef\.current\.muted === undefined\) \{ audio\.muted = next; sync\(\); \}/);
  assert.match(source, /if \(controlledRef\.current\.playbackRate === undefined\) \{ audio\.defaultPlaybackRate = value; audio\.playbackRate = value; sync\(\); \}/);
  assert.match(source, /const current = controlledRef\.current\.volume \?\? stateRef\.current\.volume;[\s\S]*if \(value === current\) return/);
  assert.match(source, /const current = controlledRef\.current\.muted \?\? stateRef\.current\.muted;[\s\S]*if \(next === current\) return/);
  assert.match(source, /const current = controlledRef\.current\.playbackRate \?\? stateRef\.current\.playbackRate;[\s\S]*if \(value === current\) return/);
  assert.match(source, /previous\.volume !== audio\.volume/);
  assert.match(source, /previous\.muted !== audio\.muted/);
  assert.match(source, /previous !== audio\.playbackRate/);
});

test('AudioPlayer localizes its control group and native audio names without changing native semantics', () => {
  const html = renderToStaticMarkup(createElement(AudioPlayer, {
    labels: { controls: 'Localized controls', audio: 'Localized audio' },
    src: 'sample.wav',
  }));
  assert.match(html, /<audio[^>]*aria-label="Localized audio"/);
  assert.match(html, /role="group" aria-label="Localized controls"/);
  const override = renderToStaticMarkup(createElement(AudioPlayer, {
    audioProps: { 'aria-label': 'Explicit audio name' },
    labels: { audio: 'Ignored audio label' },
  }));
  assert.match(override, /<audio[^>]*aria-label="Explicit audio name"/);
  assert.doesNotMatch(override, /aria-label="Ignored audio label"/);
  assert.match(source, /controls\?: string/);
  assert.match(source, /audio\?: string/);
});

test('AudioPlayer narrow layout responds to its own container and contains long time text', () => {
  assert.match(styles, /\.inkra-audio-player \{[^}]*container-type: inline-size/);
  assert.match(styles, /@container \(max-width: 40rem\)/);
  assert.match(styles, /@container \(max-width: 20rem\)/);
  assert.match(styles, /grid-template-columns: var\(--inkra-touch-target\) minmax\(0, 1fr\)/);
  assert.match(styles, /\.inkra-audio-player__time \{[^}]*max-inline-size: 100%[^}]*overflow-wrap: anywhere/);
  assert.match(styles, /\.inkra-audio-player__settings \{[^}]*flex-wrap: wrap/);
  assert.doesNotMatch(styles, /@media \(max-width: 40rem\)/);
});
