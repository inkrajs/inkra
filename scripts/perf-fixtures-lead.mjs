// Exhaustive lead-component scenarios. Composite timings are shared, never isolated.
import assert from 'node:assert/strict';
import { createElement as h, Fragment } from 'react';
import * as I from '../packages/inkra/dist/index.js';

const common = 'Size is repeated independent scenarios. Null DOM refs exclude layout, paint, canvas drawing, focus, pointer interaction and browser listener costs. Composite totals are shared by all listed identities, not isolated component timings.';
const names = (group, parts) => parts.split(' ').map(part => `${group}.${part}`);
const repeated = make => (size, variant = 0) => h(Fragment, null,
  Array.from({ length: size }, (_, index) => h(Fragment, { key: index }, make(index, variant))));
const label = (i, v) => `Benchmark ${i} revision ${v}`;
const fixture = (id, covers, make, notes = '', mode) => ({ id, covers, create: repeated(make), scales: [1, 10, 100], notes: `${common} ${notes}`, ...(mode ? { mode } : {}) });
const blocked = (id, covers, reason) => ({ id, covers, blocked: reason });

// Untimed output contracts guard against successful-but-empty SSR (especially portals).
// These inspect emitted markup, not wrapper component identities or React internals.
const ssrContracts = {
  'lead-accordion-open': ['inkra-accordion__item', 'inkra-accordion__header', 'inkra-accordion__trigger', 'inkra-accordion__content-body', 'role="region"', 'data-state="open"'],
  'lead-tabs': ['inkra-tabs__list', 'inkra-tabs__trigger', 'inkra-tabs__content', 'role="tabpanel"', 'data-state="active"'],
  'lead-popover-open-ssr': ['inkra-popover__content', 'inkra-popover__content-body', 'role="dialog"', '>Anchor<', '>Open<', 'data-state="open"'],
  'lead-hover-card-inline-aliases-ssr': ['inkra-popover__title', 'inkra-popover__description', 'role="dialog"', '>Close<', /Description \d+/],
  'lead-dropdown-menu-open-ssr': ['inkra-menu__paper', 'inkra-menu__item', 'role="menu"', 'role="menuitem"', '>Open<'],
  'lead-context-menu-open-ssr': ['inkra-menu__paper', 'inkra-menu__group-label', 'inkra-menu__separator', 'inkra-context-menu__sub-trigger', 'inkra-context-menu__anchor', 'role="menu"', 'role="group"', 'role="menuitemcheckbox"', 'role="menuitemradio"', 'Choice A', 'Choice B', /Group \d+/, /Checked \d+/, /Submenu \d+/],
  'lead-tooltip-open-ssr': ['inkra-tooltip__content', 'inkra-tooltip__content-body', 'role="tooltip"', '>Hover<'],
  'lead-scroll-area': ['inkra-scroll-area__viewport', 'overflow:scroll'],
  'lead-scroll-area-parts': ['inkra-scroll-area__viewport', 'inkra-scroll-area__content', 'inkra-scroll-area__scrollbar', 'inkra-scroll-area__thumb', 'visibility:hidden'],
};
for (const [group, prefix] of [['Overlay', 'overlay'], ['Drawer', 'drawer'], ['AlertDialog', 'alert-dialog']]) {
  ssrContracts[`lead-${group}-open-ssr`] = [
    ...['backdrop', 'content', 'header', 'title', 'description', 'body', 'footer'].map(part => `inkra-${prefix}__${part}`),
    `role="${group === 'AlertDialog' ? 'alertdialog' : 'dialog'}"`, 'data-state="open"', '>Open<', /Description \d+/,
    ...(group === 'AlertDialog' ? ['>Cancel<', /Confirm \d+/] : ['>Close<', `inkra-${prefix}__close-button`, /aria-label="Close \d+"/]),
  ];
}
function outputVerifier(id) {
  const requirements = ssrContracts[id];
  assert.ok(requirements, `Missing SSR output contract: ${id}`);
  return html => {
    assert.equal(typeof html, 'string', `${id}: expected serialized HTML`);
    assert.match(html, /Benchmark \d+ revision \d+/, `${id}: meaningful fixture children missing`);
    for (const expected of requirements) {
      if (expected instanceof RegExp) assert.match(html, expected, `${id}: missing ${expected}`);
      else assert.ok(html.includes(expected), `${id}: missing emitted markup ${expected}`);
    }
    // Accordion/Tabs have a label in both the trigger and actual content. A lone
    // trigger must not satisfy coverage if the content accidentally stops rendering.
    if (id === 'lead-accordion-open' || id === 'lead-tabs') {
      assert.ok((html.match(/Benchmark \d+ revision \d+/g) ?? []).length >= 2,
        `${id}: trigger exists but meaningful content is absent`);
    }
    return true;
  };
}

export async function fixtures() {
  const out = [];
  const add = (...args) => out.push(fixture(...args));
  add('lead-accordion-open', names('Accordion', 'Root Item Header Trigger Content'), (i, v) =>
    h(I.Accordion.Root, { type: 'single', value: 'a' },
      h(I.Accordion.Item, { value: 'a' }, h(I.Accordion.Header, null, h(I.Accordion.Trigger, null, label(i, v))),
        h(I.Accordion.Content, { forceMount: true }, label(i, v)))),
    'SSR only: Radix Collapsible content requires browser requestAnimationFrame on mount; no scheduler shim is substituted.', 'ssr');
  add('lead-breadcrumb', names('Breadcrumb', 'Root List Item Link Separator Page'), (i, v) =>
    h(I.Breadcrumb.Root, null, h(I.Breadcrumb.List, null,
      h(I.Breadcrumb.Item, null, h(I.Breadcrumb.Link, { href: '#home' }, label(i, v))),
      h(I.Breadcrumb.Separator), h(I.Breadcrumb.Item, null, h(I.Breadcrumb.Page, null, `Current ${v}`)))));
  add('lead-empty', names('Empty', 'Root Icon Title Description Actions'), (i, v) =>
    h(I.Empty.Root, null, h(I.Empty.Icon, null, '○'), h(I.Empty.Title, null, label(i, v)),
      h(I.Empty.Description, null, `Description ${v}`), h(I.Empty.Actions, null, h('button', null, 'Retry'))));
  for (const name of ['Container', 'Flex', 'Grid', 'Stack', 'Badge', 'PencilText', 'PencilSurface', 'Slot']) {
    add(`lead-${name}`, [name], (i, v) => h(I[name], null, label(i, v)));
  }
  add('lead-Progress', ['Progress'], (i, v) => h(I.Progress, { value: 40 + v, 'aria-label': label(i, v) }));
  add('lead-Separator', ['Separator'], (i, v) => h(I.Separator, { 'aria-label': label(i, v) }));
  add('lead-Skeleton', ['Skeleton'], (i, v) => h(I.Skeleton, { width: 80 + v, height: 24, 'aria-label': label(i, v) }));
  add('lead-PencilLine', ['PencilLine'], (i, v) => h(I.PencilLine, { seed: `line-${i}`, weight: 1 + v / 10 }));
  add('lead-PencilIcon', ['PencilIcon'], (i, v) => h(I.PencilIcon, { paths: [{ d: 'M4 12h16' }], size: 24, 'aria-label': label(i, v) }));
  add('lead-layout', names('Layout', 'Root Header Body Sidebar Content Footer'), (i, v) =>
    h(I.Layout.Root, null, h(I.Layout.Header, null, label(i, v)),
      h(I.Layout.Body, null, h(I.Layout.Sidebar, null, 'Sidebar'), h(I.Layout.Content, null, label(i, v))),
      h(I.Layout.Footer, null, 'Footer')));
  add('lead-pagination', ['Pagination'], (i, v) => h(I.Pagination, { totalPages: 100, page: 50 + v }));
  add('lead-steps', ['Steps'], (i, v) => h(I.Steps, { current: v % 3, items: Array.from({ length: 3 }, (_, j) => ({ id: `step-${j}`, title: `${label(i, v)} step ${j}`, description: 'Description' })) }));
  add('lead-timeline', ['Timeline'], (i, v) => h(I.Timeline, { items: Array.from({ length: 3 }, (_, j) => ({ id: `event-${j}`, title: `${label(i, v)} event ${j}`, date: '2026-10-24', description: 'Description' })) }));
  add('lead-tabs', names('Tabs', 'Root List Trigger Content'), (i, v) =>
    h(I.Tabs.Root, { value: 'a' }, h(I.Tabs.List, null, h(I.Tabs.Trigger, { value: 'a' }, label(i, v))),
      h(I.Tabs.Content, { value: 'a', forceMount: true }, label(i, v))),
    'SSR only: Radix Tabs content requires browser requestAnimationFrame on mount; no scheduler shim is substituted.', 'ssr');
  add('lead-dockable-panel', ['DockablePanelWorkspace', 'DockablePanel'], (i, v) =>
    h(I.DockablePanelWorkspace, null, h(I.DockablePanel, { id: `panel-${i}`, title: label(i, v), movable: false }, label(i, v))),
    'One panel per workspace; drag and viewport geometry are excluded.');
  add('lead-resizable', names('Resizable', 'Root Panel Handle'), (i, v) =>
    h(I.Resizable.Root, { id: `group-${i}` }, h(I.Resizable.Panel, { id: `left-${i}`, defaultSize: '50%' }, label(i, v)),
      h(I.Resizable.Handle, { label: `Resize ${v}` }), h(I.Resizable.Panel, { id: `right-${i}`, defaultSize: '50%' }, 'Right')));
  add('lead-scroll-area', ['ScrollArea'], (i, v) => h(I.ScrollArea, { viewportLabel: label(i, v), type: 'always' }, h('div', null, label(i, v))),
    'Convenience root with built-in primitive viewport/scrollbars; no measured overflow.');
  // The public convenience Root already builds a viewport; use the underlying provider to exercise exported parts without nested viewport markup.
  const { ScrollArea: BaseScrollArea } = await import('@base-ui/react/scroll-area');
  add('lead-scroll-area-parts', names('ScrollArea', 'Viewport Content Scrollbar Thumb'), (i, v) =>
    h(BaseScrollArea.Root, null,
      h(I.ScrollArea.Viewport, null, h(I.ScrollArea.Content, null, label(i, v))),
      h(I.ScrollArea.Scrollbar, { keepMounted: true }, h(I.ScrollArea.Thumb))),
    'Base UI Root supplies the required context. keepMounted retains the scrollbar without browser overflow. Scrollbar and Thumb verified in size-1 renderer output; Thumb remains CSS-hidden and no actual overflow is measured. Corner is separately blocked.');

  out.push(blocked('lead-scroll-area-corner-blocked', ['ScrollArea.Corner'],
    'Base UI Corner returns null until real layout establishes intersecting overflowing scrollbars. It has no keepMounted override; null-ref renderer and SSR cannot measure its actual visible output.'));

  // No portals in these open-content fixtures: SSR actually traverses the complete content subtree.
  // Effects require document/focus scopes in React test renderer, so these are explicitly SSR-only.
  for (const group of ['Overlay', 'Drawer', 'AlertDialog']) {
    const C = I[group];
    const parts = group === 'AlertDialog'
      ? 'Root Trigger Backdrop Content Header Title Description Body Footer Cancel Action'
      : 'Root Trigger Backdrop Content Header Title Description Body Footer Close CloseButton';
    add(`lead-${group}-open-ssr`, names(group, parts), (i, v) => h(C.Root, { open: true },
      h(C.Trigger, null, 'Open'), h(C.Backdrop, { forceMount: true }),
      h(C.Content, { forceMount: true }, h(C.Header, group === 'AlertDialog' ? {} : { showClose: false }, h(C.Title, null, label(i, v))),
        h(C.Description, null, `Description ${v}`), h(C.Body, null, label(i, v)),
        h(C.Footer, null, group === 'AlertDialog'
          ? h(Fragment, null, h(C.Cancel, null, 'Cancel'), h(C.Action, null, `Confirm ${v}`))
          : h(Fragment, null, h(C.Close, null, 'Close'), h(C.CloseButton, { label: `Close ${v}` }))))),
      'Open content rendered inline, not through a portal. SSR only: no mount, rerender, cleanup, focus trapping or backdrop scroll locking measurement.', 'ssr');
  }
  add('lead-popover-open-ssr', names('Popover', 'Root Anchor Trigger Content'), (i, v) =>
    h(I.Popover.Root, { open: true }, h(I.Popover.Anchor, null, 'Anchor'), h(I.Popover.Trigger, null, 'Open'),
      h(I.Popover.Content, { forceMount: true }, label(i, v))), 'SSR only; inline open content without floating geometry or effects.', 'ssr');
  add('lead-hover-card-trigger', names('HoverCard', 'Root Trigger'), (i, v) =>
    h(I.HoverCard.Root, { open: false }, h(I.HoverCard.Trigger, null, label(i, v))),
    'Root and trigger lifecycle only. Content is not included or claimed.');
  add('lead-hover-card-inline-aliases-ssr', names('HoverCard', 'Title Description Close'), (i, v) =>
    h(I.HoverCard.Root, { open: true }, h(I.Popover.Content, { forceMount: true },
      h(I.HoverCard.Title, null, label(i, v)), h(I.HoverCard.Description, null, `Description ${v}`), h(I.HoverCard.Close, null, 'Close'))),
    'These public HoverCard aliases are Popover title/description/close. Valid HoverCard root context with inline Popover.Content exercises them without HoverCard.Content’s unconditional portal. SSR only; shared wrapper cost included.', 'ssr');
  out.push(blocked('lead-hover-card-content-blocked', ['HoverCard.Content'],
    'HoverCard.Content unconditionally wraps Popover.Content in Popover.Portal. SSR omits content and children; a real DOM portal renderer is needed for actual content coverage.'));
  add('lead-dropdown-menu-open-ssr', names('DropdownMenu', 'Root Trigger Content'), (i, v) =>
    h(I.DropdownMenu.Root, { open: true, modal: false }, h(I.DropdownMenu.Trigger, null, 'Open'),
      h(I.DropdownMenu.Content, { forceMount: true }, h(I.DropdownMenu.Item, null, label(i, v)))),
    'SSR only; inline open menu with one item. No menu keyboard/focus or positioning effects.', 'ssr');
  add('lead-context-menu-open-ssr', names('ContextMenu', 'Root Trigger Content Group Label Item CheckboxItem RadioGroup RadioItem Separator Sub SubTrigger'), (i, v) => {
    const C = I.ContextMenu;
    return h(C.Root, { open: true, modal: false }, h(C.Trigger, null, label(i, v)), h(C.Content, { forceMount: true },
      h(C.Group, null, h(C.Label, null, `Group ${v}`), h(C.Item, null, label(i, v)),
        h(C.CheckboxItem, { checked: Boolean(v % 2) }, `Checked ${v}`), h(C.Separator),
        h(C.RadioGroup, { value: v ? 'b' : 'a' }, h(C.RadioItem, { value: 'a' }, 'Choice A'), h(C.RadioItem, { value: 'b' }, 'Choice B')),
        h(C.Sub, { open: true }, h(C.SubTrigger, null, `Submenu ${v}`)))));
  }, 'SSR only; open parent menu and submenu trigger. SubContent is separately blocked because it unconditionally portals.', 'ssr');
  add('lead-tooltip-open-ssr', names('Tooltip', 'Provider Root Trigger Content'), (i, v) =>
    h(I.Tooltip.Provider, null, h(I.Tooltip.Root, { open: true }, h(I.Tooltip.Trigger, null, 'Hover'),
      h(I.Tooltip.Content, { forceMount: true }, label(i, v)))),
    'SSR only; inline open tooltip. No delay timers, positioning or pointer grace-area measurements.', 'ssr');
  add('lead-toast-provider', ['Toast.Provider'], (i, v) =>
    h(I.Toast.Provider, { viewportLabel: `Notifications ${v}` }, h('span', null, label(i, v))),
    'Provider with empty queue only; portaled viewport and toast notifications are not covered.');
  for (const group of ['AlertDialog', 'ContextMenu', 'Drawer', 'Overlay', 'Popover', 'Tooltip']) {
    out.push(blocked(`lead-${group}-portal-blocked`, [`${group}.Portal`],
      'Requires a real DOM portal container and React DOM renderer. Node SSR omits portal children; null-ref test renderer cannot mount them. Reporting closed/empty portal timing would falsely imply actual portal-content coverage.'));
  }
  out.push(blocked('lead-context-subcontent-blocked', ['ContextMenu.SubContent'],
    'ContextMenu.SubContent unconditionally wraps its subtree in Radix Portal. Without a real DOM portal renderer no submenu content mounts, even with forceMount.'));
  for (const entry of out) {
    if (entry.mode === 'ssr' || ssrContracts[entry.id]) entry.verifySsr = outputVerifier(entry.id);
  }
  return out;
}
