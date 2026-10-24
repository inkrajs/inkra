import assert from 'node:assert/strict';
import {test} from 'node:test';
import {surfaceIsNearViewport,observeSurfaceViewport} from '../dist/internal/surfaceVisibility.js';
test('surface geometry retains visible first paint and a 240px prewarm band',()=>{
 const doc={defaultView:{innerWidth:390,innerHeight:844}};
 const root=(top,left=0)=>({ownerDocument:doc,getBoundingClientRect:()=>({top,bottom:top+44,left,right:left+160})});
 assert.equal(surfaceIsNearViewport(root(0)),true);assert.equal(surfaceIsNearViewport(root(1080)),true);
 assert.equal(surfaceIsNearViewport(root(1085)),false);assert.equal(surfaceIsNearViewport(root(-300)),false);
 assert.equal(surfaceIsNearViewport(root(10,700)),false);
 assert.equal(surfaceIsNearViewport({ownerDocument:doc}),true,'missing layout APIs retain eager fallback');
});
test('surfaces share a viewport observer and detach targets/callbacks including late notifications',()=>{
 const prior=globalThis.IntersectionObserver;const observers=[];
 class Observer{constructor(callback,options){this.callback=callback;this.options=options;this.targets=new Set();observers.push(this);}observe(t){this.targets.add(t);}unobserve(t){this.targets.delete(t);}disconnect(){this.targets.clear();this.disconnected=true;}}
 globalThis.IntersectionObserver=Observer;
 try{const doc={};const a={ownerDocument:doc},b={ownerDocument:doc};let calls=0;
 const stopA=observeSurfaceViewport(a,()=>calls++),stopB=observeSurfaceViewport(b,()=>calls++);
 assert.equal(observers.length,1);assert.equal(observers[0].options.rootMargin,'240px');
 observers[0].callback([{target:a,isIntersecting:false},{target:b,isIntersecting:true}]);assert.equal(calls,1);
 stopA();observers[0].callback([{target:a,isIntersecting:true}]);assert.equal(calls,1);
 assert.equal(observers[0].targets.size,1);stopB();assert(observers[0].disconnected);
 const stop=observeSurfaceViewport(a,()=>calls++);assert.equal(observers.length,2);stop();
 }finally{if(prior===undefined)delete globalThis.IntersectionObserver;else globalThis.IntersectionObserver=prior;}
});
test('missing or unavailable viewport observation preserves eager painting',()=>{
 const prior=globalThis.IntersectionObserver;
 try{delete globalThis.IntersectionObserver;assert.equal(observeSurfaceViewport({ownerDocument:{}},()=>{}),undefined);
 globalThis.IntersectionObserver=class{constructor(){throw Error('unavailable');}};
 assert.equal(observeSurfaceViewport({ownerDocument:{}},()=>{}),undefined);
 }finally{if(prior===undefined)delete globalThis.IntersectionObserver;else globalThis.IntersectionObserver=prior;}
});
