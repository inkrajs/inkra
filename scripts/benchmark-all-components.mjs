// Inventory-driven metrics: shared fixture totals are never isolated component costs.
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import assert from 'node:assert/strict';
import { benchmarkProvenance } from './benchmark-provenance.mjs';
const groups=['lead','controls-media','collections'];
const repetitions=Number(process.env.PERF_REPETITIONS||7);
const timeout=Number(process.env.PERF_TIMEOUT_MS||30000);
const inventoryPath=process.env.PERF_INVENTORY||'docs/component-performance-inventory.json';
const output=process.env.PERF_OUTPUT||'.local/all-components';
const inventory=JSON.parse(await readFile(inventoryPath,'utf8'));
const stats=values=>{const sorted=[...values].sort((a,b)=>a-b),mean=values.reduce((a,b)=>a+b,0)/values.length;return {n:values.length,samples:values,median:sorted[Math.floor(values.length/2)],min:sorted[0],max:sorted.at(-1),mean,stddev:Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length)};};
function resolveExport(library,identity){return identity.split('.').reduce((v,k)=>v?.[k],library);}
if(process.argv[2]==='--case'){
  const [group,id,sizeText]=process.argv.slice(3),size=Number(sizeText);
  const fixtures=await(await import(`./perf-fixtures-${group}.mjs`)).fixtures();
  const fixture=fixtures.find(f=>f.id===id);assert(fixture&&!fixture.blocked);
  const React=await import('react');
  const result={id,covers:fixture.covers,size,mode:fixture.mode||'test-renderer',notes:fixture.notes,repetitions,units:{wallTime:'ms',reactActualDuration:'ms',heap:'bytes',hostNodes:'count',commits:'count'},phases:{},observedIdentities:{},hostNodes:{},heapAfterUnmountGc:[]};
  if(fixture.mode==='ssr'){
    const {renderToString}=await import('react-dom/server');
    assert.equal(typeof fixture.verifySsr,'function',`Missing SSR markup verification: ${id}`);
    for(const variant of [0,1])fixture.verifySsr(renderToString(fixture.create(1,variant)));
    result.ssrVerified=true;
    result.ssrVerificationNote='Untimed original/changed size1 markup assertions validate actual fixture-specific output. Reviewed explicit parent/context composition maps identities to this shared result; no isolated per-child timing or invocation count is claimed.';
    for(const [phase,variant]of [['ssrFresh',0],['ssrSameInputs',0],['ssrChangedInputs',1]]){
      const samples=[],bytes=[],tags=[];
      for(let i=-1;i<repetitions;i++){const element=fixture.create(size,variant);const start=performance.now();const html=renderToString(element);const elapsed=performance.now()-start;if(i>=0){samples.push(elapsed);bytes.push(Buffer.byteLength(html));tags.push((html.match(/<[a-z][^>]*>/g)||[]).length);}}
      result.phases[phase]={wallTimeMs:stats(samples),htmlBytes:stats(bytes),serializedHostTags:stats(tags)};
    }
    result.coverageBasis='Actual full SSR fixture execution with explicit output assertions; subcomponent attribution is shared fixture, based on reviewed fixture inclusion and emitted markup. No React lifecycle/update/commit or browser work measured.';
  }else{
    const {default:Renderer,act}=await import('react-test-renderer');
    const library=await import('../packages/inkra/dist/index.js');
    globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const warnings=[];console.error=(...args)=>{const message=args.map(String).join(' ');if(!message.includes('react-test-renderer is deprecated'))warnings.push(message);};
    const samples={},profiles={},hostSamples={};let commits=[];
    const onRender=(_id,phase,actualDuration,baseDuration,startTime,commitTime)=>commits.push({phase,actualDuration,baseDuration,startTime,commitTime});
    const element=variant=>React.createElement(React.Profiler,{id,onRender},fixture.create(size,variant));
    const measure=async(phase,work,iteration)=>{commits=[];const start=performance.now();await act(async()=>{await work();});const elapsed=performance.now()-start;if(iteration>=0){(samples[phase]??=[]).push(elapsed);(profiles[phase]??=[]).push({commitCount:commits.length,actualDurationMs:commits.reduce((sum,c)=>sum+c.actualDuration,0),commits:[...commits]});}};
    result.activeResourcesBefore=process.getActiveResourcesInfo?.()||[];globalThis.gc?.();result.heapBeforeWarmupGc=process.memoryUsage().heapUsed;
    for(let i=-1;i<repetitions;i++){
      let renderer;
      const initialElement=element(0);await measure('mount',()=>{renderer=Renderer.create(initialElement);},i);
      if(i===0)for(const name of fixture.covers){const type=resolveExport(library,name);let rendererType=type;while(rendererType?.$$typeof===Symbol.for('react.memo'))rendererType=rendererType.type;result.observedIdentities[name]={resolved:Boolean(type),matchBasis:rendererType===type?'exact-export-type':'exact-unwrapped-react-memo-type',mountedInstances:type?renderer.root.findAll(node=>node.type===type||node.type===rendererType).length:0};}
      for(const [phase,variant]of [['sameValueRecreatedFixture',0],['changed',1]]){const nextElement=element(variant);await measure(phase,()=>{renderer.update(nextElement);},i);}
      if(i>=0){const hosts=renderer.root.findAll(node=>typeof node.type==='string');for(const [key,count]of Object.entries({all:hosts.length,canvas:hosts.filter(n=>n.type==='canvas').length,svg:hosts.filter(n=>n.type==='svg').length,paths:hosts.filter(n=>n.type==='path').length,inputs:hosts.filter(n=>['input','textarea','select'].includes(n.type)).length}))(hostSamples[key]??=[]).push(count);}
      await measure('unmount',()=>{renderer.unmount();renderer=null;},i);
      if(i>=0){globalThis.gc?.();result.heapAfterUnmountGc.push(process.memoryUsage().heapUsed);}
    }
    for(const [phase,values]of Object.entries(samples))result.phases[phase]={wallTimeMs:stats(values),reactActualDurationMs:stats(profiles[phase].map(p=>p.actualDurationMs)),commitCount:stats(profiles[phase].map(p=>p.commitCount)),profilerSamples:profiles[phase]};
    result.phases.unmount.reactActualDurationMs=null;result.phases.unmount.profilerNote='Profiler does not report unmount render duration; use wallTimeMs, zero callback counts are not zero unmount cost.';result.hostNodes=Object.fromEntries(Object.entries(hostSamples).map(([key,v])=>[key,stats(v)]));
    result.warnings=[...new Set(warnings)].slice(0,12);
    result.activeResourcesAfter=process.getActiveResourcesInfo?.()||[];result.lifecycleCalls={warmupMounts:1,measuredMounts:repetitions,measuredUnmounts:repetitions};result.heapAfterUnmountGcStats=stats(result.heapAfterUnmountGc);result.heapDeltaAfterWarmupGc=result.heapAfterUnmountGc.at(-1)-result.heapAfterUnmountGc[0];
    result.coverageBasis='Actual test-renderer component lifecycles; observedIdentities verifies exact exported component types in mounted tree. Host nodes are renderer output, NOT real DOM. Profiler includes subtree render time; commitTime values are timestamps, not commit durations.';
  }
  result.maxRssKiB=process.resourceUsage().maxRSS;
  result.memoryCaveat='Node development/test-renderer process only. GC heap includes fixture/runtime/caches, not browser/GPU or isolated component retained heap. Drift is a diagnostic signal, not proof of leak; no retainer graph.';
  console.log(JSON.stringify(result));
}else{
  await mkdir(output,{recursive:true});
  const all=[];for(const group of groups)for(const fixture of await(await import(`./perf-fixtures-${group}.mjs`)).fixtures())all.push({group,...fixture});
  const expected=new Set(inventory.components.map(c=>c.component)),declared=new Set(all.flatMap(f=>f.covers));
  const unknown=[...declared].filter(c=>!expected.has(c)),missing=[...expected].filter(c=>!declared.has(c));
  assert.equal(unknown.length,0,`Unknown fixture identities: ${unknown}`);assert.equal(missing.length,0,`Missing fixture identities: ${missing}`);
  const report={schemaVersion:1,...benchmarkProvenance(new URL('../', import.meta.url)),environment:{node:process.version,react:'19.3.1',renderer:'19.3.1',mode:'development',os:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,cpuCount:os.cpus().length},method:{repetitions,warmup:1,serial:true,timeoutMs:timeout,maxOldSpaceMiB:1024,forcedGc:true,browser:false,fixtureCreation:'Excluded from all timed phases; React component execution included.',sameValueUpdate:'Fixture recreated with equal semantic values; reference identities may be new. Not the stable-identical-props experiment in benchmark-large-data.',sharedAttribution:'Every identity maps to explicitly shared fixture totals, never divided or claimed as independent cost'},casePlan:all.filter(f=>!process.env.PERF_FILTER||f.id.includes(process.env.PERF_FILTER)).flatMap(f=>f.blocked?[{id:f.id,blocked:true}]:(f.scales||[1,10,100]).map(size=>({id:f.id,size}))),results:[],coverage:[]};
  for(const fixture of all){
    if(process.env.PERF_FILTER&&!fixture.id.includes(process.env.PERF_FILTER))continue;
    if(fixture.blocked){report.results.push({id:fixture.id,covers:fixture.covers,status:'blocked',reason:fixture.blocked});continue;}
    for(const size of fixture.scales||[1,10,100]){
      const child=spawnSync(process.execPath,['--expose-gc','--max-old-space-size=1024',new URL(import.meta.url).pathname,'--case',fixture.group,fixture.id,String(size)],{encoding:'utf8',timeout,maxBuffer:16*1024*1024,env:{...process.env,TZ:'UTC',NODE_ENV:'development'}});
      let r;try{if(child.status!==0)throw new Error(child.error?.message||`exit=${child.status} signal=${child.signal}`);r=JSON.parse(child.stdout.trim());r.status='measured';}catch(error){r={id:fixture.id,covers:fixture.covers,size,status:child.error?.code==='ETIMEDOUT'?'timeout':'failed',reason:String(error),stderr:child.stderr.slice(-5000)};}
      report.results.push(r);console.error(`${fixture.id} ${size}: ${r.status}`);await writeFile(`${output}/checkpoint.json`,JSON.stringify(report,null,2));
    }
  }
  for(const component of inventory.components){
    const evidence=report.results.filter(r=>r.covers.includes(component.component));
    const successful=evidence.filter(r=>r.status==='measured'&&(r.mode==='ssr'?r.ssrVerified===true:r.observedIdentities?.[component.component]?.mountedInstances>0));
    let moduleBytes=null;const distPath=component.source.replace('/src/','/dist/').replace(/\.tsx?$/,'.js');try{const bytes=await readFile(distPath);moduleBytes={path:distPath,rawBytes:bytes.length,gzipBytes:gzipSync(bytes).length,scope:'Emitted own module only, shared by exports; NOT transitive consumer bundle or isolated component bundle'};}catch{}
    report.coverage.push({component:component.component,aliases:component.aliases,source:component.source,group:component.group,status:successful.length?'measured-shared-fixture':evidence.some(r=>r.status==='blocked')?'blocked':'unmeasured-or-failed',evidence:successful.map(r=>({fixture:r.id,size:r.size,mode:r.mode,observed:r.observedIdentities?.[component.component]})),attempted:evidence.map(r=>({fixture:r.id,size:r.size,status:r.status})),moduleBytes});
  }
  report.summary={identities:expected.size,aliases:inventory.components.reduce((sum,c)=>sum+c.aliases.length,0),declared:declared.size,measured:report.coverage.filter(c=>c.status==='measured-shared-fixture').length,blocked:report.coverage.filter(c=>c.status==='blocked').length,unmeasured:report.coverage.filter(c=>c.status==='unmeasured-or-failed').length};
  await writeFile(`${output}/results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));
}
