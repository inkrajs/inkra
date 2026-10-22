import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as Inkra from '../dist/index.js';

const components = {
  Toast: 'toast', Empty: 'empty', ToggleGroup: 'toggle-group',
  AlertDialog: 'alert-dialog', Drawer: 'drawer', DatePicker: 'date-picker',
  TimePicker: 'time-picker', Pagination: 'pagination', Command: 'command',
  DataTable: 'data-table', Tree: 'tree', Upload: 'upload', Steps: 'steps', Timeline: 'timeline',
};

test('all fourteen expansion components are public exports with packaged styles and types', async () => {
  const css = await readFile(new URL('../dist/styles.css', import.meta.url), 'utf8');
  for (const [name, directory] of Object.entries(components)) {
    assert.ok(Inkra[name], `Missing public component: ${name}`);
    assert.ok(css.includes(`.inkra-${directory}`), `Missing packaged styles: ${name}`);
    assert.ok((await readFile(new URL(`../dist/${directory}/index.d.ts`, import.meta.url), 'utf8')).includes(name));
  }
});
