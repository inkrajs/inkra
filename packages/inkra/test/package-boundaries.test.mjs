import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
test('optional public family subpaths reference the existing identities',async()=>{
 const root=await import('../dist/index.js');
 for(const [name,part]of Object.entries(pkg.exports)){
  if(name==='.'||typeof part==='string'||!part.import)continue;
  const mod=await import(new URL('../'+part.import,import.meta.url));
  for(const [key,value] of Object.entries(mod)) if(key in root)assert.equal(value,root[key],`${name}:${key}`);
 }
 assert.equal(Object.keys(root).length,261);
 for (const name of ['Markdown', 'ColorSwatch', 'MediaViewer', 'formatColorPaint']) assert(name in root, name);
});
test('optional CSS preserves source rules and rebases font/token/Leaflet URLs',()=>{
 const base=readFileSync(new URL('../dist/styles/base.css',import.meta.url),'utf8');
 assert.equal(base,readFileSync(new URL('../src/styles.css',import.meta.url),'utf8').replaceAll('./tokens.css','../tokens.css').replaceAll('./assets/','../assets/'));
 for(const family of ['form','select','calendar','day-agenda','tag-input','choice-grid'])assert.equal(readFileSync(new URL(`../dist/styles/${family}.css`,import.meta.url),'utf8'),readFileSync(new URL(`../src/${family}/styles.css`,import.meta.url),'utf8'));
 assert.match(readFileSync(new URL('../dist/styles/leaflet.css',import.meta.url),'utf8'),/url\(\.\.\/images\//);
 assert.equal(readFileSync(new URL('../dist/styles/image-viewer.css',import.meta.url),'utf8'), ['styles.css','video.css'].map(name => readFileSync(new URL(`../src/image-viewer/${name}`,import.meta.url),'utf8')).join('\n'));
 for(const [key,path]of Object.entries(pkg.exports))if(key.startsWith('./styles/'))assert(existsSync(new URL('../'+path,import.meta.url)),key);
 assert.deepEqual(pkg.sideEffects,['**/*.css']);
});
