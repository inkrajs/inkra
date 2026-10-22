import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

await mkdir(new URL('../dist/assets', import.meta.url), { recursive: true });

await Promise.all([
  copyFile(new URL('../src/tokens.css', import.meta.url), new URL('../dist/tokens.css', import.meta.url)),
  copyFile(
    new URL('../src/assets/ui-hand-yozai.woff2', import.meta.url),
    new URL('../dist/assets/ui-hand-yozai.woff2', import.meta.url),
  ),
]);

const styles = await Promise.all(['styles.css', 'form/styles.css', 'input-number/styles.css', 'slider/styles.css', 'selection/selection.css', 'overlay/styles.css', 'select/styles.css', 'tabs/styles.css', 'tooltip/styles.css', 'accordion/styles.css', 'display/styles.css', 'content/styles.css', 'dropdown-menu/styles.css'].map(path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')));
const travelStyles = await Promise.all(['breadcrumb/styles.css', 'calendar/styles.css', 'day-agenda/styles.css', 'journey-map/styles.css'].map(path => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8')));
const leafletStyles = await readFile(new URL('../../../node_modules/leaflet/dist/leaflet.css', import.meta.url), 'utf8');
const expansionStyles = await Promise.all([
  'toast', 'empty', 'toggle-group', 'alert-dialog', 'drawer', 'date-picker',
  'time-picker', 'pagination', 'command', 'data-table', 'tree', 'upload', 'steps', 'timeline', 'layout',
].map(name => readFile(new URL(`../src/${name}/styles.css`, import.meta.url), 'utf8')));
await writeFile(new URL('../dist/styles.css', import.meta.url), [...styles, leafletStyles, ...travelStyles, ...expansionStyles].join('\n'));
await mkdir(new URL('../dist/images', import.meta.url), { recursive: true });
await Promise.all(['layers.png', 'layers-2x.png', 'marker-icon.png'].map(name => copyFile(new URL(`../../../node_modules/leaflet/dist/images/${name}`, import.meta.url), new URL(`../dist/images/${name}`, import.meta.url))));
