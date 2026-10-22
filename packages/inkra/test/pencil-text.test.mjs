import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/PencilText.tsx', import.meta.url), 'utf8');

test('PencilText measures paint geometry in local layout coordinates', () => {
  assert.match(source, /function localBorderBox/);
  assert.match(source, /computedWidth \+ \(style\.boxSizing === 'border-box' \? 0 : horizontalExtras\)/);
  assert.match(source, /computedHeight \+ \(style\.boxSizing === 'border-box' \? 0 : verticalExtras\)/);
  assert.match(source, /function measureLocalTextLines/);
  assert.match(source, /copyComputedStyle\(computed, probe\.style\)/);
  assert.match(source, /copyComputedStyle\(sourceComputed, source\.style\)/);
  assert.match(source, /probe\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(source, /probe\.inert = true/);
  assert.match(source, /height: `\$\{height\}px`/);
  assert.match(source, /minHeight: `\$\{height\}px`/);
  assert.match(source, /maxHeight: `\$\{height\}px`/);
  assert.match(source, /transform: 'none'/);
  assert.match(source, /rotate: 'none'/);
  assert.match(source, /scale: 'none'/);
  assert.match(source, /rectangle\.left - box\.left/);
  assert.match(source, /rectangle\.top - box\.top/);
  assert.match(source, /localBox\.width, localBox\.height/);
  assert.match(source, /finally \{\s*probe\.remove\(\)/);
  assert.doesNotMatch(source, /const box = element\.getBoundingClientRect\(\);[\s\S]{0,240}canvas\.width/);
});
