import React from 'react';
import { DataTable } from '../packages/inkra/dist/data-table/index.js';
import { VirtualList } from '../packages/inkra/dist/virtual-list/index.js';
import { Select } from '../packages/inkra/dist/select/index.js';

export async function scenarios(size) {
  const data = Array.from({length:size},(_,i)=>({id:`employee-${i}`,name:`Employee ${i}`,department:`Department ${i%20}`,salary:40000+(i%200)*500}));
  const changed = data.slice(); changed[0] = {...data[0],name:'Updated employee'};
  let cells=0, rows=0, rowIds=0;
  const columns=['name','department','salary'].map(key=>({accessorKey:key,header:key,cell:info=>{cells++;return String(info.getValue());}}));
  const table={data,columns,getRowId:row=>{rowIds++;return row.id;},pagination:true,defaultPagination:{pageIndex:0,pageSize:25},filterable:true};
  const virtual={items:data,itemKey:item=>item.id,estimateSize:36,height:360,ssrItemCount:12,renderItem:({item})=>{rows++;return React.createElement('span',null,item.name);}};
  const options=data.map(row=>({value:row.id,label:row.name}));
  const changedOptions=options.slice(); changedOptions[0]={...options[0],label:'Updated employee'};
  return [
    {name:'DataTable-paginated',component:DataTable,props:table,changedProps:{...table,data:changed},shape:'N employee rows, 3 columns, page size 25; full client row model',counts:()=>({cellRenderCalls:cells,rowIdCalls:rowIds}),resetCounts:()=>{cells=0;rowIds=0;},extraProps:{search:{...table,globalFilter:'Employee 99'},sort:{...table,sorting:[{id:'salary',desc:true}]}}},
    {name:'VirtualList-no-DOM-fallback',component:VirtualList,props:virtual,changedProps:{...virtual,items:changed},shape:'N employee rows; 12 fallback items; null DOM refs, NOT browser scroll virtualization',counts:()=>({itemRenderCalls:rows}),resetCounts:()=>{rows=0;}},
    {name:'Select-searchable-closed',component:Select.Searchable,props:{items:options,open:false,defaultValue:options[0].value,'aria-label':'Employees'},changedProps:{items:changedOptions,open:false,defaultValue:options[0].value,'aria-label':'Employees'},shape:'N real option values/labels; closed searchable select preprocessing, NOT dropdown rendering'},
  ];
}
