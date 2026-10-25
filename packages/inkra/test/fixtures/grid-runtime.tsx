import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Grid } from '../../dist/layout/index.js';

const initial = [{ i: 'a', x: 0, y: 0, w: 4, h: 3, minW: 2, minH: 2 }, { i: 'b', x: 4, y: 0, w: 4, h: 3, minW: 2, minH: 2 }];
function Fixture() {
  const [layout, setLayout] = useState(initial);
  const [reject, setReject] = useState(false);
  const [columns, setColumns] = useState({ a: 50, b: 50 });
  const [rows, setRows] = useState({ top: 50, bottom: 50 });
  const [disabled, setDisabled] = useState(false);
  const [changes, setChanges] = useState(0);
  const [customLabels, setCustomLabels] = useState(false);
  const updateFirst = patch => setLayout(items => items.map((item, index) => index ? item : { ...item, ...patch(item) }));
  return <>
    <button id="reject" onClick={() => setReject(value => !value)}>{String(reject)}</button>
    <output id="layout">{JSON.stringify(layout)}</output>
    <output id="tracks">{JSON.stringify({ columns, rows })}</output>
    <output id="changes">{changes}</output>
    <button id="constraints" onClick={() => updateFirst(item => ({ minW: item.w, maxW: item.w, minH: item.h, maxH: item.h }))}>Constraints</button>
    <button id="unlock-constraints" onClick={() => updateFirst(() => ({ minW: 2, maxW: undefined, minH: 2, maxH: undefined }))}>Unlock</button>
    <button id="static" onClick={() => updateFirst(item => ({ static: !item.static }))}>Static</button>
    <button id="move-flag" onClick={() => updateFirst(item => ({ isDraggable: item.isDraggable === false }))}>Move flag</button>
    <button id="resize-flag" onClick={() => updateFirst(item => ({ isResizable: item.isResizable === false }))}>Resize flag</button>
    <button id="disabled" onClick={() => setDisabled(value => !value)}>Disable</button>
    <button id="custom-labels" onClick={() => setCustomLabels(value => !value)}>Custom labels</button>
    <Grid.Board id="board" layout={layout} onLayoutChange={next => { setChanges(count => count + 1); if (!reject) setLayout(next); }} columns={12} rowHeight={40}
      disabled={disabled} getItemLabel={id => `Card ${id}`} getActionLabel={customLabels ? (action, id) => `${action} ${id}` : undefined}>
      {item => <input aria-label={`Input ${item.i}`} defaultValue="Preserved" data-min-w={item.minW} data-max-w={item.maxW}
        data-min-h={item.minH} data-max-h={item.maxH} />}
    </Grid.Board>
    <Grid.Resizable id="tracks-grid" style={{ height: 300 }} columns={[{ id: 'a', minSize: '20%' }, { id: 'b', minSize: '20%' }]}
      rows={[{ id: 'top', minSize: '20%' }, { id: 'bottom', minSize: '20%' }]}
      columnSizes={columns} rowSizes={rows} onColumnSizesChange={next => { if (!reject) setColumns(next); }}
      onRowSizesChange={next => { if (!reject) setRows(next); }}>
      {({ row, column }) => <div data-cell={`${row}-${column}`}>{row}-{column}</div>}
    </Grid.Resizable>
  </>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
