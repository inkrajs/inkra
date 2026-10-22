import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const component = readFileSync(new URL('../src/hover-card/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/hover-card/styles.css', import.meta.url), 'utf8');
let built = null;
try {
  built = await import('../dist/index.js');
} catch (error) {
  if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

test('HoverCard composes the existing Popover positioning and semantic primitives', () => {
  assert.match(component, /from '\.\.\/overlay\/index\.js'/);
  assert.match(component, /<Popover\.Root[\s\S]*?modal=\{false\}/);
  assert.match(component, /<Popover\.Trigger/);
  assert.match(component, /<Popover\.Portal>[\s\S]*?<Popover\.Content/);
  assert.match(component, /HoverCardTitle = PopoverTitle/);
  assert.match(component, /HoverCardDescription = PopoverDescription/);
  assert.match(component, /HoverCardClose = PopoverClose/);
  assert.doesNotMatch(component, /@radix-ui\/react-(?:hover-card|popover)|floating-ui|computePosition/);
  assert.doesNotMatch(component, /tooltip/i);
});

test('HoverCard supports controlled state and cancellable open and close delays', () => {
  assert.match(component, /openDelay = 700/);
  assert.match(component, /closeDelay = 300/);
  assert.match(component, /const controlled = open !== undefined/);
  assert.match(component, /controlled \? open : uncontrolledOpen/);
  assert.match(component, /timerRef = useRef<ReturnType<typeof setTimeout>/);
  assert.match(component, /Math\.max\(0, delay\)/);
  assert.match(component, /scheduleClose: \(\) => schedule\(false, closeDelay, 'programmatic'\)/);
  assert.match(component, /scheduleOpen: reason => schedule\(true, openDelay, reason\)/);
  assert.match(component, /useEffect\(\(\) => cancelPending, \[\]\)/);
  assert.match(component, /onOpenChange=\{commitOpen\}/);
});

test('HoverCard bridges trigger and content hover, focus, press and Escape behavior through Popover', () => {
  assert.match(component, /onPointerEnter=\{event => \{[\s\S]*?event\.pointerType !== 'touch'[\s\S]*?context\.scheduleOpen\('hover'\)/);
  assert.match(component, /onPointerLeave=\{event => \{[\s\S]*?context\.scheduleClose\(\)/);
  assert.match(component, /onFocus=\{event => \{[\s\S]*?context\.scheduleOpen\('focus'\)/);
  assert.match(component, /onBlur=\{event => \{[\s\S]*?context\.scheduleClose\(\)/);
  assert.match(component, /HoverCard\.Trigger[\s\S]*?Popover\.Trigger|Popover\.Trigger/);
  assert.match(component, /onPointerDown=\{event => \{[\s\S]*?context\.cancelPending\(\)/);
  assert.match(component, /onClick=\{event => \{[\s\S]*?context\.markExplicitOpen\(\)/);
  assert.match(component, /HoverCardFocusOnOpen = 'always' \| 'focus-and-press' \| 'never' \| 'press'/);
  assert.match(component, /focusOnOpen = 'press'/);
  assert.match(component, /context\.getOpenReason\(\)/);
  assert.match(component, /reason === 'focus' \|\| reason === 'press'/);
  assert.match(component, /if \(!shouldFocus\) event\.preventDefault\(\)/);
  assert.doesNotMatch(component, /addEventListener\(['"](?:mouseenter|mouseleave|focus|blur|keydown)/);
});

test('HoverCard defaults to collision-aware placement and responsive pencil-surface sizing', () => {
  assert.match(component, /avoidCollisions = true/);
  assert.match(component, /collisionPadding = 16/);
  assert.match(component, /sideOffset = 8/);
  assert.match(styles, /--radix-popover-content-available-height/);
  assert.match(styles, /max-width: min\(22rem, calc\(100vw - var\(--inkra-space-4\)\)\)/);
  assert.match(styles, /@media \(max-width: 30rem\)/);
  assert.match(styles, /overflow-wrap: anywhere/);
  assert.match(styles, /@media print[\s\S]*?display: none/);
});

test('built HoverCard keeps SSR-readable trigger semantics after integration', {
  skip: typeof built?.HoverCard === 'undefined' && 'pending integration export and package build',
}, () => {
  const { HoverCard } = built;
  const html = renderToStaticMarkup(h(HoverCard.Root, null,
    h(HoverCard.Trigger, { asChild: true }, h('button', { type: 'button' }, 'Author details')),
    h(HoverCard.Content, null,
      h(HoverCard.Title, null, 'Mina Chen'),
      h(HoverCard.Description, null, 'Illustrator'))));
  assert.match(html, /<button[^>]*type="button"/);
  assert.match(html, /Author details/);
});
