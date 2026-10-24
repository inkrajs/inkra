import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  nextImageViewerIndex,
  resolveImageViewerSelection,
} from '../dist/image-viewer/model.js';

const component = readFileSync(new URL('../src/image-viewer/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/image-viewer/styles.css', import.meta.url), 'utf8');
const geometry = readFileSync(new URL('../src/image-viewer/lucideGeometry.ts', import.meta.url), 'utf8');
const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const geometryModule = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(geometry, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText).toString('base64')}`);

test('selection follows stable ids and chooses the nearest surviving image', () => {
  const items = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
  assert.deepEqual(resolveImageViewerSelection(items, 'two', 0), { activeId: 'two', index: 1 });
  assert.deepEqual(resolveImageViewerSelection([items[0], items[2]], 'two', 1), { activeId: 'three', index: 1 });
  assert.deepEqual(resolveImageViewerSelection([], 'two', 1), { activeId: null, index: -1 });
});

test('navigation supports bounded and looping lists', () => {
  assert.equal(nextImageViewerIndex(3, 0, -1, true), 2);
  assert.equal(nextImageViewerIndex(3, 2, 1, true), 0);
  assert.equal(nextImageViewerIndex(3, 0, -1, false), 0);
  assert.equal(nextImageViewerIndex(3, 2, 1, false), 2);
  assert.equal(nextImageViewerIndex(0, 0, 1, true), -1);
});

test('ImageViewer composes the shared Overlay and keeps focus, escape and scroll locking with Radix', () => {
  assert.match(component, /<OverlayRoot/);
  assert.match(component, /<OverlayPortal>/);
  assert.match(component, /<OverlayBackdrop\s*\/>/);
  assert.match(component, /<OverlayContent[\s\S]*?layout="sections"/);
  assert.match(component, /onOpenAutoFocus=/);
  assert.doesNotMatch(component, /document\.body\.style|addEventListener\(['"]keydown/);
});

test('ImageViewer delegates transforms to PanZoom and only adds optional rotation presentation', () => {
  assert.match(component, /import \{ PanZoom \} from '\.\.\/pan-zoom\/index\.js'/);
  assert.match(component, /<PanZoom[\s\S]*?fitOnInit="contain"[\s\S]*?wheel=\{zoomable \? wheel : 'disabled'\}/);
  assert.match(component, /panZoomRef\.current\?\.zoomIn/);
  assert.match(component, /panZoomRef\.current\?\.zoomOut/);
  assert.match(component, /panZoomRef\.current\?\.reset/);
  assert.doesNotMatch(component, /setPointerCapture|touches\[|wheelDelta/);
});

test('ImageViewer provides alt text, failure recovery, empty state and keyboard navigation', () => {
  assert.match(component, /alt: activeItem\.alt/);
  assert.match(component, /role="alert"/);
  assert.match(component, /labels\.emptyTitle/);
  assert.match(component, /event\.key === 'ArrowLeft'/);
  assert.match(component, /event\.key === 'ArrowRight'/);
  assert.match(component, /event\.key === 'Home'/);
  assert.match(component, /event\.key === 'End'/);
  assert.match(component, /role="listbox"/);
  assert.match(component, /role="option"/);
  assert.match(component, /\{ key, \.\.\.imageProps \}: ImageViewerImageRenderProps/);
  assert.match(component, /<img key=\{key\} \{\.\.\.imageProps\}/);
});

test('ImageViewer owns stable viewport and thumbnail geometry across desktop and mobile', () => {
  assert.match(styles, /height: min\(52rem, calc\(100dvh/);
  assert.match(styles, /\.inkra-image-viewer__thumbnail[\s\S]*?flex: 0 0 5rem;[\s\S]*?block-size: 3\.75rem/);
  assert.match(styles, /object-fit: contain/);
  assert.match(styles, /@media \(max-width: 30rem\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
});

test('ImageViewer keeps RTL tools physically centered and bounds short-view header/tools', () => {
  assert.match(styles, /\.inkra-image-viewer__tools\s*\{[\s\S]*?left: 50%;[\s\S]*?transform: translateX\(-50%\)/);
  assert.doesNotMatch(styles, /\.inkra-image-viewer__tools\s*\{[\s\S]*?inset-inline-start: 50%/);
  assert.match(styles, /\.inkra-image-viewer \.inkra-overlay__header\s*\{[\s\S]*?max-block-size: 42%;[\s\S]*?overflow: hidden/);
  assert.match(styles, /\.inkra-image-viewer \.inkra-overlay__heading\s*\{[\s\S]*?overflow: auto/);
  assert.match(styles, /\.inkra-image-viewer__tools\s*\{[\s\S]*?max-inline-size: calc\(100% - 2 \* var\(--inkra-space-3\)\);[\s\S]*?overflow-x: auto/);
  assert.match(styles, /\.inkra-image-viewer \.inkra-image-viewer__pan-zoom\.inkra-pan-zoom[\s\S]*?--inkra-pan-zoom-min-block-size: 0px/);
  assert.match(styles, /\.inkra-image-viewer \.inkra-image-viewer__pan-zoom > \.inkra-pan-zoom__clip > \.react-transform-wrapper/);
  assert.match(styles, /\.inkra-image-viewer \.inkra-image-viewer__pan-zoom \.inkra-pan-zoom__viewport/);
  assert.match(component, /className="inkra-image-viewer__tools-paper"[\s\S]*?variant="paper"/);
  assert.match(styles, /\.inkra-image-viewer__tools-paper[\s\S]*?position: absolute !important/);
  assert.equal((component.match(/variant="secondary"/g) ?? []).length >= 2, true);
});

test('ImageViewer stage uses pencil focus with forced-color system fallback', () => {
  assert.match(component, /className="inkra-image-viewer__stage-focus"[\s\S]*?variant="outline"/);
  assert.match(styles, /\.inkra-image-viewer__stage:focus-visible > \.inkra-image-viewer__stage-focus/);
  assert.doesNotMatch(styles.split('@media (forced-colors: active)')[0], /box-shadow/);
  assert.match(styles, /\.inkra-pencil-surface\.inkra-image-viewer__stage-focus \{ display: none !important/);
  assert.match(styles, /\.inkra-image-viewer__stage:focus-visible,[\s\S]*?outline: var\(--inkra-focus-width\) solid Highlight/);
});

test('ImageViewer keeps controlled id repair and per-image transform reset bounded', () => {
  assert.match(component, /repairRef\.current === repairKey/);
  assert.match(component, /commitActiveId\(selection\.activeId, 'items-change'\)/);
  assert.match(component, /const activeItemKey = activeItem \? JSON\.stringify\(\[activeItem\.id, activeItem\.src\]\) : undefined/);
  assert.match(component, /thumbnailRefs\.current\.get\(activeItem\.id\)/);
  assert.match(component, /\}, \[activeItemKey\]\)/);
  assert.doesNotMatch(component, /\}, \[activeItem\]\)/);
  assert.match(component, /failedResources\.has\(activeItemKey\)/);
  assert.match(component, /key=\{activeItemKey\}/);
  assert.match(component, /attempts\[resourceKey\]/);
  assert.match(component, /if \(!activeItemKey\) return/);
  assert.match(component, /setRotation\(0\)/);
  assert.match(component, /setFailedResources\(current => activeItemKey && current\.has\(activeItemKey\) \? new Set\(\[activeItemKey\]\) : new Set\(\)\)/);
  assert.match(component, /setAttempts\(current => activeItemKey && current\[activeItemKey\] !== undefined \? \{ \[activeItemKey\]: current\[activeItemKey\] \} : \{\}\)/);
  assert.match(component, /setAttempts\(current => \(\{ \.\.\.current, \[failedKey\]: \(current\[failedKey\] \?\? 0\) \+ 1 \}\)\)/);
  assert.match(component, /const viewport = thumbnailsRef\.current/);
  assert.match(component, /viewport\.scrollLeft -= clip\.left - item\.left/);
  assert.match(component, /viewport\.scrollLeft \+= item\.right - clip\.right/);
  assert.doesNotMatch(component, /scrollIntoView/);
});

test('ImageViewer converts all Lucide node geometry before PencilIcon rendering', async () => {
  assert.equal((component.match(/lucideNodesToPencilPaths\(/g) ?? []).length, 6);
  for (const tag of ['path', 'line', 'circle']) {
    assert.match(geometry, new RegExp(`tag === '${tag}'`));
  }
  for (const tag of ['polyline', 'polygon', 'rect', 'ellipse']) assert.doesNotMatch(geometry, new RegExp(`tag === '${tag}'`));
  assert.match(geometry, /return nodes\.flatMap/);
  for (const name of ['chevron-left', 'chevron-right', 'image-off', 'rotate-cw', 'zoom-in', 'zoom-out']) {
    const icon = (await import(`lucide-react/dist/esm/icons/${name}.mjs`)).__iconData;
    const paths = geometryModule.lucideNodesToPencilPaths(icon.node);
    assert.equal(paths.length, icon.node.length, `${name} retains every actual node`);
    assert(paths.every(path => typeof path.d === 'string' && path.d.length > 1), `${name} emits non-empty path data`);
  }
  assert.doesNotMatch(component, /\.node\.map\(\(\[, attributes\]\) => \(\{ d: attributes\.d \}\)\)/);
});
