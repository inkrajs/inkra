import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { InventoryGrid } from '../../dist/inventory-grid/index.js';
import { ThemeProvider } from '../../dist/theme/index.js';

const initial = [
  { id: 'pack', label: 'Backpack', columns: 6, rows: 5, disabledCells: [{ x: 5, y: 4 }], items: [
    { id: 'l', label: 'Tool', cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], position: { x: 0, y: 0 } },
    { id: 'dot', label: 'Supply', cells: [{ x: 0, y: 0 }], position: { x: 1, y: 0 } },
    { id: 'bar', label: 'Map', cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], position: { x: 3, y: 0 } },
  ] },
  { id: 'storage', label: 'Storage', columns: 6, rows: 5, items: [] },
];
function Fixture() {
  const [containers, setContainers] = useState(initial);
  const [reject, setReject] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [rule, setRule] = useState(false);
  const [changes, setChanges] = useState(0);
  return <>
    <button id="reset" onClick={() => { setContainers(initial); setReject(false); setDisabled(false); setReadOnly(false); setRule(false); setChanges(0); }}>Reset</button>
    <button id="reject" onClick={() => setReject(value => !value)}>Reject</button>
    <button id="disabled" onClick={() => setDisabled(value => !value)}>Disabled</button>
    <button id="readonly" onClick={() => setReadOnly(value => !value)}>Read only</button>
    <button id="rule" onClick={() => setRule(value => !value)}>Rule</button>
    <button id="remove" onClick={() => setContainers(value => value.map(container => ({ ...container, items: container.items.filter(item => item.id !== 'dot') })))}>Remove</button>
    <output id="state">{JSON.stringify(containers)}</output><output id="changes">{changes}</output>
    <ThemeProvider id="inventory-host" theme="dark" tokens={{ '--inkra-ink': '#123456', '--inkra-action': '#456789' }}>
      <InventoryGrid containers={containers} onChange={next => { setChanges(value => value + 1); if (!reject) setContainers(next); }}
        disabled={disabled} readOnly={readOnly} canPlace={({ target }) => !rule || target.id !== 'storage'} />
    </ThemeProvider>
  </>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
Object.assign(window, { mountInventoryFixture: (node: HTMLElement) => createRoot(node).render(<Fixture />) });
