import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import ts from 'typescript';

// Exercise the actual source renderer without requiring or replacing a package
// build. The bundled font files make glyph coverage independent of system fonts.
const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const compile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020,
} }).outputText;
const dependencies = {};
for (const name of ['cache', 'random']) {
  dependencies[name] = moduleUrl(compile(await readFile(new URL(`../src/internal/${name}.ts`, import.meta.url), 'utf8')));
}
let renderer = compile(await readFile(new URL('../src/internal/textRenderer.ts', import.meta.url), 'utf8'));
for (const [name, url] of Object.entries(dependencies)) renderer = renderer.replace(`'./${name}.js'`, JSON.stringify(url));
const rendererUrl = moduleUrl(renderer);
const fonts = await Promise.all(['ui-hand-xiaolai', 'ui-hand-xiaolai-extended'].map(async name =>
  (await readFile(new URL(`../src/assets/${name}.woff2`, import.meta.url))).toString('base64')));

const browser = await chromium.launch();
try {
  for (const segmenterAvailable of [true, false]) {
    const page = await browser.newPage();
    const result = await page.evaluate(async ({ rendererUrl, fonts, segmenterAvailable }) => {
      const NativeSegmenter = Intl.Segmenter;
      if (!segmenterAvailable) Intl.Segmenter = undefined;
      for (const [index, bytes] of fonts.entries()) {
        const face = new FontFace(`GraphemeFixture${index}`, `url(data:font/woff2;base64,${bytes})`);
        await face.load(); document.fonts.add(face);
      }
      const { renderPencilText } = await import(rendererUrl);
      const assert = (condition, message) => { if (!condition) throw new Error(message); };
      const cases = [
        { language: 'French', text: 'Été à Noël, cœur léger.', font: 0 },
        { language: 'Japanese', text: 'がぎぐげご、ぱぴぷぺぽ。', font: 0 },
        { language: 'Korean', text: '한글', font: 1 },
      ];
      const report = [];
      for (const item of cases) {
        const options = { size: 22, color: '#315044', seed: 719, dpr: 1, cache: false, family: `GraphemeFixture${item.font}` };
        const precomposed = item.text.normalize('NFC');
        const decomposed = item.text.normalize('NFD');
        assert(precomposed !== decomposed, item.language + ' fixture must contain a composition');
        const first = renderPencilText(precomposed, options);
        const second = renderPencilText(decomposed, options);
        assert(first.advance === second.advance, item.language + ' canonical advance');
        assert(first.ink.toDataURL() === second.ink.toDataURL(), item.language + ' canonical pixels');
        const pixels = first.ink.getContext('2d').getImageData(0, 0, first.ink.width, first.ink.height).data;
        assert(pixels.some((value, offset) => offset % 4 === 3 && value > 0), item.language + ' must draw ink');
        const native = document.createElement('canvas').getContext('2d');
        native.font = `normal 400 22px ${options.family}`; native.fontKerning = 'none';
        assert(Math.ceil(native.measureText(precomposed).width) === first.advance, item.language + ' native advance');

        // Check the code-point Range measurements used by PencilText: a browser
        // must keep every member of a combining cluster on the same visual line.
        for (const width of [14, 29, 57, 113]) {
          const element = document.createElement('span');
          element.style.cssText = `display:block;width:${width}px;font:22px ${options.family};line-height:1.5;word-break:break-all;`;
          element.textContent = decomposed; document.body.append(element);
          const range = document.createRange();
          let offset = 0;
          for (const { segment } of new NativeSegmenter(undefined, { granularity: 'grapheme' }).segment(decomposed)) {
            const tops = [];
            for (const character of segment) {
              range.setStart(element.firstChild, offset); offset += character.length;
              range.setEnd(element.firstChild, offset); tops.push(range.getBoundingClientRect().top);
            }
            assert(Math.max(...tops) - Math.min(...tops) <= 1, item.language + ' Range must not split a combining cluster');
          }
          assert(element.textContent === decomposed, 'the selectable source remains unchanged');
          element.remove();
        }
        report.push({ language: item.language, advance: first.advance, samePixels: true });
      }

      // q + acute has no NFC precomposed form: this checks real grapheme grouping
      // rather than merely relying on canonical composition for the three scripts.
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      const calls = [];
      CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
        calls.push(text); return fillText.call(this, text, ...args);
      };
      try {
        renderPencilText('q\u0301x', { size: 22, color: '#315044', seed: 21, dpr: 1, cache: false, family: 'GraphemeFixture0' });
      } finally { CanvasRenderingContext2D.prototype.fillText = fillText; }
      assert(JSON.stringify(calls) === JSON.stringify(segmenterAvailable ? ['q\u0301', 'x'] : ['q\u0301x']), 'uncomposed marks retain their base glyph');

      const asciiOptions = { size: 20, color: '#315044', seed: 43, glyphSeed: 137, dpr: 1, family: 'GraphemeFixture0' };
      const cached = renderPencilText('Save', asciiOptions);
      assert(renderPencilText('Save', asciiOptions) === cached, 'ASCII sprite cache stays active');
      return { segmenterAvailable, report, asciiCache: true, combiningFallback: true };
    }, { rendererUrl, fonts, segmenterAvailable });
    assert.equal(result.report.length, 3);
    console.log(JSON.stringify(result));
    await page.close();
  }
  console.log('Text graphemes: canonical advance/pixels, combining marks, native line ranges and ASCII cache passed.');
} finally {
  await browser.close();
}
