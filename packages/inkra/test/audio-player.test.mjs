import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/audio-player/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/audio-player/styles.css', import.meta.url), 'utf8');

test('AudioPlayer uses native media events and cleans listeners on unmount', () => {
  assert.match(source, /HTMLAudioElement/);
  assert.match(source, /loadedmetadata/);
  assert.match(source, /waiting/);
  assert.match(source, /ended/);
  assert.match(source, /audio\.play\(\)/);
  assert.match(source, /status: 'blocked'/);
  assert.match(source, /return \(\) => Object\.entries\(handlers\)/);
  assert.doesNotMatch(source, /requestAnimationFrame|AudioContext|AnalyserNode/);
});

test('AudioPlayer exposes accessible custom controls and no default autoplay', () => {
  assert.match(source, /autoPlay\?\: boolean/);
  assert.match(source, /autoPlay = false/);
  assert.match(source, /<Slider/);
  assert.match(source, /<Select\.Root/);
  assert.match(source, /aria-label=\{mergedLabels\.seek\}/);
  assert.match(source, /renderControls\?: \(controls: AudioPlayerControls\)/);
  assert.match(source, /<PencilText as="span" className="inkra-audio-player__time"/);
  assert.match(source, /<PencilText as="p" className="inkra-audio-player__message" role="status"/);
  assert.match(source, /<PencilText as="p" className="inkra-audio-player__message" role="alert"/);
  assert.match(source, /data-tooltip=\{playLabel\}/);
  assert.match(source, /data-tooltip=\{state\.muted \? mergedLabels\.unmute : mergedLabels\.mute\}/);
  assert.match(source, /fullWidth=\{false\}/);
  assert.doesNotMatch(source, /<input[^>]+type="range"/);
  assert.doesNotMatch(source, /<select[^>]*aria-label=\{mergedLabels\.rate\}/);
});

test('AudioPlayer layout preserves touch targets and forced-color fallback', () => {
  assert.match(styles, /inkra-slider/);
  assert.match(styles, /min-inline-size: 0/);
  assert.match(styles, /container-type: inline-size/);
  assert.match(styles, /@container \(max-width: 40rem\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /inkra-slider/);
  assert.match(styles, /\.inkra-audio-player__settings\s*>\s*\.inkra-select__trigger\s*\{[^}]*flex:\s*none;[^}]*min-width:\s*5\.5rem;/);
  assert.doesNotMatch(styles, /\.inkra-audio-player__controls\s*\{\s*display:\s*none/);
  assert.match(styles, /ButtonText/);
});

test('AudioPlayer emits source and state contracts in source', () => {
  assert.match(source, /onStateChange\?: \(state: AudioPlayerState\)/);
  assert.match(source, /onError\?: \(error: MediaError \| DOMException \| null\)/);
  assert.match(source, /src=\{src\}/);
  assert.match(source, /status: 'buffering'/);
  assert.match(source, /status: 'ended'/);
  assert.match(source, /audio\.load\(\)/);
  assert.match(source, /stateRef\.current = next;[\s\S]*setState\(next\);[\s\S]*onStateChange\?\.\(next\)/);
  assert.doesNotMatch(source, /setState\(current => \{[\s\S]*onStateChange/);
});

