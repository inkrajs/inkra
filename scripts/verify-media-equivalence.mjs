import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';

const baseline = process.argv[2];
assert.ok(baseline, 'Usage: node scripts/verify-media-equivalence.mjs /path/to/baseline/packages/inkra/dist');
const candidate = fileURLToPath(new URL('../packages/inkra/dist', import.meta.url));
let checked = 0;
async function compare(module, name, cases) {
  const before = await import(pathToFileURL(join(resolve(baseline), module, 'index.js')).href);
  const after = await import(pathToFileURL(join(candidate, module, 'index.js')).href);
  for (const props of cases) {
    assert.equal(render(h(after[name], props)), render(h(before[name], props)), `${module}/${name}: comparison ${checked + 1}`);
    checked++;
  }
}
const events = [
  { id: 'a', title: 'Overnight', startMinute: -60, endMinute: 90 },
  { id: 'b', title: 'Long', startMinute: 120, endMinute: 500 },
  { id: 'c', title: 'Point', startMinute: 200 },
  { id: 'd', title: 'Equal point', startMinute: 200 },
  { id: 'e', title: 'Late', startMinute: 1380, endMinute: 1500 },
  { id: 'f', title: 'Pending' },
];
await compare('day-agenda', 'DayAgenda', ['h12', 'h23'].flatMap(hourCycle => ['compact', 'comfortable'].flatMap(density => ['en-US', 'zh-CN'].map(locale => ({ date: '2026-10-23', events, hourCycle, density, locale, selectedEvent: 'c', onEventSelect() {} })))));
await compare('day-agenda', 'DayAgenda', [{ date: 'invalid', events: [] }, { date: '2026-10-23', events, disabled: true, divided: false, showDescriptions: false, showOverview: false }]);
const axes = [{ id: 'a', label: 'A', min: -10, max: 10 }, { id: 'b', label: 'B' }, { id: 1, label: 'Numeric' }, { id: '1', label: 'String' }];
const series = [{ id: 'one', label: 'One', data: [{ axisId: 'a', value: -4 }, { axisId: 'b', value: 0 }, { axisId: 1, value: 4 }, { axisId: '1', value: 10 }, { axisId: '1', value: 50 }] }, { id: 'two', label: 'Two', data: [{ axisId: 'b', value: 4 }] }, { id: 'hidden', hidden: true, label: 'Hidden', data: [{ axisId: 'a', value: 100 }] }];
await compare('radar', 'Radar', [null, 'one', 'two'].flatMap(selectedSeries => [true, false].map(showAxes => ({ axes, series, label: 'Profile', selectedSeries, showAxes }))));
await compare('radar', 'Radar', [{ axes: [{ id: NaN, label: 'Invalid' }, ...axes], series: [{ id: 'nan', label: 'NaN key', data: [{ axisId: NaN, value: 50 }] }], label: 'Edge keys' }]);
await compare('sparkline', 'Sparkline', [[1, null, -2, 5], [0, 0], [null], []].flatMap(data => ['line', 'bar'].map(type => ({ data, type, label: 'Trend' }))));
await compare('typewriter', 'Typewriter', ['Text\n spaces', '👩🏽‍💻中文é', ''].map(children => ({ children })));
await compare('number-ticker', 'NumberTicker', [1200, -4.5, 12345678901234567890n, '123.456'].flatMap(value => [false, true].map(compact => ({ value, compact }))));
await compare('carousel', 'Carousel', [0, 1, 2].map(currentIndex => ({ currentIndex, dir: 'rtl', children: [h('p', { key: 'a' }, 'A'), h('p', { key: 'b' }, 'B'), h('p', { key: 'c' }, 'C')] })));
await compare('pan-zoom', 'PanZoom', [{ children: 'Content' }, { children: h('button', null, 'Action'), value: { x: 20, y: -10, scale: 2 }, readOnly: true }]);
await compare('flip', 'Tilt', [{ children: 'Tilt', axis: 'x' }, { children: 'Rest', disabled: true }]);
await compare('flip', 'Flip', [false, true].map(flipped => ({ flipped, tilt: true, front: h('a', { href: '/front' }, 'Front'), back: h('button', null, 'Back') })));
await compare('audio-player', 'AudioPlayer', [{ src: 'example.mp3', renderControls: () => null }, { defaultMuted: true, defaultVolume: 0.5 }]);
await compare('image-cropper', 'ImageCropper', [{ source: '', alt: 'Crop', showControls: false }, { source: '', alt: 'Free crop', aspect: 'free' }]);
await compare('journey-map', 'JourneyMap', [{ places: [{ id: 'place', label: 'Place', latitude: 12, longitude: 14 }], attribution: 'Illustration', showControls: false }]);
console.log(`${checked} deterministic media SSR comparisons matched the baseline. This is not browser pixel or gesture validation.`);
