import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';

import {
  clampDockablePanelPosition,
  placeDockablePanel,
  promoteDockablePanel,
} from '../src/dockable-panel/model.ts';

const componentSource = readFileSync(new URL('../src/dockable-panel/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/dockable-panel/styles.css', import.meta.url), 'utf8');
const dockablePanelModule = process.env.INKRA_DOCKABLE_PANEL_MODULE
  ? new URL(process.env.INKRA_DOCKABLE_PANEL_MODULE, import.meta.url).href
  : null;

const bounds = {
  width: 640,
  height: 420,
  padding: 8,
  titleBarHeight: 44,
  titleBarVisibility: 56,
};

test('position model clamps ordinary panels inside the workspace', () => {
  const panel = { width: 240, height: 180 };
  assert.deepEqual(clampDockablePanelPosition({ x: -90, y: -20 }, panel, bounds), { x: 8, y: 8 });
  assert.deepEqual(clampDockablePanelPosition({ x: 900, y: 900 }, panel, bounds), { x: 392, y: 232 });
  assert.deepEqual(clampDockablePanelPosition({ x: 120, y: 90 }, panel, bounds), { x: 120, y: 90 });
});

test('oversized panels retain a reachable title-bar segment after viewport shrink', () => {
  const panel = { width: 760, height: 520 };
  assert.deepEqual(clampDockablePanelPosition({ x: -900, y: 900 }, panel, bounds), { x: -696, y: 368 });
  assert.deepEqual(clampDockablePanelPosition({ x: 900, y: -100 }, panel, bounds), { x: 576, y: 8 });
});

test('placement snaps independently to horizontal and vertical viewport edges', () => {
  const panel = { width: 240, height: 180 };
  assert.deepEqual(placeDockablePanel({ x: 15, y: 225 }, panel, bounds, 12), {
    position: { x: 8, y: 232 },
    snappedEdges: ['left', 'bottom'],
  });
  assert.deepEqual(placeDockablePanel({ x: 385, y: 16 }, panel, bounds, 12), {
    position: { x: 392, y: 8 },
    snappedEdges: ['right', 'top'],
  });
});

test('position model sanitizes non-finite coordinates and layer promotion is immutable', () => {
  assert.deepEqual(clampDockablePanelPosition({ x: Number.NaN, y: Number.POSITIVE_INFINITY }, { width: 200, height: 100 }, bounds), { x: 8, y: 8 });
  const order = ['notes', 'tools', 'details'];
  assert.deepEqual(promoteDockablePanel(order, 'tools'), ['notes', 'details', 'tools']);
  assert.deepEqual(promoteDockablePanel(order, 'new'), ['notes', 'tools', 'details', 'new']);
  assert.deepEqual(order, ['notes', 'tools', 'details']);
});

test('component delegates pointer and touch dragging to dnd-kit while keeping keyboard movement explicit', () => {
  assert.match(componentSource, /from '@dnd-kit\/core'/);
  assert.match(componentSource, /useSensor\(MouseSensor/);
  assert.match(componentSource, /useSensor\(TouchSensor/);
  assert.match(componentSource, /activationConstraint: \{ delay: 180, tolerance: 8 \}/);
  assert.match(componentSource, /event\.key === 'Home'/);
  assert.match(componentSource, /changePosition\(defaultPosition, 'reset', false\)/);
  assert.match(componentSource, /}, 'keyboard', false\)/);
  assert.match(componentSource, /ArrowLeft:[\s\S]*ArrowRight:[\s\S]*ArrowUp:[\s\S]*ArrowDown:/);
  assert.match(componentSource, /event\.shiftKey \? 4 : 1/);
  assert.match(componentSource, /placeDockablePanel/);
  assert.match(componentSource, /const visualPosition =/);
  assert.match(componentSource, /clampDockablePanelPosition\(translatedPosition/);
});

test('component exposes controlled and uncontrolled position, collapse and activation paths', () => {
  assert.match(componentSource, /activeId === undefined \? uncontrolledActiveId : activeId/);
  assert.match(componentSource, /position \?\? uncontrolledPosition/);
  assert.match(componentSource, /collapsed \?\? uncontrolledCollapsed/);
  assert.match(componentSource, /position === undefined\) setUncontrolledPosition/);
  assert.match(componentSource, /collapsed === undefined\) setUncontrolledCollapsed/);
  assert.match(componentSource, /onPositionChange\?\./);
  assert.match(componentSource, /onCollapsedChange\?\./);
  assert.match(componentSource, /onActiveChange\?\./);
  assert.match(componentSource, /onFocusCapture\?\.\(event\)/);
});

test('component preserves nested interaction, title semantics and viewport recovery', () => {
  assert.match(componentSource, /button, a, input, select, textarea/);
  assert.match(componentSource, /data-dockable-panel-no-drag/);
  assert.match(componentSource, /aria-labelledby=\{titleId\}/);
  assert.match(componentSource, /aria-describedby=\{movable \? instructionsId/);
  assert.match(componentSource, /ResizeObserver/);
  assert.match(componentSource, /reason: DockablePanelPositionReason/);
  assert.doesNotMatch(componentSource, /localStorage|sessionStorage/);
});

test('styles keep stable title controls, bounded content and accessible fallbacks', () => {
  assert.match(styles, /min-block-size: var\(--inkra-touch-target\)/);
  assert.match(styles, /touch-action: none/);
  assert.match(styles, /overflow: auto/);
  assert.match(styles, /position: absolute/);
  assert.match(styles, /left: 0/);
  assert.match(styles, /top: 0/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /\.inkra-visually-hidden/);
});

test('SSR renders labeled panels, collapse state, controls and content without browser globals', { skip: !dockablePanelModule }, async () => {
  const { DockablePanel, DockablePanelWorkspace } = await import(dockablePanelModule);
  const markup = render(h(DockablePanelWorkspace, { defaultActiveId: 'notes' },
    h(DockablePanel, {
      id: 'notes',
      title: 'Notes',
      defaultCollapsed: true,
      labels: { move: 'Move notes', expand: 'Expand notes', reset: 'Restore notes' },
    }, h('button', null, 'Nested action')),
    h(DockablePanel, { id: 'tools', title: 'Tools', movable: false, collapsible: false }, 'Tools body'),
  ));
  assert.match(markup, /inkra-dockable-panel-workspace/);
  assert.match(markup, /data-active="true"/);
  assert.match(markup, /data-collapsed="true"/);
  assert.match(markup, /aria-label="Move notes"/);
  assert.match(markup, /aria-label="Restore notes"/);
  assert.match(markup, /aria-label="Expand notes"/);
  assert.doesNotMatch(markup, /Nested action/);
  assert.match(markup, /Tools body/);
});
