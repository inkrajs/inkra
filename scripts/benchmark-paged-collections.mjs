// Serial isolated renderer evidence. Explicit paging changes the data/rendering
// contract; this does not claim automatic acceleration of unchanged defaults.
import { spawnSync, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
if(process.argv[2]==='--case'){
 const [kind,mode,sizeText,distPath]=process.argv.slice(3),size=Number(sizeText);
 const {createElement:h}=await import('react');const {create,act}=await import('react-test-renderer');globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const { [kind]:Component }=await import(pathToFileURL(resolve(distPath,kind==='DataTable'?'data-table/index.js':'transfer/index.js')));
 const data=Array.from({length:size},(_,i)=>({id:String(i),label:`Row ${i}`}));let rowIds=0;
 const columns=[{accessorKey:'label',header:'Label'}];
 const props=kind==='DataTable'?{data:mode==='paged'?data.slice(0,25):data,columns,getRowId:r=>{rowIds++;return r.id;},pagination:true,manualPagination:mode==='paged',rowCount:size,defaultPagination:{pageIndex:0,pageSize:25}}:{items:data,pageSize:mode==='paged'?25:undefined,searchable:false};
 const changedData=data.map((r,i)=>i===0?{...r,label:'Changed'}:r);
 const changed=kind==='DataTable'?{...props,data:mode==='paged'?changedData.slice(0,25):changedData}:{...props,items:changedData};
 const samples={mount:[],stable:[],changed:[],unmount:[]},counts=[];let nodes;
 for(let i=-1;i<Number(process.env.BENCH_REPETITIONS||7);i++){
  let r;let phaseCounts={};
  for(const [phase,work] of [['mount',()=>{r=create(h(Component,props));}],['stable',()=>r.update(h(Component,props))],['changed',()=>r.update(h(Component,changed))]]){
   rowIds=0;const start=performance.now();await act(work);if(i>=0)samples[phase].push(performance.now()-start);phaseCounts[phase]=rowIds;
  }
  nodes=r.root.findAll(n=>typeof n.type==='string').length;
  assert(kind!=='DataTable'||r.root.findAllByType('tbody')[0].findAllByType('tr').length===25);
  const start=performance.now();await act(()=>r.unmount());if(i>=0){samples.unmount.push(performance.now()-start);counts.push(phaseCounts);}
 }
 const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
 console.log(JSON.stringify({kind,mode,size,hostNodes:nodes,rowIdCalls:counts,samples,medianMs:Object.fromEntries(Object.entries(samples).map(([k,v])=>[k,median(v)])),maxRssKiB:process.resourceUsage().maxRSS}));
}else{
 const baseline=resolve(process.argv[2]||'../followup-baseline/packages/inkra/dist');
 const result={schemaVersion:1,node:process.version,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:false,serial:true,repetitions:Number(process.env.BENCH_REPETITIONS||7),warmups:1,timeoutMs:45000,heapMiB:768,limit:'Isolated renderer whole-case budget; timeout is not a single operation or original crash.',results:[]};
 for(const kind of ['DataTable','Transfer'])for(const size of (process.env.BENCH_SIZES||'1000,10000').split(',').map(Number))for(const mode of ['baseline-full','current-full','current-paged']){
  const dist=mode.startsWith('baseline')?baseline:resolve('packages/inkra/dist');
  const child=spawnSync(process.execPath,['--max-old-space-size=768',new URL(import.meta.url).pathname,'--case',kind,mode.endsWith('paged')?'paged':'full',String(size),dist],{timeout:45000,maxBuffer:4*1024*1024,encoding:'utf8'});
  let record;try{assert.equal(child.status,0);record={...JSON.parse(child.stdout),status:'measured',variant:mode};}catch{record={kind,size,variant:mode,status:child.error?.code==='ETIMEDOUT'?'timeout':'failed',signal:child.signal,stderr:child.stderr.slice(-1800)};}
  result.results.push(record);console.error(kind,size,mode,record.status);
 }
 console.log(JSON.stringify(result,null,2));
}
