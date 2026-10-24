import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement as h } from 'react';
import { create, act } from 'react-test-renderer';
import { TagInput } from '../dist/tag-input/index.js';
import { ChoiceGrid, ChoiceGridOption } from '../dist/choice-grid/index.js';
import { Calendar } from '../dist/calendar/index.js';
import { DayAgenda } from '../dist/day-agenda/index.js';
const hosts=(r,c)=>r.root.findAll(n=>typeof n.type==='string'&&n.props.className?.split(' ').includes(c));
const button=(r,label)=>r.root.findAllByType('button').find(n=>n.props['aria-label']===label);
const disclosure=r=>r.root.findAllByType('button').find(n=>typeof n.props['aria-expanded']==='boolean'&&n.props.onClick);
async function render(element,check){const old=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let r;try{await act(()=>{r=create(element);});await check(r);}finally{if(r)await act(()=>r.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=old;}}
test('TagInput display bound preserves all submitted values and reveals hidden keyboard targets',async()=>{
 const tags=Array.from({length:12},(_,i)=>({id:String(i),value:`Tag ${i}`}));
 const old=globalThis.getComputedStyle;globalThis.getComputedStyle=()=>({direction:'ltr'});
 try{await render(h(TagInput,{value:tags,name:'tags',maxVisibleTags:2}),async r=>{
  assert.equal(hosts(r,'inkra-tag-input__tag').length,2);
  assert.equal(r.root.findAllByType('input').filter(n=>n.props.type==='hidden').length,12);
  const input=r.root.findAllByType('input').find(n=>n.props.type==='text');
  await act(()=>input.props.onKeyDown({key:'ArrowLeft',defaultPrevented:false,preventDefault(){},nativeEvent:{},currentTarget:{selectionStart:0,selectionEnd:0}}));
  assert.equal(hosts(r,'inkra-tag-input__tag').length,12,'keyboard reaches the final tag by revealing all');
  await act(()=>disclosure(r).props.onClick()); assert.equal(hosts(r,'inkra-tag-input__tag').length,2);
  await act(()=>disclosure(r).props.onClick()); assert.equal(hosts(r,'inkra-tag-input__tag').length,12);
 });}finally{if(old===undefined)delete globalThis.getComputedStyle;else globalThis.getComputedStyle=old;}
});
test('ChoiceGrid controlled pages retain off-page selection and report all values in option order',async()=>{
 const changes=[];const children=['a','b','c'].map(v=>h(ChoiceGridOption,{key:v,value:v,label:v,disabled:v==='c'}));
 await render(h(ChoiceGrid,{type:'multiple',name:'choices',label:'Choices',values:['a','c'],onValuesChange:v=>changes.push(v),pageSize:1},children),async r=>{
  assert.equal(hosts(r,'inkra-choice-grid__option').length,1);
  assert.deepEqual(r.root.findAllByType('input').filter(n=>n.props.name==='choices').map(n=>[n.props.type,n.props.value,n.props.disabled]),[['checkbox','a',false],['hidden','c',true]]);
  await act(()=>button(r,'Next page').props.onClick());
  const input=r.root.findAllByType('input').find(n=>n.props.type==='checkbox');
  await act(()=>input.props.onChange({currentTarget:{checked:true}}));assert.deepEqual(changes,[['a','b','c']]);
  assert.deepEqual(r.root.findAllByType('input').filter(n=>n.props.name==='choices').map(n=>n.props.value),['a','b','c']);
 });
});
test('ChoiceGrid required or composed/uncontrolled children fall back to complete native controls',async()=>{
 for(const controlled of [false,true])await render(h(ChoiceGrid,{name:'required',label:'Required',pageSize:1,...(controlled?{value:'a'}:{defaultValue:'a'})},
  ['a','b','c'].map(v=>h(ChoiceGridOption,{key:v,value:v,label:v,required:true}))),async r=>{
  assert.equal(hosts(r,'inkra-choice-grid__option').length,3);assert.equal(button(r,'Next page'),undefined);
 });
});
test('Calendar opt-in day summary exposes every event and preserves event callbacks',async()=>{
 const events=Array.from({length:20},(_,i)=>({id:String(i),label:`Event ${i}`,date:new Date(2026,0,10)}));const changes=[];
 await render(h(Calendar,{events,month:new Date(2026,0,1),maxEventsPerDay:3,onEventSelect:e=>changes.push(e.id)}),async r=>{
  assert.equal(hosts(r,'inkra-calendar__event-card').length,3);
  await act(()=>disclosure(r).props.onClick({stopPropagation(){}}));assert.equal(hosts(r,'inkra-calendar__event-card').length,20);
  await act(()=>hosts(r,'inkra-calendar__event-card').at(-1).props.onClick({stopPropagation(){}}));assert.deepEqual(changes,['19']);
 });
});
test('DayAgenda summary uses the full layout and always retains the selected event',async()=>{
 const events=Array.from({length:20},(_,i)=>({id:String(i),title:`Event ${i}`,startMinute:60+i*30,endMinute:80+i*30}));
 await render(h(DayAgenda,{date:'2026-01-10',events,maxVisibleEvents:2,selectedEvent:'19'}),async r=>{
  assert.equal(hosts(r,'inkra-agenda__card').length,3);
  const scale=hosts(r,'inkra-agenda__scale')[0].props.style.height;
  await act(()=>disclosure(r).props.onClick());assert.equal(hosts(r,'inkra-agenda__card').length,20);
  assert.equal(hosts(r,'inkra-agenda__scale')[0].props.style.height,scale);
 });
});
