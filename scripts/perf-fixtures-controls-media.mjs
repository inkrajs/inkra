import React from 'react';
import * as C from '../packages/inkra/dist/index.js';
import { ReactFlow, ReactFlowProvider } from '@xyflow/react';
const h = React.createElement;
const noop = () => {};
const scales = [1, 10, 100];
const baseNote = 'Scale repeats complete instances; all listed identities share total fixture time, not isolated attribution. Null DOM refs exclude canvas drawing, layout, native input interaction, image/media decode and compositor work.';
const date = new Date(2026, 9, 24, 12);
const dates = [date, new Date(2026, 9, 25, 12)];
const hotkeys = [{ key: 'k', modifiers: ['control'] }, { key: 'j', modifiers: ['control'] }];
const ranges = [[20, 80], [25, 75]];
const sliderValues = [[25], [30]];
const keypadLayout = [[{ id: '1', label: '1' }, { id: '2', label: '2' }], [{ id: 'delete', label: 'Delete', action: 'delete' }]];
const presets = ['#336699', '#669933'];
const stepperItems = [
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'In review', disabled: true },
  { value: 'published', label: 'Published' },
];
const graphNodes = [0, 1].map(v => [{ id: 'a', position: { x: 0, y: 0 }, data: { label: `Node ${v}` }, width: 100, height: 50 }]);
const portNodes = [0, 1].map(v => [{ id: 'port-node', type: 'fixture', position: { x: 0, y: 0 }, data: { label: `Port ${v}` }, width: 100, height: 50 }]);
const portNodeTypes = { fixture: ({ data }) => h(C.NodeGraph.Node, { label: 'Node' }, h(C.NodeGraph.Port, { id: 'out', type: 'source', label: data.label })) };
const empty = [];
const images = [0, 1].map(v => [{ id: 'a', src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E', alt: `Image ${v}` }]);
const axes = ['a', 'b', 'c'].map(id => ({ id, label: id }));
const series = [0, 1].map(v => [{ id: 's', label: `Series ${v}`, data: axes.map((a, i) => ({ axisId: a.id, value: i + v + 1 })) }]);
const rows = [{ id: 'r', label: 'Row' }], columns = [{ id: 'c', label: 'Column' }];
const cells = [0, 1].map(v => [{ rowId: 'r', columnId: 'c', value: v + 1 }]);
const events = [0, 1].map(v => [{ id: 'e', title: `Event ${v}`, startMinute: 540, endMinute: 600 }]);
const places = [0, 1].map(v => [{ id: 'p', label: `Place ${v}`, latitude: 40, longitude: -74 }]);
function repeated(id, covers, build, notes = '', mode) {
  return { id, covers, scales, notes: `${baseNote} ${notes}`, ...(mode ? { mode } : {}), create(size, variant = 0) {
    return h(React.Fragment, null, Array.from({ length: size }, (_, i) => h(React.Fragment, { key: i }, build(variant % 2, i))));
  } };
}
export async function fixtures() {
  const result = [
    repeated('controls-button', ['Button'], v => h(C.Button, null, `Action ${v}`)),
    repeated('controls-button-link', ['ButtonLink'], v => h(C.ButtonLink, { href: '#benchmark' }, `Link ${v}`)),
    repeated('controls-button-group', ['ButtonGroup'], v => h(C.ButtonGroup, { 'aria-label': `Actions ${v}` }, h(C.Button, null, 'First'), h(C.Button, null, 'Second'))),
    repeated('controls-calendar', ['Calendar'], v => h(C.Calendar, { mode: 'single', month: date, selected: dates[v], onSelect: noop })),
    repeated('controls-color-picker', ['ColorPicker'], v => h(C.ColorPicker, { value: presets[v], presets, label: `Color ${v}` })),
    repeated('controls-date-picker', ['DatePicker'], v => h(C.DatePicker, { value: dates[v], open: false, onValueChange: noop }), 'Closed picker trigger/value only; popup calendar and focus behavior are not measured.'),
    repeated('controls-editable', ['Editable'], v => h(C.Editable, { value: `Edit ${v}`, editing: true, onValueChange: noop }), 'Editor branch mounted; save/validation/network interaction not exercised.'),
    repeated('controls-field', ['Field'], v => h(C.Field, { label: `Field ${v}`, description: 'Description' }, h('input', { defaultValue: 'Example' }))),
    repeated('controls-input', ['Input'], v => h(C.Input, { value: `Input ${v}`, onChange: noop })),
    repeated('controls-textarea', ['Textarea'], v => h(C.Textarea, { value: `Text ${v}`, onChange: noop })),
    repeated('controls-hotkey', ['Hotkey'], v => h(C.Hotkey, { value: hotkeys[v], platform: 'windows' })),
    repeated('controls-hotkey-input', ['HotkeyInput'], v => h(C.HotkeyInput, { value: hotkeys[v], platform: 'windows', onValueChange: noop })),
    repeated('controls-input-number', ['InputNumber'], v => h(C.InputNumber, { value: 20 + v, onValueChange: noop })),
    repeated('controls-keypad', ['Keypad'], v => h(C.Keypad, { layout: keypadLayout, value: `${v}`, label: `Keypad ${v}` })),
    repeated('controls-range-slider', ['RangeSlider'], v => h(C.RangeSlider, { value: ranges[v], onValueChange: noop })),
    repeated('controls-rating', ['Rating'], v => h(C.Rating, { value: 3 + v, onValueChange: noop, 'aria-label': 'Rating' })),
    repeated('controls-checkbox', ['Checkbox'], v => h(C.Checkbox, { checked: Boolean(v), onChange: noop }, `Check ${v}`)),
    repeated('controls-radio', ['RadioGroup', 'RadioGroupItem'], v => h(C.RadioGroup, { value: v ? 'b' : 'a', onValueChange: noop, 'aria-label': 'Options' }, h(C.RadioGroupItem, { value: 'a' }, 'First'), h(C.RadioGroupItem, { value: 'b' }, 'Second'))),
    repeated('controls-switch', ['Switch'], v => h(C.Switch, { checked: Boolean(v), onChange: noop }, `Switch ${v}`)),
    repeated('controls-select-stepper', ['Select.Stepper'], (v, i) => h(C.Select.Stepper, { items: stepperItems, value: v ? 'published' : 'draft', onValueChange: noop, name: `stepper-${i}`, 'aria-label': `Visibility ${v}` }), 'Supplemental fixture for upstream a7a526b; not part of the historical 230-identity report. Three native options per instance, including one disabled option. Changed inputs move between enabled endpoints. Scale repeats instances, not option count; native form reset/validation, focus, keyboard gestures and large-option behavior are not measured.'),
    repeated('controls-slider', ['Slider'], v => h(C.Slider, { value: sliderValues[v], onValueChange: noop, 'aria-label': 'Value' })),
    repeated('controls-time-picker', ['TimePicker'], v => h(C.TimePicker, { value: v ? '10:30' : '09:30', onValueChange: noop })),
    repeated('controls-toggle-group', ['ToggleGroup.Root', 'ToggleGroup.Item'], v => h(C.ToggleGroup.Root, { value: v ? ['b'] : ['a'], onValueChange: noop }, h(C.ToggleGroup.Item, { value: 'a' }, `First ${v}`), h(C.ToggleGroup.Item, { value: 'b' }, 'Second'))),
    repeated('controls-upload', ['Upload'], v => h(C.Upload, { multiple: true, 'aria-label': `Upload ${v}` }), 'Upload chooser UI only; no files, network upload, progress events or drag-and-drop exercised.'),
    repeated('media-audio-player', ['AudioPlayer'], v => h(C.AudioPlayer, { preload: 'none', volume: v ? 0.7 : 0.5, 'aria-label': `Audio ${v}` }), 'Idle native audio shell and default controls; no playback or media load.'),
    repeated('media-carousel', ['Carousel'], v => h(C.Carousel, { autoplay: false, currentIndex: v }, h('div', null, `Slide ${v}`), h('div', null, 'Second slide')), 'Two slides per instance; null refs prevent Embla geometry/scroll initialization.'),
    repeated('media-day-agenda', ['DayAgenda'], v => h(C.DayAgenda, { date: '2026-10-24', events: events[v] })),
    repeated('media-flip', ['Flip', 'FlipToggle'], v => h(C.Flip, { flipped: Boolean(v), front: h(C.FlipToggle, null, `Front ${v}`), back: h(C.FlipToggle, null, 'Back') }), 'Both faces and their context-bound toggles are mounted; CSS visibility and animation are not measured.'),
    repeated('media-tilt', ['Tilt'], v => h(C.Tilt, null, `Tilt ${v}`), 'No synthetic pointer events or layout reads.'),
    repeated('media-heatmap', ['Heatmap'], v => h(C.Heatmap, { rows, columns, cells: cells[v], label: `Heatmap ${v}` })),
    repeated('media-image-cropper', ['ImageCropper'], v => h(C.ImageCropper, { source: '', alt: `Crop ${v}`, labels: { cropper: `Crop area ${v}`, zoom: `Zoom ${v}` } }), 'Empty-image shell and controls only; native decode/crop engine/export pixels excluded.'),
    repeated('media-image-viewer-trigger', ['ImageViewer.Root', 'ImageViewer.Trigger'], v => h(C.ImageViewer.Root, { items: images[v], open: false }, h(C.ImageViewer.Trigger, null, `Open ${v}`)), 'Provider/trigger only, not Content; closed portal does not count as rendered content.'),
    { id: 'media-image-viewer-content', covers: ['ImageViewer.Content'], blocked: 'ImageViewer.Content unconditionally wraps its visual descendants in OverlayPortal. Without a real DOM portal target the content subtree cannot mount; closed-portal or SSR shell timings would falsely claim content coverage.' },
    repeated('media-journey-map', ['JourneyMap'], v => h(C.JourneyMap, { places: places[v], attribution: 'Synthetic benchmark', showPlaceList: true }), 'SSR only: Leaflet needs window/document and host geometry. Measures accessible place list/server shell, not map mount, terrain drawing or pan.', 'ssr'),
    repeated('media-node-graph-root', ['NodeGraph.Root'], v => h(C.NodeGraph.Root, { nodes: graphNodes[v], edges: empty }), 'SSR only: Root server fallback renders accessible node list, not the React Flow engine, Node, Port or Edge.', 'ssr'),
    repeated('media-node-graph-controls', ['NodeGraph.Controls'], v => h(ReactFlowProvider, null, h(C.NodeGraph.Controls, { zoomInLabel: `Zoom in ${v}` })), 'Public ReactFlowProvider supplies legitimate control context; viewport actions are not invoked.'),
    repeated('media-node-graph-node', ['NodeGraph.Node'], v => h(C.NodeGraph.Node, { label: `Node ${v}`, description: 'Description' }), 'Standalone shell without ports; does not claim Port coverage.'),
    repeated('media-node-graph-edge', ['NodeGraph.Edge'], v => h('svg', null, h(C.NodeGraph.Edge, { id: 'edge', path: v ? 'M0 0 L120 80' : 'M0 0 L100 80' })), 'SVG edge without label portal. Null path/canvas refs exclude path sampling and raster cache/drawing.'),
    repeated('media-node-graph-port', ['NodeGraph.Port'], v => h(ReactFlowProvider, { initialNodes: portNodes[v], initialEdges: empty, initialWidth: 400, initialHeight: 300 }, h(ReactFlow, { nodes: portNodes[v], edges: empty, nodeTypes: portNodeTypes, width: 400, height: 300 })), 'SSR composite: public ReactFlowProvider initial nodes/dimensions and ReactFlow custom node renderer provide legitimate NodeIdContext. Actual Handle/Port markup verified. Timing includes full engine server shell and Node wrapper, not isolated Port. No connection gestures or viewport updates.', 'ssr'),
    repeated('media-number-ticker', ['NumberTicker'], v => h(C.NumberTicker, { value: 1234 + v, animate: false, locale: 'en-US' }), 'Animation explicitly disabled for deterministic render metrics; frame cadence excluded.'),
    repeated('media-pan-zoom', ['PanZoom'], v => h(C.PanZoom, { value: { x: v, y: 0, scale: 1 } }, h('div', null, `Pan ${v}`)), 'Null DOM refs prevent native gesture engine geometry and transforms.'),
    repeated('media-radar', ['Radar'], v => h(C.Radar, { axes, series: series[v], label: `Radar ${v}`, showTable: true })),
    repeated('media-sparkline', ['Sparkline'], v => h(C.Sparkline, { data: v ? [1, 3, 2, 5] : [1, 3, 2, 4], label: `Spark ${v}` })),
    repeated('media-typewriter', ['Typewriter'], v => h(C.Typewriter, { paused: true }, `Hello ${v}`), 'Paused full grapheme tree; timed reveal not exercised.'),
  ];
  // Browser-dependent effects were verified with a size-one smoke, not hidden by DOM mocks.
  const ssrReasons = {
    'controls-color-picker': 'Slider effects require HTMLFormElement.',
    'controls-editable': 'Editor focus effect requires requestAnimationFrame.',
    'controls-textarea': 'Resize cleanup requires cancelAnimationFrame.',
    'controls-input-number': 'Input-number effects require window/document globals in the built package.',
    'controls-range-slider': 'Slider form integration requires HTMLFormElement.',
    'controls-slider': 'Slider form integration requires HTMLFormElement.',
    'controls-time-picker': 'Picker effects require document.',
    'media-audio-player': 'Default slider/select controls require HTMLFormElement and window.',
    'media-carousel': 'Carousel lifecycle requires window.',
    'media-image-cropper': 'Default zoom slider requires HTMLFormElement.',
  };
  for (const fixture of result) if (ssrReasons[fixture.id]) {
    fixture.mode = 'ssr';
    fixture.notes += ` SSR only: ${ssrReasons[fixture.id]} Server render does not measure client mount, effects, update reconciliation or cleanup.`;
  }
  // Untimed evidence checks: these validate actual descendant output, not a component wrapper.
  const ssrMarkers = {
    'controls-color-picker': ['inkra-color-picker__native', 'inkra-color-picker__preset', 'type="color"', 'role="slider"'],
    'controls-editable': ['inkra-editable__editor', '<input', 'inkra-editable__actions'],
    'controls-textarea': ['<textarea', 'inkra-textarea', 'Text '],
    'controls-input-number': ['inkra-input-number__controls', '<input', 'Increase value', 'Decrease value'],
    'controls-range-slider': ['inkra-slider__track', 'role="slider"', 'aria-label="Minimum value"', 'aria-label="Maximum value"'],
    'controls-slider': ['inkra-slider__track', 'role="slider"', 'aria-label="Value"'],
    'controls-time-picker': ['inkra-time-picker__trigger', 'inkra-time-picker__native', '<input'],
    'media-audio-player': ['<audio', 'inkra-audio-player__controls', 'inkra-audio-player__seek', 'role="slider"'],
    'media-carousel': ['inkra-carousel__viewport', 'inkra-carousel__slide', 'Second slide', 'inkra-carousel__navigation'],
    'media-image-cropper': ['inkra-image-cropper__stage', 'inkra-image-cropper__state', 'inkra-image-cropper__controls', 'role="slider"'],
    'media-journey-map': ['inkra-journey-map__host', 'inkra-journey-map__places', 'Place ', 'Synthetic benchmark'],
    'media-node-graph-root': ['inkra-node-graph__ssr', '<ul><li>Node '],
    'media-node-graph-port': ['react-flow__node-fixture', 'data-nodeid="port-node"', 'data-handleid="out"', 'inkra-node-graph__port-visual', 'inkra-node-graph__port-feedback', 'inkra-node-graph__port-mark', 'aria-label="Port '],
  };
  for (const fixture of result) if (fixture.mode === 'ssr') {
    const markers = ssrMarkers[fixture.id];
    if (!markers) throw new Error(`Missing SSR evidence contract: ${fixture.id}`);
    fixture.verifySsr = html => {
      for (const marker of markers) if (!html.includes(marker)) {
        throw new Error(`${fixture.id}: SSR coverage evidence missing ${JSON.stringify(marker)}`);
      }
    };
  }
  result.find(f => f.id === 'controls-time-picker').notes += ' Closed trigger/native-value shell only; popup option list is not rendered.';
  return result;
}
