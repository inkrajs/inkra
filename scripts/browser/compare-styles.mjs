import {chromium} from 'playwright';import{mkdir,writeFile}from'node:fs/promises';import{resolve}from'node:path';
const base=process.env.INKRA_BROWSER_URL||'http://127.0.0.1:4182';const out=resolve(process.env.BROWSER_OUTPUT||'.local/browser-performance');await mkdir(out,{recursive:true});
const {createCanvas,loadImage}=await import(process.env.INKRA_CANVAS_MODULE||'@napi-rs/canvas');
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});const report=[];
try{for(const kind of ['Canvas','Select.Portal']){
const screenshots=[];const variants=[];
for(const css of ['full','split']){
 const context=await browser.newContext({viewport:{width:1000,height:700},deviceScaleFactor:1});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+`/?css=${css==='split'?(kind==='Canvas'?'button':'select'):'full'}`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.fixtureBooted);await page.evaluate(kind=>window.mountFixture(kind,3,true),kind);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(700);
 const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');
 screenshots.push(await page.screenshot());variants.push({css,errors,resources:await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('.css')).map(r=>({name:new URL(r.name).pathname,encodedBodySize:r.encodedBodySize,transferSize:r.transferSize})))});await context.close();
}
const images=await Promise.all(screenshots.map(loadImage));const pixels=images.map(img=>{const c=createCanvas(img.width,img.height);c.getContext('2d').drawImage(img,0,0);return c.getContext('2d').getImageData(0,0,img.width,img.height).data;});let changed=0;for(let i=0;i<pixels[0].length;i+=4)if([0,1,2,3].some(j=>pixels[0][i+j]!==pixels[1][i+j]))changed++;
report.push({kind,variants,pixelDifferences:changed,totalPixels:images[0].width*images[0].height});console.log(kind,changed,'different pixels');
}}finally{await browser.close();await writeFile(resolve(out,'style-comparison.json'),JSON.stringify(report,null,2));}
