import{chromium}from'playwright';import{mkdir,writeFile}from'node:fs/promises';import{resolve}from'node:path';
const{createCanvas,loadImage}=await import(process.env.INKRA_CANVAS_MODULE||'@napi-rs/canvas');const out=resolve(process.env.BROWSER_OUTPUT||'.local/surface-comparison');await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE});const results=[];
async function equalPixels(a,b){const imgs=await Promise.all([loadImage(a),loadImage(b)]);const data=imgs.map(img=>{const canvas=createCanvas(img.width,img.height);const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return ctx.getImageData(0,0,img.width,img.height).data;});let count=0;for(let i=0;i<data[0].length;i+=4)if([0,1,2,3].some(k=>data[0][i+k]!==data[1][i+k]))count++;return count;}
const frames=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
try{for(const kind of ['ChoiceGrid','TagInput']){
 const shots={};const records=[];
 for(const variant of ['baseline','current']){
  const context=await browser.newContext({viewport:{width:1100,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));const base=variant==='baseline'?(process.env.INKRA_SURFACE_BASELINE_URL||'http://127.0.0.1:4183'):(process.env.INKRA_BROWSER_URL||'http://127.0.0.1:4182');
  try{await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.fixtureBooted);await page.evaluate(kind=>window.mountFixture(kind,100,false),kind);await page.waitForFunction(()=>window.fixtureReady);await page.evaluate(()=>document.fonts.ready);await frames(page);shots[variant]={top:await page.screenshot()};
   const row=page.locator(kind==='ChoiceGrid'?'.inkra-choice-grid__option':'.inkra-tag-input__tag').last();
   const initial=await row.locator(':scope > canvas').first().evaluate(c=>({width:c.width,height:c.height,top:c.getBoundingClientRect().top}));
   await row.scrollIntoViewIfNeeded();await frames(page);await page.waitForFunction(selector=>{const list=document.querySelectorAll(selector);return list[list.length-1]?.querySelector('canvas')?.width>0;},kind==='ChoiceGrid'?'.inkra-choice-grid__option':'.inkra-tag-input__tag');
   shots[variant].bottom=await page.screenshot();await page.evaluate(()=>document.documentElement.dataset.theme='dark');await frames(page);shots[variant].darkBottom=await page.screenshot();await page.evaluate(()=>scrollTo(0,0));await frames(page);shots[variant].darkTop=await page.screenshot();
   if(kind==='ChoiceGrid'){await page.keyboard.press('Tab');await page.getByLabel('Record 0',{exact:true}).focus();const focus=page.locator('.inkra-choice-grid__option').first().locator('.inkra-choice-grid__focus canvas');const painted=await focus.evaluate(c=>({width:c.width,hasAlpha:c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)}));if(!painted.width||!painted.hasAlpha)throw Error('First focus ring was not prepainted');}
   records.push({variant,status:'passed',initialOffscreenCanvas:initial,errors});if(errors.length)throw Error(errors.join(';'));
  }catch(e){records.push({variant,status:'failed',error:String(e)});}finally{await context.close();}
 }
 const differences={};for(const state of ['top','bottom','darkBottom','darkTop'])if(shots.baseline?.[state]&&shots.current?.[state])differences[state]=await equalPixels(shots.baseline[state],shots.current[state]);
 results.push({kind,records,pixelDifferences:differences});console.log(kind,JSON.stringify(differences));await writeFile(resolve(out,'surface-visuals.json'),JSON.stringify({method:'Identical full DOM/data. Visible top, newly revealed bottom and theme changes compared by screenshot pixels; first keyboard focus material checked before another drawing frame.',results},null,2));
}}finally{await browser.close();}
