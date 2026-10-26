import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const component = readFileSync(new URL('../src/image-viewer/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/image-viewer/styles.css', import.meta.url), 'utf8');
const geometry = readFileSync(new URL('../src/image-viewer/lucideGeometry.ts', import.meta.url), 'utf8');
const modelSource = readFileSync(new URL('../src/image-viewer/model.ts', import.meta.url), 'utf8');
const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const geometryModule = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(geometry, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText).toString('base64')}`);
const modelModule = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(modelSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText).toString('base64')}`);
const { nextImageViewerIndex, resolveImageViewerSelection } = modelModule;

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
  assert.doesNotMatch(component, /<OverlayHeader/);
  assert.match(component, /<OverlayTitle className="inkra-image-viewer__accessible-label"/);
  assert.match(component, /<OverlayDescription className="inkra-image-viewer__accessible-label"/);
  assert.match(component, /className="inkra-image-viewer__close-control"/);
  assert.match(component, /<OverlayCloseButton[\s\S]*?label=\{labels\.close\}/);
  assert.match(component, /surfaceVariant="ghost"/);
  assert.doesNotMatch(component, /surfaceVariant="full"/);
  assert.match(styles, /\.inkra-image-viewer > \.inkra-overlay__surface \{[\s\S]*?block-size: 0;[\s\S]*?inline-size: 0/);
  assert.match(styles, /> \.inkra-overlay__surface > \.inkra-pencil-surface__ink \{ display: none !important/);
  assert.match(styles, /> \.inkra-overlay__surface > \.inkra-overlay__content-body \{[\s\S]*?background: var\(--inkra-paper\);[\s\S]*?height: 100dvh;[\s\S]*?position: fixed;[\s\S]*?width: 100dvw/);
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
  assert.match(styles, /\.inkra-image-viewer\.inkra-overlay__content \{[\s\S]*?height: 100dvh;[\s\S]*?inset: 0;[\s\S]*?left: 0;[\s\S]*?transform: none;[\s\S]*?width: 100dvw/);
  assert.match(styles, /> \.inkra-overlay__surface[\s\S]*?border-radius: 0/);
  assert.match(styles, /\.inkra-image-viewer__body \{[\s\S]*?flex: 1 1 auto;[\s\S]*?min-block-size: var\(--inkra-touch-target\)/);
  assert.match(styles, /\.inkra-image-viewer__bottom \{[\s\S]*?flex: none;[\s\S]*?max-block-size:/);
  assert.match(styles, /\.inkra-image-viewer__thumbnail[\s\S]*?block-size: 3\.75rem/);
  assert.match(styles, /\.inkra-image-viewer__thumbnail[\s\S]*?flex: 0 0 5rem/);
  assert.match(styles, /\.inkra-image-viewer__thumbnails[\s\S]*?justify-content: safe center/);
  assert.match(styles, /@media \(max-height: 30rem\)[\s\S]*?\.inkra-image-viewer__bottom-row[\s\S]*?justify-content: safe center/);
  assert.match(styles, /@media \(max-height: 30rem\)[\s\S]*?\.inkra-image-viewer__thumbnail \{ block-size: var\(--inkra-touch-target\)/);
  assert.match(styles, /object-fit: contain/);
  assert.match(styles, /@media \(max-width: 30rem\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
});

test('ImageViewer keeps RTL tools physically centered and bounds short-view header/tools', () => {
  for (const region of ['bottom', 'bottom-row', 'tools', 'thumbnails']) {
    const rule = styles.match(new RegExp('\\.inkra-image-viewer__' + region + '\\s*\\{([^}]+)\\}'))?.[1];
    assert.match(rule, /scrollbar-gutter: auto;/, region + ' does not reserve an unused side gutter');
  }
  assert.doesNotMatch(styles, /\.inkra-image-viewer__tools\s*\{[\s\S]*?left: 50%/);
  assert.doesNotMatch(styles, /\.inkra-image-viewer \.inkra-overlay__header/);
  assert.match(styles, /\.inkra-image-viewer__bottom-row\s*\{[\s\S]*?justify-content: center/);
  assert.match(styles, /\.inkra-image-viewer__bottom-row\s*\{[\s\S]*?overflow-x: auto/);
  assert.match(component, /className="inkra-image-viewer__counter" dir="auto"/);
  assert.match(styles, /\.inkra-image-viewer__counter\s*\{[\s\S]*?flex: 0 0 auto;[\s\S]*?unicode-bidi: isolate;[\s\S]*?white-space: nowrap/);
  assert.doesNotMatch(styles, /\.inkra-image-viewer__counter\s*\{[\s\S]*?direction: ltr/);
  assert.match(styles, /\.inkra-image-viewer__tools\s*\{[\s\S]*?max-inline-size: 100%;[\s\S]*?overflow-x: auto/);
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
  assert.match(styles, /\.inkra-pencil-surface\.inkra-image-viewer__stage-focus,[\s\S]*?display: none !important/);
  assert.match(styles, /\.inkra-image-viewer__stage:focus-visible,[\s\S]*?outline: var\(--inkra-focus-width\) solid Highlight/);
});

test('ImageViewer keeps controlled id repair and per-image transform reset bounded', () => {
  assert.match(component, /repairRef\.current === repairKey/);
  assert.match(component, /commitActiveId\(selection\.activeId, 'items-change'\)/);
  assert.match(component, /const activeItemKey = activeItem \? JSON\.stringify\(\[activeItemType, activeItem\.id, activeItem\.src\]\) : undefined/);
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

test('ImageViewer exposes MediaViewer compatibility and routes locked video resources', () => {
  assert.match(component, /type\?: 'image' \| 'video'/);
  assert.match(component, /poster\?: string/);
  assert.match(component, /videoLabels\?: Partial<VideoResourceLabels>/);
  assert.match(component, /open: openControlled \? Boolean\(open\) : internalOpen/);
  assert.match(component, /activeItemType === 'video' && open \? <VideoResource/);
  assert.match(component, /labels=\{videoLabels\}/);
  assert.match(component, /poster=\{activeItem\.poster\}/);
  assert.match(component, /activeItemType === 'image' && !failed && \(zoomable \|\| rotatable\)/);
  assert.match(component, /total > 1 && activeItemType === 'image' \? <div className="inkra-image-viewer__navigation"/);
  assert.match(component, /activeItem && activeItemType === 'video' && total > 1 \? <div className="inkra-image-viewer__video-navigation"/);
  assert.match(styles, /\.inkra-image-viewer__video-navigation[\s\S]*?align-self: center;[\s\S]*?display: flex/);
  assert.match(component, /item\.type === 'video' \? playPaths : imageOffPaths/);
  assert.match(component, /className="inkra-image-viewer__thumbnail-video"[\s\S]*?variant="paper"/);
  assert.match(styles, /\.inkra-image-viewer__thumbnail-video[\s\S]*?pointer-events: none/);
  assert.match(component, /export const MediaViewer = ImageViewer/);
  for (const alias of ['MediaViewerItem', 'MediaViewerLabels', 'MediaViewerRootProps', 'MediaViewerContentProps']) {
    assert.match(component, new RegExp(`export type ${alias}`));
  }
  assert.match(component, /export type \{ VideoResourceLabels \} from '\.\/VideoResource\.js'/);
});

test('ImageViewer converts all Lucide node geometry before PencilIcon rendering', async () => {
  assert.equal((component.match(/lucideNodesToPencilPaths\(/g) ?? []).length, 7);
  for (const tag of ['path', 'line', 'circle']) {
    assert.match(geometry, new RegExp(`tag === '${tag}'`));
  }
  for (const tag of ['polyline', 'polygon', 'rect', 'ellipse']) assert.doesNotMatch(geometry, new RegExp(`tag === '${tag}'`));
  assert.match(geometry, /return nodes\.flatMap/);
  for (const name of ['chevron-left', 'chevron-right', 'image-off', 'play', 'rotate-cw', 'zoom-in', 'zoom-out']) {
    const icon = (await import(`lucide-react/dist/esm/icons/${name}.mjs`)).__iconData;
    const paths = geometryModule.lucideNodesToPencilPaths(icon.node);
    assert.equal(paths.length, icon.node.length, `${name} retains every actual node`);
    assert(paths.every(path => typeof path.d === 'string' && path.d.length > 1), `${name} emits non-empty path data`);
  }
  assert.doesNotMatch(component, /\.node\.map\(\(\[, attributes\]\) => \(\{ d: attributes\.d \}\)\)/);
});

test('ImageViewer fullscreen shell avoids a viewport-sized decorative surface canvas', () => {
  assert.match(component, /surfaceVariant="ghost"/);
  assert.doesNotMatch(component, /surfaceVariant="full"/);
  assert.match(styles, /> \.inkra-overlay__surface \{[\s\S]*?block-size: 0;[\s\S]*?inline-size: 0/);
  assert.match(styles, /> \.inkra-overlay__surface > \.inkra-pencil-surface__ink \{ display: none !important/);
  assert.match(styles, /> \.inkra-overlay__surface > \.inkra-overlay__content-body \{[\s\S]*?background: var\(--inkra-paper\);[\s\S]*?height: 100dvh;[\s\S]*?width: 100dvw/);
});

test('image tools float over the stage and the optional counter leaves no empty footer', () => {
  assert.match(component, /showCounter\?: boolean/);
  assert.match(component, /showCounter = false/);
  assert.match(component, /toolbarPosition = 'top'/);
  assert.match(component, /className="inkra-image-viewer__floating-tools" data-position=\{toolbarPosition\}/);
  assert.match(component, /showCounter && total > 0 \? <PencilText/);
  assert.match(styles, /\.inkra-image-viewer__floating-tools \{[^}]*pointer-events: none;/);
  assert.match(styles, /\.inkra-image-viewer__floating-tools\[data-position="bottom"\]/);
  const body = component.indexOf('className="inkra-image-viewer__body"');
  const tools = component.indexOf('className="inkra-image-viewer__floating-tools"');
  const bottom = component.indexOf('className="inkra-image-viewer__bottom"');
  assert(body < tools && tools < bottom);
});
