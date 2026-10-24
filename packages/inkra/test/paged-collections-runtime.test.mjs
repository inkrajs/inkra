import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement as h } from 'react';
import { act, create } from 'react-test-renderer';
import { Transfer } from '../dist/transfer/index.js';
const hostClass=(r,c)=>r.root.findAll(n=>typeof n.type==='string'&&n.props.className?.split(' ').includes(c));
async function withRenderer(props,check){const old=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let r;try{await act(()=>{r=create(h(Transfer,props));});await check(r);}finally{if(r)await act(()=>r.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=old;}}
const items=Array.from({length:105},(_,i)=>({id:String(i),label:`Item ${i}`,disabled:i===1}));
test('Transfer opt-in pages retain all searchable data, clamp after filtering, and bound mounted items',async()=>{
 await withRenderer({items,pageSize:10},async r=>{
  const ids=()=>hostClass(r,'inkra-transfer__item').map(n=>n.props['data-transfer-item-id']);
  assert.deepEqual(ids(),Array.from({length:10},(_,i)=>String(i)));
  const buttons=()=>r.root.findAllByType('button').filter(n=>n.props['aria-label']==='Next page');
  await act(()=>buttons()[0].props.onClick()); assert.deepEqual(ids(),Array.from({length:10},(_,i)=>String(i+10)));
  const search=r.root.findAllByType('input').find(n=>n.props['aria-label']==='Search available items');
  await act(()=>search.props.onChange({currentTarget:{value:'Item 104'}}));
  assert.deepEqual(ids(),['104']);
  await act(()=>r.update(h(Transfer,{items:items.slice(0,5),pageSize:2})));
  assert.ok(ids().length<=2);
 });
});
test('Transfer pagination batch selection and movement are limited to the current visible page',async()=>{
 const oldDoc=globalThis.document;globalThis.document={activeElement:{},body:{},documentElement:{},addEventListener(){},removeEventListener(){}};
 const moves=[];
 try{await withRenderer({items,pageSize:10,targetKeys:[],onTargetKeysChange:(keys,d)=>moves.push({keys,d})},async r=>{
  const selectAll=r.root.findAllByType('input').find(n=>n.props.type==='checkbox'&&!n.props.disabled);
  await act(()=>selectAll.props.onChange({currentTarget:{checked:true}}));
  const move=r.root.findAllByType('button').find(n=>n.props['aria-label']==='Move selected visible items to selected');
  await act(()=>move.props.onClick({currentTarget:null}));
  assert.deepEqual(moves[0].keys,['0','2','3','4','5','6','7','8','9']);
  assert.equal(moves[0].d.action,'batch');
  assert.equal(hostClass(r,'inkra-transfer__item').length,10,'controlled parent retains ownership');
 });}finally{if(oldDoc===undefined)delete globalThis.document;else globalThis.document=oldDoc;}
});
