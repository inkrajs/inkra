import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const accordion = readFileSync(new URL('../src/accordion/Accordion.tsx', import.meta.url), 'utf8');
const index = readFileSync(new URL('../src/accordion/index.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/accordion/styles.css', import.meta.url), 'utf8');

test('Accordion exposes the complete Radix-backed compound API', () => {
  for (const name of [
    'AccordionRoot',
    'AccordionItem',
    'AccordionHeader',
    'AccordionTrigger',
    'AccordionContent',
  ]) {
    assert.match(index, new RegExp(`\\b${name}\\b`));
  }

  assert.match(accordion, /from '@radix-ui\/react-accordion'/);
  assert.match(accordion, /Object\.freeze\(\{[\s\S]*?Root: AccordionRoot[\s\S]*?Content: AccordionContent/);
  assert.doesNotMatch(accordion, /addEventListener\(['"](?:keydown|click|pointerdown)/);
});

test('Accordion delegates single, multiple, disabled and keyboard behavior to Radix semantics', () => {
  assert.match(accordion, /AccordionPrimitive\.AccordionSingleProps/);
  assert.match(accordion, /AccordionPrimitive\.AccordionMultipleProps/);
  assert.match(accordion, /<AccordionPrimitive\.Root/);
  assert.match(accordion, /<AccordionPrimitive\.Item/);
  assert.match(accordion, /<AccordionPrimitive\.Header/);
  assert.match(accordion, /<AccordionPrimitive\.Trigger/);
  assert.match(accordion, /<AccordionPrimitive\.Content/);
  assert.doesNotMatch(accordion, /role=['"](?:button|heading|region)['"]/);
  assert.doesNotMatch(accordion, /MutationObserver|addEventListener\(['"](?:keydown|click|pointerdown)/);
});

test('Accordion uses pencil decoration without intercepting trigger input', () => {
  assert.match(accordion, /<PencilLine[\s\S]*?orientation=\{orientation === 'horizontal' \? 'vertical' : 'horizontal'\}/);
  assert.match(accordion, /<PencilIcon[\s\S]*?paths=\{chevronDownPaths\}/);
  assert.match(accordion, /<PencilSurface<'span'>[\s\S]*?className="inkra-accordion__focus-ring"/);
  assert.match(accordion, /typeof children === 'string'[\s\S]*?<PencilText/);
  assert.doesNotMatch(accordion, /lucide/i);
  assert.match(styles, /\.inkra-accordion__divider\s*\{[\s\S]*?pointer-events: none/);
  assert.match(styles, /\.inkra-accordion__trigger-icon\s*\{[\s\S]*?pointer-events: none/);
});

test('Accordion styling keeps stable targets and accessible motion and color fallbacks', () => {
  const normalStyles = styles.slice(0, styles.indexOf('@media (forced-colors: active)'));
  assert.match(styles, /\.inkra-accordion__trigger\s*\{[\s\S]*?min-height: var\(--inkra-touch-target\)/);
  assert.match(styles, /--radix-accordion-content-height/);
  assert.match(styles, /--radix-accordion-content-width/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*?animation: none !important/);
  assert.match(styles, /forced-colors: active[\s\S]*?outline: var\(--inkra-focus-width\) solid Highlight/);
  assert.match(styles, /\.inkra-pencil-surface\.inkra-accordion__focus-ring\s*\{\s*display: none !important/);
  assert.match(styles, /\.inkra-accordion__content\[data-state="closed"\][\s\S]*animation:[^;]*both[\s\S]*height: 0/);
  assert.match(styles, /\.inkra-accordion__content-body\.inkra-accordion__content\[data-state="closed"\]\s*\{\s*padding: 0/);
  assert.match(styles, /horizontal[^}]*\.inkra-accordion__content\[data-state="closed"\][\s\S]*width: 0/);
  assert.match(styles, /\.inkra-accordion__focus-ring[\s\S]*inset: var\(--inkra-focus-width\)/);
  assert.match(styles, /outline-offset: calc\(-1 \* var\(--inkra-focus-width\)\)/);
  assert.doesNotMatch(normalStyles, /border(?:-\w+)?:\s*[^;]*solid/);
});
