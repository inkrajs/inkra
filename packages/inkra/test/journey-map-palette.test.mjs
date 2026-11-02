import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { JourneyMap, defaultJourneyMapPalette } from '../dist/journey-map/index.js';
import { resolveJourneyMapPalette } from '../dist/journey-map/palette.js';
import { paintTerrain } from '../dist/journey-map/terrain.js';

test('partial schemes retain untouched original pigments and merge dark overrides without mutation', () => {
 const input = { terrain: { forest: { fill: '#123456' } }, dark: { terrain: { forest: { stroke: '#aabbcc' } }, road: '#ffffff' } };
 const before = JSON.stringify(input), light = resolveJourneyMapPalette(input, false), dark = resolveJourneyMapPalette(input, true);
 assert.deepEqual(light.terrain.forest, { fill: '#123456', stroke: defaultJourneyMapPalette.terrain.forest.stroke });
 assert.deepEqual(dark.terrain.forest, { fill: '#123456', stroke: '#aabbcc' });
 assert.deepEqual(light.terrain.water, defaultJourneyMapPalette.terrain.water);
 assert.equal(dark.road, '#ffffff'); assert.equal(JSON.stringify(input), before);
 assert.equal(resolveJourneyMapPalette(undefined, true).terrain.land.stroke, defaultJourneyMapPalette.terrain.land.fill);
 assert.equal(resolveJourneyMapPalette(undefined, false).terrain.forest.fill, '#a7c7ad');
});
test('custom feature categories preserve water fallback and avoid prototype-key collisions', () => {
 const colors = resolveJourneyMapPalette({ terrain: { lava: { fill: '#ff5500' }, toString: { fill: '#123123' } } }, false);
 assert.equal(colors.terrain.lava.fill, '#ff5500'); assert.equal(colors.terrain.toString.fill, '#123123');
 const geometry = { type: 'Polygon', coordinates: [[[0,0],[50,0],[50,50],[0,50],[0,0]]] };
 const fills = [], strokes = [];
 const ctx = { globalAlpha: 1, save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},stroke(){strokes.push(this.strokeStyle);},fillRect(){fills.push(this.fillStyle);} };
 paintTerrain(ctx, { type: 'Feature', properties: { id: 1234 }, geometry }, p=>p, 100,100,false,'water',false,colors);
 assert(fills.includes(defaultJourneyMapPalette.terrain.water.fill)); assert(!fills.includes(defaultJourneyMapPalette.terrain.land.fill));
 fills.length=0;
 paintTerrain(ctx, { type: 'Feature', properties: { mapRole: 'lava' }, geometry }, p=>p,100,100,false,'water',false,colors);
 assert(fills.includes('#ff5500'));
});
test('renderer uses explicit fill and stroke independently, including in dark themes', () => {
 const colors = resolveJourneyMapPalette({ terrain: { land: { fill: '#cc2200', stroke: '#00aaff' } } }, true);
 const fills=[], strokes=[];
 const ctx={globalAlpha:1,save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},stroke(){strokes.push(this.strokeStyle);},fillRect(){fills.push(this.fillStyle);}};
 paintTerrain(ctx,{type:'Polygon',coordinates:[[[0,0],[100,0],[100,100],[0,100],[0,0]]]},p=>p,100,100,true,'land',false,colors);
 assert(fills.includes('#cc2200'));assert(strokes.includes('#00aaff'));
});
test('browser color resolution may reject invalid values; palette imports and SSR need no DOM', () => {
 const colors=resolveJourneyMapPalette({road:'invalid',sea:{stroke:'var(--inkra-accent)' }},false,'#123456',(value,fallback)=>value==='invalid'?fallback:value==='var(--inkra-accent)'?'#aabbcc':value??fallback);
 assert.equal(colors.road,'#123456');assert.equal(colors.sea.stroke,'#aabbcc');
 const html=render(h(JourneyMap,{places:[],attribution:'Test',palette:{terrain:{forest:{fill:'#123456'}}}}));
 assert(!html.includes('palette='));assert(html.includes('Test'));
});
