import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const modules={TagInput:'tag-input',ChoiceGrid:'choice-grid',Calendar:'calendar',DayAgenda:'day-agenda'};
if(process.argv[2]==='--case'){
 const [name,mode,n,distPath]=process.argv.slice(3),size=Number(n),dist=resolve(distPath);
 const {createElement:h}=await import('react');const {create,act}=await import('react-test-renderer');globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const api=await import(pathToFileURL(resolve(dist,modules[name],'index.js')));
 const records=Array.from({length:size},(_,i)=>({id:String(i),value:`Tag ${i}`,label:`Entry ${i}`,title:`Event ${i}`,date:new Date(2026,0,10),startMinute:60+i%1200,endMinute:80+i%1200}));
 const selected=records.filter((_,i)=>i%10===0).map(r=>r.value);const options=records.map(r=>h(api.ChoiceGridOption||'span',{key:r.id,value:r.value,label:r.label}));
 let props,children;
 if(name==='TagInput')props={value:records,name:'tags',maxVisibleTags:mode==='bounded'?25:undefined};
 if(name==='ChoiceGrid'){props={type:'multiple',label:'Choices',name:'choices',values:selected,pageSize:mode==='bounded'?25:undefined};children=options;}
 if(name==='Calendar')props={events:records,month:new Date(2026,0,1),maxEventsPerDay:mode==='bounded'?3:undefined};
 if(name==='DayAgenda')props={events:records,date:'2026-01-10',maxVisibleEvents:mode==='bounded'?25:undefined};
 const samples={mount:[],stable:[],unmount:[],heapAfterUnmount:[]},nodeCounts=[];
 for(let i=-1;i<Number(process.env.BENCH_REPETITIONS||7);i++){
  let r;let t=performance.now();await act(()=>{r=create(h(api[name],props,children));});if(i>=0)samples.mount.push(performance.now()-t);
  t=performance.now();await act(()=>r.update(h(api[name],props,children)));if(i>=0){samples.stable.push(performance.now()-t);nodeCounts.push(r.root.findAll(n=>typeof n.type==='string').length);}
  t=performance.now();await act(()=>r.unmount());r=null;if(i>=0)samples.unmount.push(performance.now()-t);globalThis.gc?.();if(i>=0)samples.heapAfterUnmount.push(process.memoryUsage().heapUsed);
 }
 const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
 console.log(JSON.stringify({name,size,mode,nodeCounts,samples,median:Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,median(v)])),maxRssKiB:process.resourceUsage().maxRSS}));
}else{
 const baseline=resolve(process.argv[2]||'../followup-baseline/packages/inkra/dist'),current=resolve('packages/inkra/dist');
 const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
 const report={schemaVersion:1,node:process.version,serial:true,repetitions:Number(process.env.BENCH_REPETITIONS||7),warmups:1,heapMiB:768,timeoutMs:45000,browser:false,sourceHashes:Object.fromEntries(Object.entries(modules).map(([k,m])=>[k,{baseline:hash(resolve(baseline,m,'index.js')),current:hash(resolve(current,m,'index.js'))}])),limits:'10k full output deliberately excluded on this laptop after Transfer full output hit the artificial heap cap. Not a product crash or universal budget. Explicit summaries preserve data but change initial visible output.',results:[]};
 for(const name of Object.keys(modules))for(const size of [100,1000,10000])for(const variant of size===10000?['current-bounded']:['baseline-full','current-full','current-bounded']){
  const child=spawnSync(process.execPath,['--expose-gc','--max-old-space-size=768',new URL(import.meta.url).pathname,'--case',name,variant.endsWith('bounded')?'bounded':'full',String(size),variant.startsWith('baseline')?baseline:current],{timeout:45000,maxBuffer:4*1024*1024,encoding:'utf8'});
  let record;try{if(child.status!==0)throw 0;record={...JSON.parse(child.stdout),variant,status:'measured'};}catch{record={name,size,variant,status:child.error?.code==='ETIMEDOUT'?'timeout':'failed',signal:child.signal,stderr:child.stderr.slice(-1500)};}
  report.results.push(record);console.error(name,size,variant,record.status);
 }
 console.log(JSON.stringify(report,null,2));
}
