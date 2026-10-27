import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Read source directly so this regression does not require a build or dev server.
const tokens = await readFile(new URL('../src/tokens.css', import.meta.url), 'utf8');
const fontTokens = ['hand', 'body', 'display', 'mono'].map((name) => `--inkra-font-${name}`);
const letterTokens = ['variation', 'breaks', 'outline', 'fill', 'grain'].map((name) => `--inkra-letter-${name}`);
const properties = [...fontTokens, ...letterTokens];
const defaults = ['0.1', '0.31', '0.44', '0.85', '0.4'];
const custom = Object.fromEntries([
  ...fontTokens.map((name) => [name, '"Custom Hand", cursive']),
  ...letterTokens.map((name, index) => [name, String((index + 1) / 10)]),
]);
const selectors = ['data-theme', 'data-inkra-theme'].flatMap((attribute) =>
  ['light', 'dark', 'auto'].map((theme) => `[${attribute}="${theme}"]`),
);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ colorScheme: 'light' });
  await page.setContent(`<style>${tokens}</style><main id="parent">${selectors.map((selector, index) =>
    `<section id="scope-${index}" ${selector.slice(1, -1)}><span>山水有相逢</span></section>`,
  ).join('')}</main>`);
  const read = (selector, names = properties) => page.locator(selector).evaluate((element, keys) => {
    const style = getComputedStyle(element);
    return Object.fromEntries(keys.map((key) => [key, style.getPropertyValue(key).trim()]));
  }, names);
  const set = (selector, values) => page.locator(selector).evaluate((element, entries) => {
    for (const [key, value] of Object.entries(entries)) element.style.setProperty(key, value);
  }, values);

  const rootDefaults = await read('html');
  assert.match(rootDefaults['--inkra-font-hand'], /Inkra Xiaolai/);
  assert.deepEqual(letterTokens.map((key) => rootDefaults[key]), defaults);
  await set('#parent', custom);
  for (const selector of selectors) {
    assert.deepEqual(await read(selector), custom, `${selector} inherits font and lettering`);
    assert.deepEqual(await read(`${selector} span`), custom, `${selector} descendants inherit`);
  }
  assert.notEqual((await read('#scope-0', ['--inkra-paper']))['--inkra-paper'],
    (await read('#scope-1', ['--inkra-paper']))['--inkra-paper'], 'Light and dark retain independent colors');

  const updated = { ...custom, '--inkra-font-hand': '"Another Hand", serif', '--inkra-letter-outline': '0.93' };
  await set('#parent', updated);
  for (const selector of selectors) assert.deepEqual(await read(selector), updated, `${selector} updates dynamically`);
  await set('#scope-0', { '--inkra-font-hand': 'monospace', '--inkra-letter-grain': '0.12' });
  assert.deepEqual(await read('#scope-0 span'), { ...updated, '--inkra-font-hand': 'monospace', '--inkra-letter-grain': '0.12' });
  assert.deepEqual(await read('#scope-1'), updated, 'Local overrides do not affect siblings');

  await page.emulateMedia({ colorScheme: 'dark' });
  for (const selector of selectors.slice(1)) assert.deepEqual(await read(selector), updated, `${selector} survives system dark mode`);
  await page.emulateMedia({ forcedColors: 'active' });
  assert.deepEqual(await read('#scope-1', ['--inkra-letter-breaks', '--inkra-letter-grain']), {
    '--inkra-letter-breaks': '0', '--inkra-letter-grain': '0',
  }, 'Forced colors retains reduced lettering effects');
  console.log('Theme font inheritance: passed (six theme scopes, dynamic updates, local overrides, system dark and forced colors).');
} finally {
  await browser.close();
}
