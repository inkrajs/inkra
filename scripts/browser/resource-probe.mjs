// Weak observations: instrumentation must not retain the DOM/listeners it measures.
export function installResourceProbe(){
 let observerRecords=[];
 for(const name of ['ResizeObserver','IntersectionObserver','MutationObserver']){
  const Native=window[name];if(!Native)continue;const states=new WeakMap();
  window[name]=class extends Native{
   constructor(...args){super(...args);const state={kind:name,targets:[]};states.set(this,state);observerRecords.push({instance:new WeakRef(this),state});}
   observe(target,...args){const s=states.get(this);if(!s.targets.some(r=>r.deref()===target))s.targets.push(new WeakRef(target));return super.observe(target,...args);}
   unobserve(target,...args){const s=states.get(this);s.targets=s.targets.filter(r=>r.deref()!==target);return super.unobserve?.(target,...args);}
   disconnect(){states.get(this).targets=[];return super.disconnect();}
  };
 }
 let listeners=[];const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
 const capture=o=>typeof o==='boolean'?o:Boolean(o?.capture);
 EventTarget.prototype.addEventListener=function(type,callback,options){const result=add.call(this,type,callback,options);if(callback&&typeof callback==='object'||typeof callback==='function'){
  if(!listeners.some(r=>!r.removed&&r.target.deref()===this&&r.callback.deref()===callback&&r.type===type&&r.capture===capture(options)))listeners.push({target:new WeakRef(this),callback:new WeakRef(callback),type,capture:capture(options),removed:false});}return result;};
 EventTarget.prototype.removeEventListener=function(type,callback,options){const result=remove.call(this,type,callback,options);for(const r of listeners)if(r.target.deref()===this&&r.callback.deref()===callback&&r.type===type&&r.capture===capture(options))r.removed=true;return result;};
 const timeouts=new Set(),intervals=new Set(),frames=new Set();
 const timeout=window.setTimeout.bind(window),clearTimeoutNative=window.clearTimeout.bind(window),interval=window.setInterval.bind(window),clearIntervalNative=window.clearInterval.bind(window),raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
 window.setTimeout=(callback,delay,...args)=>{if(typeof callback!=='function')return timeout(callback,delay,...args);let id;id=timeout(()=>{timeouts.delete(id);callback(...args);},delay);timeouts.add(id);return id;};
 window.clearTimeout=id=>{timeouts.delete(id);clearTimeoutNative(id);};
 window.setInterval=(...args)=>{const id=interval(...args);intervals.add(id);return id;};window.clearInterval=id=>{intervals.delete(id);clearIntervalNative(id);};
 window.requestAnimationFrame=callback=>{let id;id=raf(t=>{frames.delete(id);callback(t);});frames.add(id);return id;};window.cancelAnimationFrame=id=>{frames.delete(id);cancel(id);};
 window.snapshotResources=()=>{
  observerRecords=observerRecords.filter(r=>r.instance.deref());listeners=listeners.filter(r=>!r.removed&&r.target.deref()&&r.callback.deref());
  const observers={};for(const r of observerRecords)if(r.instance.deref()){const active=r.state.targets.filter(t=>t.deref()).length;if(active)observers[r.state.kind]=(observers[r.state.kind]||0)+active;}
  const live=listeners.filter(r=>!r.removed&&r.target.deref()&&r.callback.deref());
  return {observers,eventListeners:live.length,globalEventListeners:live.filter(r=>r.target.deref()===window||r.target.deref()===document).length,timeouts:timeouts.size,intervals:intervals.size,raf:frames.size};
 };
}
