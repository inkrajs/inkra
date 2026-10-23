// Validate the component-by-component performance audit against the built public API.
// This is a point-in-time review ledger, not a claim of browser or crash acceptance.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import * as api from '../packages/inkra/dist/index.js';

const publicApi = JSON.parse(readFileSync(new URL('../docs/performance-public-api.json', import.meta.url), 'utf8'));
assert.deepEqual(Object.keys(api).sort(), publicApi.exports, 'Public runtime exports changed since the audited baseline');
const groups = ['lead', 'controls', 'collections', 'media'];
const components = groups.flatMap(group => {
  const file = new URL(`../docs/performance-audit-${group}.json`, import.meta.url);
  const audit = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(audit)) assert.equal(audit.baseline, '7bd08e47b05c9d61a226bbbfd3d5d620ce93962a');
  return (Array.isArray(audit) ? audit : audit.components).map(row => ({ ...row, group }));
});
const actual = new Map();
const add = (name, value) => {
  if (!value || !(typeof value === 'function' || typeof value === 'object' && value.$$typeof)) return;
  if (!actual.has(value)) actual.set(value, []);
  actual.get(value).push(name);
};
for (const [name, value] of Object.entries(api)) {
  if (!/^[A-Z][a-z]/.test(name) || name.endsWith('Error')) continue;
  add(name, value);
  if (value && typeof value === 'object') {
    for (const [member, child] of Object.entries(value)) {
      if (/^[A-Z][a-z]/.test(member)) add(`${name}.${member}`, child);
    }
  }
}
const reviewed = new Set();
for (const row of components) {
  const component = row.component.split('.').reduce((value, key) => value?.[key], api);
  assert(actual.has(component), `Unknown public component ${row.component}`);
  assert(!reviewed.has(component), `Duplicate component identity ${row.component}`);
  reviewed.add(component);
  assert.deepEqual([...row.aliases].sort(), actual.get(component).sort(), `Missing reexport aliases for ${row.component}`);
  assert(row.status && row.status !== 'pending', `Pending review ${row.component}`);
  assert(row.findings.length && row.verification.length && row.disposition, `Missing audit evidence ${row.component}`);
  assert(existsSync(new URL(`../${row.source}`, import.meta.url)), `Missing implementation ${row.component}`);
}
for (const [component, aliases] of actual) assert(reviewed.has(component), `Unaudited public component ${aliases.join(', ')}`);
const summary = { total: components.length, byGroup: Object.fromEntries(groups.map(group => [group, components.filter(row => row.group === group).length])) };
if (process.argv.includes('--json')) console.log(JSON.stringify({ baseline: '7bd08e47b05c9d61a226bbbfd3d5d620ce93962a', summary, components }, null, 2));
else console.log(`Audit coverage verified: ${JSON.stringify(summary)}. Browser acceptance remains open.`);
