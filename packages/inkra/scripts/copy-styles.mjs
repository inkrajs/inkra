import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

await mkdir(new URL('../dist/assets', import.meta.url), { recursive: true });

await Promise.all([
  copyFile(new URL('../src/tokens.css', import.meta.url), new URL('../dist/tokens.css', import.meta.url)),
  copyFile(
    new URL('../src/assets/ui-hand-yozai.woff2', import.meta.url),
    new URL('../dist/assets/ui-hand-yozai.woff2', import.meta.url),
  ),
]);

const styles = await Promise.all([
  'styles.css', 'form/styles.css', 'input-number/styles.css', 'slider/styles.css',
  'selection/selection.css', 'overlay/styles.css', 'select/styles.css', 'tabs/styles.css',
  'tooltip/styles.css', 'accordion/styles.css', 'display/styles.css', 'content/styles.css',
  'dropdown-menu/styles.css', 'slot/styles.css', 'log/styles.css', 'hotkey/styles.css',
  'number-ticker/styles.css', 'audio-player/styles.css', 'carousel/styles.css',
  'choice-grid/styles.css', 'color-swatch/styles.css', 'color-picker/styles.css', 'context-menu/styles.css',
  'dockable-panel/styles.css', 'editable/styles.css', 'flip/styles.css',
  'heatmap/styles.css', 'hover-card/styles.css', 'image-cropper/styles.css',
  'image-viewer/styles.css', 'image-viewer/video.css', 'keypad/styles.css', 'node-graph/styles.css',
  'overflow-list/styles.css', 'pan-zoom/styles.css', 'radar/styles.css',
  'rating/styles.css', 'resizable/styles.css',
  'scroll-area/styles.css', 'sortable/styles.css', 'inventory-grid/styles.css',
  'sparkline/styles.css', 'tag-input/styles.css', 'transfer/styles.css',
  'tree-select/styles.css', 'typewriter/styles.css', 'virtual-list/styles.css',
  'markdown/styles.css',
].map(path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')));
const travelStyles = await Promise.all(['breadcrumb/styles.css', 'calendar/styles.css', 'day-agenda/styles.css', 'journey-map/styles.css'].map(path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')));
const leafletStyles = await readFile(new URL('../../../node_modules/leaflet/dist/leaflet.css', import.meta.url), 'utf8');
const expansionStyles = await Promise.all([
  'toast', 'empty', 'toggle-group', 'alert-dialog', 'drawer', 'date-picker',
  'time-picker', 'pagination', 'command', 'data-table', 'tree', 'upload', 'steps', 'timeline', 'layout',
].map(name => readFile(new URL(`../src/${name}/styles.css`, import.meta.url), 'utf8')));
await writeFile(new URL('../dist/styles.css', import.meta.url), [...styles, leafletStyles, ...travelStyles, ...expansionStyles].join('\n'));
await mkdir(new URL('../dist/images', import.meta.url), { recursive: true });
await Promise.all(['layers.png', 'layers-2x.png', 'marker-icon.png'].map(name => copyFile(new URL(`../../../node_modules/leaflet/dist/images/${name}`, import.meta.url), new URL(`../dist/images/${name}`, import.meta.url))));

// Optional CSS entry points. The established all-in-one stylesheet above stays
// byte-for-byte concatenated in the same order. Nested URLs are rebased here.
await mkdir(new URL('../dist/styles', import.meta.url), { recursive: true });
const baseStyles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
await writeFile(new URL('../dist/styles/base.css', import.meta.url), baseStyles.replaceAll('./tokens.css', '../tokens.css').replaceAll('./assets/', '../assets/'));
const stylePaths = (await readdir(new URL('../src/', import.meta.url), { recursive: true })).filter(path => path.endsWith('/styles.css') || path === 'selection/selection.css');
for (const path of stylePaths) {
  const name = path.split('/')[0];
  const parts = [await readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')];
  if (name === 'image-viewer') parts.push(await readFile(new URL('../src/image-viewer/video.css', import.meta.url), 'utf8'));
  await writeFile(new URL(`../dist/styles/${name}.css`, import.meta.url), parts.join('\n'));
}
await writeFile(new URL('../dist/styles/leaflet.css', import.meta.url), leafletStyles.replaceAll('url(images/', 'url(../images/'));
