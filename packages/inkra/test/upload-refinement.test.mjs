import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/upload/index.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/upload/styles.css', import.meta.url), 'utf8');

test('Upload exposes one picker tab stop and a pencil focus surface', () => {
  assert.match(source, /aria-hidden="true"\s+ref=\{inputRef\}/);
  assert.match(source, /disabled=\{disabled\}\s+tabIndex=\{-1\}/);
  assert.match(source, /className="inkra-upload__dropzone"/);
  assert.match(source, /role="button"\s+aria-label=\{ariaLabel\}/);
  assert.match(source, /tabIndex=\{disabled \? -1 : 0\}/);
  assert.match(source, /className="inkra-upload__focus-ring"/);
  assert.match(source, /variant="outline"/);
  assert.match(styles, /\.inkra-upload__focus-ring \{\s*--inkra-accent-strong: var\(--inkra-focus\)/);
  assert.match(styles, /position: absolute !important; inset: var\(--inkra-focus-width\)/);
  assert.doesNotMatch(styles, /\.inkra-upload__focus-ring \{[^}]*inset:\s*calc\(-1/s);
  assert.match(styles, /\.inkra-upload__dropzone:focus-visible \.inkra-upload__focus-ring \{ opacity: 1; \}/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /\.inkra-upload__dropzone:focus-visible \{ outline: 2px solid Highlight/);
  assert.match(styles, /\.inkra-upload__focus-ring \{ display: none !important; \}/);
});

test('Upload clears drag state when disabled and retains drag/drop guards', () => {
  assert.match(source, /useEffect\(\(\) => \{\s*if \(disabled\) setDragActive\(false\);\s*\}, \[disabled\]\)/);
  assert.match(source, /onDragEnter=\{event => \{ event\.preventDefault\(\); if \(!disabled\) setDragActive\(true\); \}\}/);
  assert.match(source, /onDragLeave=\{event => \{ if \(!event\.currentTarget\.contains\(event\.relatedTarget as Node \| null\)\) setDragActive\(false\); \}\}/);
  assert.match(source, /const handleDrop = \(event: DragEvent<HTMLDivElement>\) => \{\s*event\.preventDefault\(\);\s*setDragActive\(false\)/);
});

test('Upload uses container-responsive file actions and pencil text truncation', () => {
  assert.match(source, /<PencilText className="inkra-upload__name" ellipsis>\{item\.file\.name\}<\/PencilText>/);
  assert.match(styles, /container-type:\s*inline-size/);
  assert.match(styles, /@container \(max-width: 36rem\)/);
  assert.match(styles, /@container \(max-width: 24rem\)/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(styles, /\.inkra-upload__actions > \.inkra-button \{ inline-size: 100%; \}/);
  assert.match(styles, /\.inkra-upload__actions \.inkra-button__label \{[^}]*text-overflow: ellipsis/s);
  assert.match(styles, /\.inkra-upload__actions \.inkra-button__label > \.inkra-pencil-text > \.inkra-pencil-text__source \{[^}]*text-overflow: ellipsis/s);
});

test('Upload async work ignores cancellation, removal, unmount and stale request tokens', () => {
  assert.match(source, /controllers = useRef\(new Map<string, \{ controller: AbortController; token: symbol \}>\(\)\)/);
  assert.match(source, /if \(!mounted\.current \|\| controller\.signal\.aborted\) return undefined/);
  assert.match(source, /if \(!active \|\| active\.token !== token \|\| controller\.signal\.aborted\) return/);
  assert.match(source, /controllers\.current\.forEach\(active => active\.controller\.abort\(\)\)/);
  assert.match(source, /if \(!activeIds\.has\(id\)\) \{\s*active\.controller\.abort\(\)/);
});
