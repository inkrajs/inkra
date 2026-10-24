/// <reference types="vite/client" />
import { useState, useEffect } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Button, TagInput, ChoiceGrid, ChoiceGridOption, Transfer, DataTable, Calendar, DayAgenda, PencilSurface,
 AlertDialog, ContextMenu, Drawer, HoverCard, Overlay, Popover, ScrollArea, Tooltip, Select, ImageViewer,
 Timeline, Heatmap, ToggleGroup, Pagination, Radar, SearchableSelect, Rating, Tabs, VirtualList } from '@inkra/react';
const query=new URLSearchParams(location.search);
if(query.get('css')==='button') await import('@inkra/react/styles/base.css');
else if(query.get('css')==='select'){await import('@inkra/react/styles/base.css');await import('@inkra/react/styles/form.css');await import('@inkra/react/styles/selection.css');await import('@inkra/react/styles/overlay.css');await import('@inkra/react/styles/select.css');}
else if(query.get('css')==='split') for(const family of ['base','form','slider','selection','overlay','select','tabs','tooltip','display','content','audio-player','choice-grid','calendar','day-agenda','tag-input','transfer','data-table','alert-dialog','context-menu','dropdown-menu','drawer','hover-card','image-viewer','pan-zoom','scroll-area','timeline','heatmap','toggle-group','pagination','radar','rating']) await import(`@inkra/react/styles/${family}.css`);
else await import('@inkra/react/styles.css');
// Vite cannot statically enumerate package import templates; the build helper
// writes a literal import map for these published CSS paths before building.
document.body.style.margin='0';document.body.style.fontFamily='system-ui';
const host=document.getElementById('fixture')!;host.style.padding='16px';host.style.maxWidth='100%';
const columns=[{accessorKey:'label',header:'Record'}];
function DataView({kind,size,bounded}:{kind:string,size:number,bounded:boolean}){
 const [records,setRecords]=useState(()=>Array.from({length:size},(_,i)=>({id:String(i),value:`Value ${i}`,label:`Record ${i}`,title:`Event ${i}`,date:new Date(2026,0,10),startMinute:60+i%1200,endMinute:80+i%1200})));
 const [selection,setSelection]=useState(['Value 0']);const [keys,setKeys]=useState<string[]>([]);const [page,setPage]=useState({pageIndex:0,pageSize:25});
 useEffect(()=>{(window as any).fixtureReady=true;(window as any).changeFixture=()=>setRecords(current=>current.map((r,i)=>i===0?{...r,label:`Changed ${r.label}`} :r));return()=>{delete (window as any).changeFixture;};},[]);
 if(kind==='TagInput')return <form><TagInput aria-label="Tags" name="tags" value={records} maxVisibleTags={bounded?25:undefined}/></form>;
 if(kind==='ChoiceGrid')return <form><ChoiceGrid type="multiple" label="Choices" name="choices" values={selection} onValuesChange={setSelection} pageSize={bounded?25:undefined}>{records.map(r=><ChoiceGridOption key={r.id} value={r.value} label={r.label}/>)}</ChoiceGrid></form>;
 if(kind==='Transfer')return <Transfer items={records} targetKeys={keys} onTargetKeysChange={setKeys} pageSize={bounded?25:undefined}/>;
 if(kind==='DataTable')return <DataTable data={bounded?records.slice(page.pageIndex*25,(page.pageIndex+1)*25):records} columns={columns} getRowId={r=>r.id} pagination manualPagination={bounded} rowCount={size} paginationState={page} onPaginationChange={setPage}/>;
 if(kind==='Calendar')return <Calendar month={new Date(2026,0,1)} events={records} maxEventsPerDay={bounded?3:undefined} onEventSelect={()=>{}}/>;
 if(kind==='DayAgenda')return <DayAgenda date="2026-01-10" events={records} maxVisibleEvents={bounded?25:undefined}/>;
 if(kind==='VirtualList')return <VirtualList aria-label="Large list" items={records} itemKey={r=>r.id} estimateSize={44} height={320} overscan={3} renderItem={({item})=><button type="button">{item.label}</button>}/>;
 if(kind==='Canvas')return <div style={{display:'flex',flexWrap:'wrap',gap:8}}>{records.slice(0,100).map(r=><Button key={r.id} seed={`stress-${r.id}`}>Paint {r.id}</Button>)}</div>;
 if(kind==='SurfaceBudget')return <PencilSurface style={{width:100000,height:100000}}>Readable fallback</PencilSurface>;
 if(kind==='Tabs')return <Tabs.Root defaultValue="one"><Tabs.List aria-label="Views"><Tabs.Trigger value="one">One</Tabs.Trigger><Tabs.Trigger value="two">Two</Tabs.Trigger></Tabs.List><Tabs.Content value="one" forceMount>One content</Tabs.Content><Tabs.Content value="two" forceMount>Two content</Tabs.Content></Tabs.Root>;
 if(kind==='Timeline')return <Timeline items={records.slice(0,5).map(r=>({id:r.id,title:r.title,date:'Today'}))}/>;
 if(kind==='Heatmap')return <Heatmap label="Heatmap fixture" rows={[{id:'row',label:'Row'}]} columns={records.slice(0,5).map(r=>({id:r.id,label:r.label}))} cells={records.slice(0,5).map((r,i)=>({rowId:'row',columnId:r.id,value:i}))}/>;
 if(kind==='ToggleGroup')return <ToggleGroup.Root defaultValue={['a']}><ToggleGroup.Item value="a">A</ToggleGroup.Item><ToggleGroup.Item value="b">B</ToggleGroup.Item></ToggleGroup.Root>;
 if(kind==='Pagination')return <Pagination totalPages={100} defaultPage={2}/>;
 if(kind==='Radar')return <Radar label="Radar fixture" axes={['a','b','c'].map(id=>({id,label:id,max:100}))} series={[{id:'one',label:'One',data:[{axisId:'a',value:20},{axisId:'b',value:70},{axisId:'c',value:40}]}]}/>;
 if(kind==='SearchableSelect')return <SearchableSelect items={records.slice(0,30).map(r=>({value:r.id,label:r.label}))} aria-label="Search options"/>;
 if(kind==='Rating')return <Rating name="rating" defaultValue={3}/>;
 return <p>Unknown fixture: {kind}</p>;
}
function PortalView({kind}:{kind:string}){
 const marker=<span data-testid="portal-content">Actual mounted portal</span>;
 if(kind==='AlertDialog.Portal')return <AlertDialog.Root defaultOpen><AlertDialog.Trigger>Open</AlertDialog.Trigger><AlertDialog.Portal><AlertDialog.Content><AlertDialog.Title>Confirm</AlertDialog.Title><AlertDialog.Description>Performance fixture</AlertDialog.Description>{marker}<AlertDialog.Cancel>Cancel</AlertDialog.Cancel></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>;
 if(kind.startsWith('ContextMenu'))return <ContextMenu.Root defaultOpen><ContextMenu.Trigger>Context target</ContextMenu.Trigger><ContextMenu.Portal><ContextMenu.Content>{kind==='ContextMenu.SubContent'?<ContextMenu.Sub defaultOpen><ContextMenu.SubTrigger>Submenu</ContextMenu.SubTrigger><ContextMenu.SubContent>{marker}<ContextMenu.Item>Item</ContextMenu.Item></ContextMenu.SubContent></ContextMenu.Sub>:<ContextMenu.Item>{marker}</ContextMenu.Item>}</ContextMenu.Content></ContextMenu.Portal></ContextMenu.Root>;
 if(kind==='Drawer.Portal')return <Drawer.Root defaultOpen><Drawer.Trigger>Open</Drawer.Trigger><Drawer.Portal><Drawer.Content><Drawer.Title>Drawer</Drawer.Title><Drawer.Description>Performance fixture</Drawer.Description>{marker}</Drawer.Content></Drawer.Portal></Drawer.Root>;
 if(kind==='HoverCard.Content')return <HoverCard.Root defaultOpen><HoverCard.Trigger>Hover</HoverCard.Trigger><HoverCard.Content><HoverCard.Title>Hover</HoverCard.Title>{marker}</HoverCard.Content></HoverCard.Root>;
 if(kind==='Overlay.Portal')return <Overlay.Root defaultOpen><Overlay.Trigger>Open</Overlay.Trigger><Overlay.Portal><Overlay.Content><Overlay.Title>Overlay</Overlay.Title><Overlay.Description>Performance fixture</Overlay.Description>{marker}</Overlay.Content></Overlay.Portal></Overlay.Root>;
 if(kind==='Popover.Portal')return <Popover.Root defaultOpen><Popover.Trigger>Open</Popover.Trigger><Popover.Portal><Popover.Content><Popover.Title>Popover</Popover.Title><Popover.Description>Performance fixture</Popover.Description>{marker}</Popover.Content></Popover.Portal></Popover.Root>;
 if(kind==='Tooltip.Portal')return <Tooltip.Provider delayDuration={0}><Tooltip.Root defaultOpen><Tooltip.Trigger>Tip</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content>{marker}</Tooltip.Content></Tooltip.Portal></Tooltip.Root></Tooltip.Provider>;
 if(kind.startsWith('Select.'))return <Select.Root defaultOpen defaultValue="0"><Select.Trigger aria-label="Selection"><Select.Value/></Select.Trigger><Select.Portal><Select.Content position="popper" style={{maxHeight:180}}><Select.ScrollUpButton data-testid="scroll-up"/><Select.Viewport style={{maxHeight:120}}>{Array.from({length:100},(_,i)=><Select.Item key={i} value={String(i)}><Select.ItemText>{`Option ${i}`}</Select.ItemText></Select.Item>)}</Select.Viewport><Select.ScrollDownButton data-testid="scroll-down"/>{marker}</Select.Content></Select.Portal></Select.Root>;
 if(kind==='ScrollArea.Corner')return <ScrollArea.Root type="always" style={{width:220,height:140}}><div style={{width:1000,height:1000}}>Overflow<ScrollArea.Corner data-testid="corner"/></div></ScrollArea.Root>;
 if(kind==='ImageViewer.Content')return <ImageViewer.Root items={[{id:'one',src:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="green"/></svg>'),alt:'Fixture image'}]} defaultOpen><ImageViewer.Trigger>Image</ImageViewer.Trigger><ImageViewer.Content data-testid="viewer"/></ImageViewer.Root>;
 return <p>Unknown portal {kind}</p>;
}
let root:Root|null=null;
(window as any).mountFixture=(kind:string,size=100,bounded=false)=>{if(size>10000||size<1)throw Error('Fixture size outside safe bounds');(window as any).fixtureReady=false;if(root)flushSync(()=>root!.unmount());root=createRoot(host);flushSync(()=>root!.render(kind.includes('.')?<PortalView kind={kind}/>:<DataView key={`${kind}-${size}-${bounded}`} kind={kind} size={size} bounded={bounded}/>));};
(window as any).unmountFixture=()=>{if(root)flushSync(()=>root!.unmount());root=null;(window as any).fixtureReady=false;};
(window as any).fixtureBooted=true;
if(query.has('kind'))(window as any).mountFixture(query.get('kind'),Number(query.get('size')||100),query.get('bounded')==='1');
