// Exhaustive collection identity coverage. Composite timings belong to the whole
// fixture, never to any individual child. No browser layout/paint/input claims.
import React from 'react';
import { Card, Alert, Avatar, Table } from '../packages/inkra/dist/content/index.js';
import { Command } from '../packages/inkra/dist/command/index.js';
import { Select } from '../packages/inkra/dist/select/index.js';
import { Tree } from '../packages/inkra/dist/tree/index.js';
import { Log } from '../packages/inkra/dist/log/index.js';
import { OverflowList } from '../packages/inkra/dist/overflow-list/index.js';
import { Sortable } from '../packages/inkra/dist/sortable/index.js';
import { scenarios as collectionScenarios } from './large-data-collections.mjs';
import { scenarios as tableScenarios } from './large-data-tables.mjs';
const h = React.createElement;
const scales = [1, 10, 100];
const many = (n, render) => h(React.Fragment, null, Array.from({length:n}, (_,i) => h(React.Fragment,{key:i},render(i))));
const noop = () => {};
const renderItem = ({item}) => h('span',null,item.label);
const getItemId = item => item.id;
function composite(id, covers, create, notes, mode) {
  return { id, covers, create, scales, notes: 'Shared composite total, not isolated per-child timing. ' + notes, ...(mode ? {mode} : {}) };
}
export async function fixtures() {
  const result = [
    composite('collections/card', Object.keys(Card).map(k=>'Card.'+k), (size,variant=0)=>many(size,i=>
      h(Card.Root,{seed:'card-'+i},h(Card.Header,null,h(Card.Title,null,'Project '+i+' v'+variant),h(Card.Description,null,'Project overview')),
        h(Card.Content,null,'Current work'),h(Card.Footer,null,'Updated '+variant))),
      'size = complete Card instances; changed variant updates title/footer.'),
    composite('collections/alert', Object.keys(Alert).map(k=>'Alert.'+k), (size,variant=0)=>many(size,i=>
      h(Alert.Root,{seed:'alert-'+i,variant:variant?'warning':'info'},h(Alert.Title,null,'Status '+i),h(Alert.Description,null,'Revision '+variant))),
      'size = open Alert instances, changed variant changes tone and description.'),
    composite('collections/avatar', Object.keys(Avatar).map(k=>'Avatar.'+k), (size,variant=0)=>many(size,i=>
      h(Avatar.Root,null,h(Avatar.Image,{src:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',alt:'Person '+i+' v'+variant}),h(Avatar.Fallback,null,'AB'+variant))),
      'size = Avatar instances; Image component executes but image loading is unavailable without DOM, so only unloaded Image lifecycle and visible fallback are measured; not loaded image rendering or decode.'),
    composite('collections/table', Object.keys(Table).map(k=>'Table.'+k), (size,variant=0)=>
      h(Table.Container,null,h(Table.Root,{striped:!!variant},h(Table.Caption,null,'Inventory '+variant),
        h(Table.Header,null,h(Table.Row,null,h(Table.Head,null,'Item'),h(Table.Head,null,'Quantity'))),
        h(Table.Body,null,Array.from({length:size},(_,i)=>h(Table.Row,{key:i},h(Table.Cell,null,'Asset '+i),h(Table.Cell,null,String(i+variant))))),
        h(Table.Footer,null,h(Table.Row,null,h(Table.Cell,{colSpan:2},'Total '+size))))),
      'size = body rows in a complete two-column semantic table; header/footer/caption constant; changed variant updates cells and stripes.'),
    composite('collections/command-ssr', Object.keys(Command).map(k=>'Command.'+k), (size,variant=0)=>
      h(Command.Root,{shouldFilter:false,value:'item-0'},h(Command.Input,{value:'Query '+variant}),
        h(Command.List,null,h(Command.Group,{heading:'Actions'},Array.from({length:size},(_,i)=>
          h(Command.Item,{key:i,value:'item-'+i},'Action '+i+' v'+variant,h(Command.Shortcut,null,'⌘K')))),
          h(Command.Separator,{alwaysRender:true}),h(Command.Empty,null,'No actions'))),
      'size = Command items in full composition. Command.Empty executes its initial server state despite the nonempty items; this is not a filtered empty-results interaction or proof of browser-visible empty state. cmdk effects require DOM; no mounted filtering, keyboard navigation, effects, update or unmount measurement.', 'ssr'),
    composite('collections/tree-ssr', Object.keys(Tree).map(k=>'Tree.'+k), (size,variant=0)=>
      h(Tree.Root,{'aria-label':'Files',selectionMode:'single',selectedKeys:variant?new Set(['node-0']):new Set()},
        Array.from({length:size},(_,i)=>h(Tree.Item,{key:i,id:'node-'+i,textValue:'File '+i},
          h(Tree.ItemContent,null,h(Tree.ItemTitle,null,'File '+i+' v'+variant),h(Tree.ItemDescription,null,'File description'))))),
      'size = visible flat Tree rows; complete Tree.ItemContent/title/description server output verified. React Aria DOM interaction/effects excluded; changed variant changes selection and titles.', 'ssr'),
    composite('collections/select-open-inline-ssr', ['Select.Root','Select.Trigger','Select.Value','Select.Content','Select.Viewport','Select.Group','Select.Label','Select.Item','Select.ItemText','Select.ItemIndicator','Select.Separator'],
      (size,variant=0)=>h(Select.Root,{open:true,value:'item-0'},
        h(Select.Trigger,null,h(Select.Value,null,'Selected '+variant)),
        h(Select.Content,{position:'popper'},h(Select.Viewport,null,h(Select.Group,null,
          h(Select.Label,null,'Options '+variant),
          Array.from({length:size},(_,i)=>h(Select.Item,{key:i,value:'item-'+i},h(Select.ItemText,null,'Option '+i+' v'+variant),h(Select.ItemIndicator))),
          h(Select.Separator))))),
      'size = actual open inline Select option rows; no Portal. Selected first item ensures indicator output. Radix open-popup layout/focus effects require DOM, so only SSR render cost is measured.', 'ssr'),
    composite('collections/select-clear', ['Select.Clear'], (size,variant=0)=>many(size,()=>
      h(Select.Root,{multiple:true,value:['a'],items:[{value:'a',label:'A'}],open:false},
        h(Select.Trigger,null,h(Select.Value,null,'A')),h(Select.Clear,null,'Clear '+variant))),
      'size = multiple Select instances with nonempty selection and mounted Clear buttons. Shared provider/trigger overhead included; closed popup is not counted.'),
    {id:'collections/select-portal-browser-required',covers:['Select.Portal'],blocked:'React DOM portal needs a real DOM container; server/null-ref renderer does not mount portal children. A closed portal timing would not cover popup rendering.'},
    {id:'collections/select-scroll-browser-required',covers:['Select.ScrollUpButton','Select.ScrollDownButton'],blocked:'Radix scroll controls render only with actual overflowing viewport and measured scroll offsets; null DOM refs/SSR cannot exercise visible controls. Browser overflow and scrolling fixture required.'},
    composite('collections/log',['Log'],(size,variant=0)=>h(Log,{items:Array.from({length:size},(_,i)=>({id:'log-'+i,level:'info',content:'Event '+i+' v'+variant})),paused:true}),
      'size = visible log entries; changed variant updates content. Scroll geometry and auto-follow excluded.'),
    composite('collections/overflow-list',['OverflowList'],(size,variant=0)=>h(OverflowList,{items:Array.from({length:size},(_,i)=>({id:'item-'+i,label:'Item '+i+' v'+variant}))}),
      'size = items in initial no-DOM measurement/fallback state; responsive overflow measurement, ResizeObserver and overflow-menu opening excluded.'),
    composite('collections/sortable',['Sortable'],(size,variant=0)=>h(Sortable,{
      containers:[{id:'queue',items:Array.from({length:size},(_,i)=>({id:'job-'+i,label:'Job '+i+' v'+variant}))}],
      getItemId,renderItem,onChange:noop,autoScroll:false}),
      'size = visible sortable rows in one container; changed variant changes row labels. No drag sensors, collision geometry, pointer latency or actual dragging measured.'),
  ];
  // Cache datasets and props outside timed create calls. All scales include 1.
  // The original helper rejects 1 solely for its interaction assumptions; use a
  // two-record dataset and trim it for mount/update-only fixtures below.
  const bySize = new Map();
  for (const size of scales) {
    const cs = await collectionScenarios(Math.max(2,size));
    const ts = await tableScenarios(size);
    if(size===1) {
      const transfer=cs[0]; transfer.props={...transfer.props,items:transfer.props.items.slice(0,1),targetKeys:[]};
      transfer.changedProps={...transfer.props,targetKeys:[transfer.props.items[0].id]};
      const tree=cs[1]; tree.props={...tree.props,items:[{id:'root',label:'Root'}],value:[]};
      tree.changedProps={...tree.props,value:['root']};
      const tag=cs[2]; tag.props={...tag.props,value:tag.props.value.slice(0,1)};
      tag.changedProps={...tag.props,value:[{...tag.props.value[0],label:'Updated topic'}]};
      const choice=cs[3]; choice.props={...choice.props,children:choice.props.children.slice(0,1),values:[]};
      choice.changedProps={...choice.props,values:['plan-0']};
    }
    bySize.set(size,[...cs,...ts]);
  }
  const identities=[['Transfer'],['TreeSelect'],['TagInput'],['ChoiceGrid','ChoiceGridOption'],['DataTable'],['VirtualList'],['SearchableSelect']];
  for(let index=0;index<identities.length;index++) {
    result.push(composite('collections/'+identities[index][0],identities[index],(size,variant=0)=>{
      const entry=bySize.get(size)?.[index]; if(!entry)throw new Error('Unsupported fixture scale '+size);
      return h(entry.component,variant ? entry.changedProps : entry.props);
    },'size = input records/options/tags (not repeated instances). '+[
      'Transfer: all records split across two visible panels; changed target keys moves one record.',
      'TreeSelect: at size 1 one root; larger scales total nodes including branches, maximum depth 2. Closed preprocessing and trigger only, no dropdown rows mounted; changed selection.',
      'TagInput: all controlled tags mounted; changed last label (first at size 1).',
      'ChoiceGrid: all actual ChoiceGridOption children mounted; changed selection; native form aggregation not exercised.',
      'DataTable: three columns; client row model; page size 25, so visible data rows = min(size,25); changed first row label.',
      'VirtualList: fallback visible rows = min(size,12) with null DOM refs; not browser scroll virtualization; changed first label.',
      'SearchableSelect: closed preprocessing and trigger only, zero mounted dropdown rows; changed first option label.',
    ][index]));
  }
  // Untimed output verification, deliberately without component instrumentation:
  // React Aria discovers collection child types and must see the real components.
  const ssrMarkers = {
    'collections/command-ssr': ['cmdk-root', 'cmdk-input', 'cmdk-list', 'cmdk-group', 'cmdk-item', 'cmdk-separator', 'inkra-command__shortcut'],
    'collections/tree-ssr': ['inkra-tree', 'inkra-tree__item', 'inkra-tree__item-content', 'inkra-tree__title', 'inkra-tree__description'],
    'collections/select-open-inline-ssr': ['inkra-select__trigger', 'inkra-select__value-copy', 'inkra-select__content', 'inkra-select__viewport', 'inkra-select__group', 'inkra-select__label', 'inkra-select__item', 'inkra-select__item-text-copy', 'inkra-select__item-indicator', 'inkra-select__separator'],
  };
  for (const entry of result) {
    const markers = ssrMarkers[entry.id];
    if (markers) entry.verifySsr = html => {
      if (typeof html !== 'string') throw new Error(entry.id + ': expected SSR HTML string');
      for (const marker of markers) {
        if (!html.includes(marker)) throw new Error(entry.id + ': missing emitted marker ' + marker);
      }
    };
  }
  return result;
}
