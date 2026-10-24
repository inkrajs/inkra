import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';import {resolve} from 'node:path';
const root=resolve(process.argv[2]||'.');const out=resolve(root,'.inkra-perf');await mkdir(out,{recursive:true});
await copyFile(new URL('./performance-fixture.html',import.meta.url),resolve(out,'index.html'));
let source=await readFile(new URL('./performance-fixture.tsx',import.meta.url),'utf8');
const familyNames=['base','form','slider','selection','overlay','select','tabs','tooltip','display','content','audio-player','choice-grid','calendar','day-agenda','tag-input','transfer','data-table','alert-dialog','context-menu','dropdown-menu','drawer','hover-card','image-viewer','pan-zoom','scroll-area','timeline','heatmap','toggle-group','pagination','radar','rating'];
source=source.replace(/for\(const family of \[[^\n]+\]\) await import\(`@inkra\/react\/styles\/\$\{family\}\.css`\);/, '{'+familyNames.map(n=>`await import('@inkra/react/styles/${n}.css');`).join('')+'}');
await writeFile(resolve(out,'performance-fixture.tsx'),source);
await writeFile(resolve(out,'vite.config.mjs'),`export default {root:new URL('.',import.meta.url).pathname,resolve:{dedupe:['react','react-dom']},build:{outDir:new URL('../.inkra-perf-dist',import.meta.url).pathname,emptyOutDir:true},server:{host:'127.0.0.1'}};`);
console.log('Prepared an isolated fixture in the consumer. Build with its installed Vite using .inkra-perf/vite.config.mjs. No source alias.');
