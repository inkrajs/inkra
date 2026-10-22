import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Export the docs' actual BrandMark geometry, not an enlarged favicon.
// Run with the local docs Vite server available at INKRA_DOCS_URL.
const origin = process.env.INKRA_DOCS_URL || 'http://127.0.0.1:4180';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 2 });
  await page.goto(origin + '/blog');
  await page.evaluate(async () => {
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { BrandMark } = await import('/src/components/BrandMark.tsx');
    const host = document.createElement('div');
    host.id = 'brand-export';
    host.style.cssText = 'position:fixed;inset:0;z-index:9999;--inkra-stroke-width:1.2;--inkra-stroke-amplitude:0.6';
    document.body.append(host);
    ReactDOM.createRoot(host).render(React.createElement('div', null,
      ...['#173b2b', '#e6e9e7'].map((color, index) =>
        React.createElement('div', { key: color, id: 'brand-export-' + index, style: { color } },
          React.createElement(BrandMark, { size: 256 }))),
    ));
  });
  for (const [index, filename] of ['inkra.png', 'inkra-dark.png'].entries()) {
    const selector = '#brand-export-' + index + ' canvas';
    await page.waitForFunction(selector => {
      const canvas = document.querySelector(selector);
      return canvas?.width === 512 && canvas.getContext('2d')
        .getImageData(0, 0, canvas.width, canvas.height).data.some((value, i) => i % 4 === 3 && value > 0);
    }, selector);
    const result = await page.locator(selector).evaluate(canvas => {
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let painted = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) painted++;
      return { width: canvas.width, height: canvas.height, painted, transparentCorner: data[3] === 0,
        png: canvas.toDataURL('image/png').split(',')[1] };
    });
    assert.equal(result.width, 512);
    assert.equal(result.height, 512);
    assert(result.painted > 2500 && result.painted < 256 * 256);
    assert(result.transparentCorner);
    await writeFile(new URL('../assets/' + filename, import.meta.url), Buffer.from(result.png, 'base64'));
    console.log('Exported ' + filename + ': 512x512, transparent, original BrandMark paths');
  }
} finally {
  await browser.close();
}
