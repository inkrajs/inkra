// Isolated real component test-renderer and pure-model benchmarks, NOT browser timings.
// npm run build && node scripts/benchmark-large-data.mjs > large-data-results.json
import { spawnSync, execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import assert from 'node:assert/strict';
import { benchmarkProvenance } from './benchmark-provenance.mjs';
function hostCount(root){let count=0;const pending=[root];while(pending.length){const node=pending.pop();if(typeof node==='string')continue;if(typeof node.type==='string')count++;for(const child of node.children)pending.push(child);}return count;}
const groups=['tables','collections','events','models'];
const repetitions=Number(process.env.BENCH_REPETITIONS || 7);
const timeout=Number(process.env.BENCH_TIMEOUT_MS || 45000);
const sizes=(process.env.BENCH_SIZES || '1000,10000,50000').split(',').map(Number);
const stats=values=>{const sorted=[...values].sort((a,b)=>a-b);const mean=values.reduce((a,b)=>a+b,0)/values.length;return {samplesMs:values,medianMs:sorted[Math.floor(sorted.length/2)],minMs:sorted[0],maxMs:sorted.at(-1),meanMs:mean,stddevMs:Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length)};};
if(process.argv[2]==='--case') {
  const [group,sizeText,name]=process.argv.slice(3),size=Number(sizeText);
  const scenario=(await (await import(`./large-data-${group}.mjs`)).scenarios(size)).find(s=>s.name===name);
  assert(scenario,`Unknown case ${name}`);
  const result={name,size,shape:scenario.shape,fixtureCounts:typeof scenario.counts==='object'?scenario.counts:undefined,missingBrowserCoverage:scenario.missingBrowserCoverage,interaction:scenario.interaction,mode:group==='models'?'pure-model':'React development test-renderer, null DOM refs',repetitions};
  if(group==='models') {
    const run=()=>{const start=performance.now();const value=scenario.run();const elapsed=performance.now()-start;if(scenario.outputCount!==undefined)assert.equal(value,scenario.outputCount);return elapsed;};
    run(); result.operation=stats(Array.from({length:repetitions},run));result.outputCount=scenario.outputCount;
  } else {
    const React=await import('react');const {default:Renderer,act}=await import('react-test-renderer');
    globalThis.IS_REACT_ACT_ENVIRONMENT=true;
    const errors=[];const original=console.error;console.error=(...args)=>{const message=args.map(String).join(' ');if(!message.includes('react-test-renderer is deprecated'))errors.push(message);};
    const phases={mount:[],unchanged:[],oneItemChange:[]};const counts={mount:[],unchanged:[],oneItemChange:[]};const hostCounts=[];
    const measure=async (phase,work)=>{scenario.resetCounts?.();const start=performance.now();await act(async()=>{await work();});const elapsed=performance.now()-start;return {elapsed,counts:typeof scenario.counts==='function'?scenario.counts():{}};};
    for(let repetition=-1;repetition<repetitions;repetition++) {
      let renderer;
      const mount=await measure('mount',()=>{renderer=Renderer.create(React.createElement(scenario.component,scenario.props));});
      const stable=await measure('unchanged',()=>{renderer.update(React.createElement(scenario.component,scenario.props));});
      const changed=await measure('oneItemChange',()=>{renderer.update(React.createElement(scenario.component,scenario.changedProps));});
      if(repetition>=0){for(const [phase,value]of Object.entries({mount,unchanged:stable,oneItemChange:changed})){phases[phase].push(value.elapsed);counts[phase].push(value.counts);}hostCounts.push(hostCount(renderer.root));}
      for(const [phase,props] of Object.entries(scenario.extraProps||{})){
        await act(async()=>{renderer.update(React.createElement(scenario.component,scenario.props));});
        const value=await measure(phase,()=>renderer.update(React.createElement(scenario.component,props)));
        if(repetition>=0){(phases[phase]??=[]).push(value.elapsed);(counts[phase]??=[]).push(value.counts);}
      }
      if(scenario.interact){await act(async()=>{renderer.update(React.createElement(scenario.component,scenario.props));});const value=await measure('interaction',()=>scenario.interact(renderer.root));if(repetition>=0){(phases.interaction??=[]).push(value.elapsed);(counts.interaction??=[]).push(value.counts);}}
      await act(async()=>{renderer.unmount();});
    }
    console.error=original;result.phases=Object.fromEntries(Object.entries(phases).map(([key,value])=>[key,stats(value)]));result.operationCounts=counts;result.hostNodeCounts=hostCounts;result.warnings=[...new Set(errors)].slice(0,8);
  }
  result.maxRssKiB=process.resourceUsage().maxRSS;result.memoryCaveat='Peak Node process RSS, includes runtime, fixtures, imports, warmup and retained allocator pages; not component heap, not browser memory, not a leak test';
  console.log(JSON.stringify(result));
} else {
  const report={schemaVersion:1,...benchmarkProvenance(new URL('../', import.meta.url)),environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,cpuCount:os.cpus().length,totalSystemMemoryBytes:os.totalmem(),react:'19.3.1',renderer:'19.3.1'},method:{repetitions,warmupRuns:1,perCaseTimeoutMs:timeout,nodeMaxOldSpaceMiB:1536,serial:true,timingIncludes:'React render/reconciliation/effect flushing in act; fresh mount per repetition, one stable update and one immutable changed-props update; fixture creation excluded',browser:false},results:[]};
  for(const size of sizes)for(const group of groups){
    const scenarios=await (await import(`./large-data-${group}.mjs`)).scenarios(size);
    for(const scenario of scenarios){
      if(process.env.BENCH_FILTER&&!scenario.name.includes(process.env.BENCH_FILTER))continue;
      const args=['--max-old-space-size=1536',new URL(import.meta.url).pathname,'--case',group,String(size),scenario.name];
      const child=spawnSync(process.execPath,args,{encoding:'utf8',timeout,maxBuffer:8*1024*1024,env:{...process.env,NODE_ENV:'development',TZ:'UTC'}});
      let result;
      try {if(child.status!==0)throw new Error(child.error?.message||`exit=${child.status} signal=${child.signal}`);result=JSON.parse(child.stdout.trim());result.status='ok';}
      catch(error){result={name:scenario.name,size,status:child.error?.code==='ETIMEDOUT'?'timeout':'failed',reason:String(error),stderr:child.stderr.slice(-3000),partialStdout:child.stdout.slice(-1000)};}
      report.results.push(result);console.error(`${scenario.name} N=${size}: ${result.status}`);
    }
  }
  console.log(JSON.stringify(report,null,2));
}
