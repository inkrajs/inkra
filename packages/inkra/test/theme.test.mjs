import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup as render } from 'react-dom/server';
import { ThemeProvider } from '../dist/theme/index.js';

test('theme scope renders SSR-safe attributes, CSS variables and semantic children', () => {
  const html = render(h(ThemeProvider, { theme: 'auto', id: 'scope', dir: 'rtl', lang: 'fr', className: 'custom',
    tokens: { '--inkra-accent': '#4b96aa', '--inkra-icon-stroke-width': '1.5px', '--inkra-icon-intensity': 0 },
  }, h('button', null, 'Save')));
  assert.match(html, /data-inkra-theme="auto"/);
  assert.match(html, /class="inkra-theme-provider custom"/);
  assert.match(html, /dir="rtl" lang="fr"/);
  assert.match(html, /--inkra-icon-intensity:0/);
  assert.match(html, /--inkra-icon-stroke-width:1.5px/);
  assert.match(html, /<button>Save<\/button>/);
});

test('omitted mode inherits, explicit nested mode remains scoped, invalid tokens are ignored', () => {
  const html = render(h(ThemeProvider, { theme: 'dark', tokens: { '--inkra-accent': 'red' } },
    h(ThemeProvider, { tokens: { '--inkra-icon-intensity': 0.5 } }, 'Inherited'),
    h(ThemeProvider, { theme: 'light' }, 'Light')));
  assert.equal((html.match(/data-inkra-theme=/g) ?? []).length, 2);
  const filtered = render(h(ThemeProvider, { tokens: {
    color: 'red', '--other': 'blue', '--inkra-invalid': NaN, '--inkra-empty': undefined,
    '--inkra-accent': 'red',
  }, style: { '--inkra-accent': 'blue', padding: 4 } }));
  assert.doesNotMatch(filtered, /--other|--inkra-invalid|--inkra-empty|color:red/);
  assert.match(filtered, /--inkra-accent:blue/);
  assert.match(filtered, /padding:4px/);
});
