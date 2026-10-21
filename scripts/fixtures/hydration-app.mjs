import { createElement as h, useEffect, useState } from 'react';
import { Button, Calendar, Checkbox, Field, Input, InputNumber, JourneyMap, Overlay, PencilText, Select, Tabs } from 'inkra';

const places = [{ id: 'auckland', label: 'Auckland', latitude: -36.85, longitude: 174.76 }];

export function App() {
  const [count, setCount] = useState(0);
  useEffect(() => { document.documentElement.dataset.hydrated = 'true'; }, []);
  return h('main', { style: { padding: 24, maxWidth: 700 } },
    h(PencilText, { as: 'h1', id: 'title' }, 'Inkra hydration'),
    h(Button, { onClick: () => setCount(value => value + 1) }, `Count ${count}`),
    h(Field, { label: 'Name' }, h(Input, { defaultValue: 'Inkra', clearable: true })),
    h(Field, { label: 'Quantity' }, h(InputNumber, { defaultValue: 2 })),
    h(Checkbox, { 'aria-label': 'Remember', defaultChecked: true }),
    h(Select.Root, { defaultValue: 'private' },
      h(Select.Trigger, { 'aria-label': 'Visibility' }, h(Select.Value)),
      h(Select.Portal, null, h(Select.Content, { position: 'popper' }, h(Select.Viewport, null,
        h(Select.Item, { value: 'private' }, h(Select.ItemText, null, 'Private')),
        h(Select.Item, { value: 'team' }, h(Select.ItemText, null, 'Team')))))),
    h(Tabs.Root, { defaultValue: 'one' },
      h(Tabs.List, { 'aria-label': 'Views', divided: true },
        h(Tabs.Trigger, { value: 'one' }, 'One'), h(Tabs.Trigger, { value: 'two' }, 'Two')),
      h(Tabs.Content, { value: 'one' }, 'First panel'), h(Tabs.Content, { value: 'two' }, 'Second panel')),
    h(Overlay.Root, null,
      h(Overlay.Trigger, { asChild: true }, h(Button, null, 'Edit note')),
      h(Overlay.Portal, null, h(Overlay.Backdrop), h(Overlay.Content, { layout: 'sections' },
        h(Overlay.Header, null, h(Overlay.Title, null, 'Note'), h(Overlay.Description, null, 'Edit the name')),
        h(Overlay.Body, null, h(Input, { 'aria-label': 'Note name' })),
        h(Overlay.Footer, null, h(Overlay.Close, { asChild: true }, h(Button, null, 'Done')))))),
    h(Calendar, { mode: 'single', defaultMonth: new Date(2026, 9, 1), appearance: 'picker' }),
    h(JourneyMap, { places, attribution: 'Test coordinates', height: 240, 'aria-label': 'Trip map' }),
  );
}
