import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

// The fixture resolves inkra and React inside the clean tarball consumer, not this workspace.
export async function checkHydration(directory) {
  await cp(new URL('./fixtures/hydration-app.mjs', import.meta.url), join(directory, 'app.mjs'));
  const markup = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { createElement, StrictMode } from 'react';
    import { renderToString } from 'react-dom/server';
    import { App } from './app.mjs';
    const warnings = [];
    console.error = (...args) => {
      const message = args.join(' ');
      // DayPicker 9 emits this known React 18 development-only server warning.
      if (message.startsWith('Warning: useLayoutEffect does nothing on the server') && message.split('\\n')[1]?.trim().startsWith('at DayPicker (')) {
        warnings.push(message);
        return;
      }
      throw new Error(message);
    };
    console.warn = console.error;
    process.stdout.write(renderToString(createElement(StrictMode, null, createElement(App))));
    if (warnings.length) process.stderr.write('Known DayPicker React 18 SSR layout-effect warning: ' + warnings.length + '\\n');
  `], { cwd: directory, encoding: 'utf8', timeout: 30000 });
  assert.match(markup, /Inkra hydration/);
  assert.match(markup, /Auckland/);
  await writeFile(join(directory, 'index.html'), `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root">${markup}</div><script type="module" src="/client.mjs"></script></body></html>`);
  await writeFile(join(directory, 'client.mjs'), `
    import { createElement, StrictMode } from 'react';
    import { hydrateRoot } from 'react-dom/client';
    import { App } from './app.mjs';
    import '@inkra/react/styles.css';
    hydrateRoot(document.getElementById('root'), createElement(StrictMode, null, createElement(App)), {
      onRecoverableError: error => { console.error('Hydration failed:', error.message); }
    });
  `);
  const { createServer } = await import(pathToFileURL(join(directory, 'node_modules/vite/dist/node/index.js')).href);
  const server = await createServer({ root: directory, configFile: false, server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const url = `http://127.0.0.1:${server.httpServer.address().port}`;
    for (const width of [1305, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 954 } });
      page.setDefaultTimeout(20000);
      const failures = [];
      page.on('pageerror', error => failures.push(error.message));
      page.on('console', message => { if (['warning', 'error'].includes(message.type())) failures.push(message.text()); });
      await page.goto(url);
      console.log(`Hydration fixture loaded at ${width}px`);
      await page.waitForSelector('html[data-hydrated="true"]');
      await page.getByRole('button', { name: 'Count 0', exact: true }).click();
      await page.getByRole('button', { name: 'Count 1', exact: true }).waitFor();
      await page.getByLabel('Name', { exact: true }).fill('Edited');
      await page.getByRole('button', { name: 'Increase value', exact: true }).click();
      assert.equal(await page.getByLabel('Quantity', { exact: true }).inputValue(), '3');
      await page.getByRole('combobox', { name: 'Visibility' }).click();
      await page.getByRole('option', { name: 'Team', exact: true }).click();
      assert.match(await page.getByRole('combobox', { name: 'Visibility' }).innerText(), /Team/);
      await page.getByRole('tab', { name: 'Two', exact: true }).click();
      assert.equal(await page.getByRole('tabpanel').innerText(), 'Second panel');
      await page.getByRole('button', { name: 'Edit note', exact: true }).click();
      await page.getByRole('dialog', { name: 'Note', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      console.log(`Hydrated controls and portal exercised at ${width}px`);
      await page.waitForFunction(() => document.activeElement?.textContent === 'Edit note');
      await page.waitForFunction(() => document.querySelector('.inkra-journey-map__ink')?.width > 0);
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
      // Clear a painted canvas and simulate a browser context-restoration notification.
      await page.locator('#title').scrollIntoViewIfNeeded();
      await page.waitForSelector('#title[data-pencil-ready="true"]');
      const before = await page.locator('#title canvas').evaluate(canvas => {
        const image = canvas.toDataURL();
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        canvas.dispatchEvent(new Event('contextrestored', { bubbles: true }));
        return image;
      });
      await page.waitForFunction(image => document.querySelector('#title canvas')?.toDataURL() === image, before);
      assert.deepEqual(failures, [], `Browser errors at ${width}px`);
      await page.close();
    }
    const fallback = await browser.newPage();
    fallback.setDefaultTimeout(20000);
    await fallback.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type === '2d' ? null : original.call(this, type, ...args); };
    });
    await fallback.goto(url);
    await fallback.waitForSelector('html[data-hydrated="true"]');
    await fallback.getByRole('button', { name: 'Count 0', exact: true }).click();
    await fallback.getByRole('button', { name: 'Count 1', exact: true }).waitFor();
    assert.equal(await fallback.locator('#title').getAttribute('data-pencil-ready'), null);
    assert.equal(await fallback.locator('#title .inkra-pencil-text__source').isVisible(), true);
    await fallback.close();
    console.log('Installed-package SSR/hydration, controls, portals, lazy map and canvas recovery passed.');
  } finally {
    await browser?.close();
    await server.close();
  }
}
