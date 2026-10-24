import{chromium}from'playwright';import{mkdir,writeFile}from'node:fs/promises';import{resolve}from'node:path';import{installResourceProbe}from'./resource-probe.mjs';
const out=resolve(process.env.BROWSER_OUTPUT||'.local/browser-performance');await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--js-flags=--max-old-space-size=768']});const result={schemaVersion:1,browser:browser.version(),serial:true,instrumented:true,weakObservations:true,method:'Observer targets/listeners held only weakly. Counts compare post-unmount/GC after warmup; delegation and bounded caches may persist. Not an unconditional leak proof.',cases:[]};
try{for(const kind of ['Canvas','Transfer','DataTable','SearchableSelect','Tabs','Popover.Portal','HoverCard.Content','ImageViewer.Content']){
 const context=await browser.newContext({viewport:{width:1100,height:900}});await context.addInitScript(installResourceProbe);const page=await context.newPage();page.setDefaultTimeout(15000);const cdp=await context.newCDPSession(page);const r={kind,cycles:100,status:'measured',samples:[]};
 try{await page.goto(process.env.INKRA_BROWSER_URL||'http://127.0.0.1:4182',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.fixtureBooted);
 for(let i=-5;i<=100;i++){
  await page.evaluate(kind=>window.mountFixture(kind,5,true),kind);await page.waitForTimeout(50);await page.evaluate(()=>window.unmountFixture());await page.waitForTimeout(50);
  if([0,10,25,50,100].includes(i)){await page.waitForTimeout(400);await cdp.send('HeapProfiler.collectGarbage');const resources=await page.evaluate(()=>window.snapshotResources());await cdp.send('HeapProfiler.collectGarbage');r.samples.push({cycle:i,resources,dom:await cdp.send('Memory.getDOMCounters'),heap:await cdp.send('Runtime.getHeapUsage')});}
 }
 }catch(e){r.status='failed';r.error=String(e);}finally{await context.close();}result.cases.push(r);console.log(kind,r.status);await writeFile(resolve(out,'resource-results.json'),JSON.stringify(result,null,2));}
}finally{await browser.close();}
