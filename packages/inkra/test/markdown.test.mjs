import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const sourceRoot = new URL('../src/', import.meta.url).href;
const source = readFileSync(new URL('../src/markdown/index.tsx', import.meta.url), 'utf8');
const codeSource = readFileSync(new URL('../src/markdown/CodeBlock.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/markdown/styles.css', import.meta.url), 'utf8');
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(sourceRoot) && specifier.startsWith('.') && specifier.endsWith('.js')) {
      const base = new URL(specifier.slice(0, -3), context.parentURL);
      for (const extension of ['.ts', '.tsx']) {
        const url = `${base.href}${extension}`;
        if (existsSync(fileURLToPath(url))) return { url, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(sourceRoot) && /\.tsx?$/.test(url)) {
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});
const { Markdown } = await import('../src/markdown/index.tsx');
hooks.deregister();

const completeMarkdown = `# Heading

Paragraph with **strong**, *emphasis*, ~~deleted~~, \`inline()\` and [documentation](/docs).

- Pencil item
  - Nested item
1. First step
2. Second step

- [x] Complete
- [ ] Pending

> Quoted guidance

| Name | Value |
| --- | ---: |
| Theme | Pencil |

\`\`\`tsx
const ready = true;
\`\`\`

![Preview](https://example.com/preview.png)

---`;

test('Markdown renders semantic selectable GFM with Inkra drawing primitives', () => {
  const html = renderToStaticMarkup(createElement(Markdown, {
    headingLevelOffset: 1,
    labels: {
      code: 'Example code',
      table: 'Feature comparison',
      taskChecked: 'Task complete',
      taskUnchecked: 'Task incomplete',
    },
  }, completeMarkdown));

  assert.match(html, /^<div class="inkra-markdown">/);
  assert.match(html, /<h2 class="inkra-markdown__heading">/);
  assert.match(html, /inkra-pencil-text__source">Heading<\/span>/);
  assert.match(html, /<strong>/);
  assert.match(html, /<em>/);
  assert.match(html, /<del(?:\s[^>]*)?>/);
  const inlineCode = html.match(/<code class="inkra-markdown__code" data-inline="true">([\s\S]*?)<\/code>/)?.[1] ?? '';
  assert.match(inlineCode, /inkra-markdown__code-wash/);
  assert.match(inlineCode, /inkra-markdown__code-text/);
  assert.ok(inlineCode.indexOf('inkra-markdown__code-wash') < inlineCode.indexOf('inkra-markdown__code-text'));
  assert.match(inlineCode, /inkra-pencil-text__source">inline\(\)<\/span>/);
  assert.match(html, /href="\/docs"/);
  assert.match(html, /inkra-markdown__link-line/);
  assert.match(html, /inkra-markdown__link-focus/);
  assert.match(html, /inkra-markdown__bullet/);
  assert.match(html, /<ol/);
  assert.match(html, /<label(?=[^>]*class="inkra-selection-control inkra-checkbox inkra-markdown__task-checkbox")(?=[^>]*data-checked="true")(?=[^>]*data-disabled="true")[^>]*>/);
  assert.match(html, /<input(?=[^>]*aria-label="Task complete")(?=[^>]*class="inkra-selection-control__input")(?=[^>]*disabled="")(?=[^>]*type="checkbox")(?=[^>]*checked="")[^>]*\/>/);
  assert.match(html, /inkra-selection-control__mark inkra-checkbox__mark/);
  assert.match(html, /<blockquote/);
  assert.match(html, /data-orientation="vertical"/);
  assert.match(html, /<div(?=[^>]*aria-label="Feature comparison")(?=[^>]*role="region")(?=[^>]*tabindex="0")/);
  assert.match(html, /inkra-markdown__table-focus/);
  assert.match(html, /<table/);
  assert.match(html, /<pre(?=[^>]*aria-label="Example code")(?=[^>]*class="inkra-markdown__code-surface")(?=[^>]*tabindex="0")/);
  assert.match(html, /inkra-markdown__code-focus/);
  assert.match(html, /language-tsx/);
  assert.match(html, /token-keyword/);
  assert.match(html, /token-operator/);
  assert.match(html, /token-boolean/);
  assert.match(html, /token-punctuation/);
  assert.match(html, /inkra-markdown__code-token/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /src="https:\/\/example.com\/preview.png"/);
  assert.match(html, /role="separator"/);
  assert.doesNotMatch(html, /dangerouslySetInnerHTML/);
});

test('Markdown keeps fenced and indented code inside labelled keyboard-reachable blocks', () => {
  const html = renderToStaticMarkup(createElement(Markdown, {
    labels: { code: 'Localized code block' },
  }, `\`\`\`
unlabelled(  value)
\tcontinued()
\`\`\`

    indented()
`));

  const blocks = [...html.matchAll(/<pre(?=[^>]*aria-label="Localized code block")(?=[^>]*class="inkra-markdown__code-surface")(?=[^>]*data-language="plain")(?=[^>]*tabindex="0")[^>]*><code class="inkra-markdown__code">([\s\S]*?)<\/code><\/pre>/g)];
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks.map(block => block[1].replace(/<[^>]+>/g, '')), [
    'unlabelled(  value)\n\tcontinued()\n',
    'indented()\n',
  ]);
  assert.equal([...html.matchAll(/inkra-markdown__code-token/g)].length, 3);
  assert.doesNotMatch(html, /inkra-markdown__code-text/);
  assert.doesNotMatch(html, /inkra-markdown__code-(?:inline|block)/);
});

test('Markdown preserves ordered starts and localizes native task-list state', () => {
  const html = renderToStaticMarkup(createElement(Markdown, {
    labels: {
      taskChecked: 'Finished item',
      taskUnchecked: 'Open item',
    },
  }, `4. Fourth
5. Fifth

- [x] Finished
- [ ] Open`));

  assert.match(html, /<ol(?=[^>]*class="inkra-markdown__list inkra-markdown__list--ordered")(?=[^>]*start="4")(?=[^>]*--inkra-markdown-ordered-marker-width:max\(1\.75rem, 2ch\))[^>]*>/);
  assert.match(html, /inkra-markdown__ordered-marker[^>]*>[\s\S]*inkra-pencil-text__source">4\.<\/span>/);
  assert.match(html, /inkra-markdown__ordered-marker[^>]*>[\s\S]*inkra-pencil-text__source">5\.<\/span>/);
  assert.match(html, /<input(?=[^>]*aria-label="Finished item")(?=[^>]*class="inkra-selection-control__input")(?=[^>]*disabled="")(?=[^>]*type="checkbox")(?=[^>]*checked="")[^>]*\/>/);
  assert.match(html, /<input(?=[^>]*aria-label="Open item")(?=[^>]*class="inkra-selection-control__input")(?=[^>]*disabled="")(?=[^>]*type="checkbox")(?![^>]*checked="")[^>]*\/>/);
  assert.equal([...html.matchAll(/inkra-markdown__task-checkbox/g)].length, 2);
});

test('code blocks use the shared card, language labels and localized copy action', () => {
  const html = renderToStaticMarkup(createElement(Markdown, {
    labels: { plainText: 'Unformatted source', copy: 'Copy this source' },
  }, ['```js\nconst value = 1;\n```', '```sh\necho hello\n```', '```\nplain\n```', '```custom-lang\nraw\n```'].join('\n\n')));
  assert.equal([...html.matchAll(/inkra-card inkra-markdown__code-frame/g)].length, 4);
  assert.equal([...html.matchAll(/inkra-card__header inkra-markdown__code-header/g)].length, 4);
  assert.equal([...html.matchAll(/aria-label="Copy this source"/g)].length, 4);
  for (const language of ['JavaScript', 'Bash', 'Unformatted source', 'custom-lang']) {
    assert(html.includes(`>${language}</span>`), `language header: ${language}`);
  }
  assert.equal([...html.matchAll(/role="status"/g)].length, 4);
});

test('Markdown keeps nested, non-1 and multi-digit ordered markers aligned with task prose', () => {
  const html = renderToStaticMarkup(createElement(Markdown, null, `7. [x] Ordered finished
8. Ordered plain with a longer body

    3. Nested third
    4. [ ] Nested task

- Plain mixed item
- [x] Mixed finished`));
  const multiDigitHtml = renderToStaticMarkup(createElement(Markdown, null, `12. Twelfth
13. Thirteenth`));
  const crossingHtml = renderToStaticMarkup(createElement(Markdown, null, `99. Ninety-nine
100. One hundred`));

  const startSeven = html.search(/<ol(?=[^>]*class="inkra-markdown__list inkra-markdown__list--ordered contains-task-list")(?=[^>]*start="7")/);
  const orderedTask = html.indexOf('class="inkra-markdown__list-item task-list-item"', startSeven);
  const orderedMarker = html.indexOf('inkra-markdown__ordered-marker', orderedTask);
  const orderedContent = html.indexOf('class="inkra-markdown__list-content"', orderedMarker);
  assert.ok(startSeven >= 0);
  assert.ok(orderedTask >= 0);
  assert.ok(orderedMarker > orderedTask);
  assert.ok(orderedContent > orderedMarker);
  assert.match(html, /<ol(?=[^>]*class="inkra-markdown__list inkra-markdown__list--ordered contains-task-list")(?=[^>]*start="3")/);
  for (const marker of ['7.', '8.', '3.', '4.']) {
    assert.match(html, new RegExp(`inkra-markdown__ordered-marker[^>]*>[\\s\\S]*?inkra-pencil-text__source">${marker.replace('.', '\\.')}</span>`));
  }
  assert.match(multiDigitHtml, /<ol(?=[^>]*class="inkra-markdown__list inkra-markdown__list--ordered")(?=[^>]*start="12")(?=[^>]*--inkra-markdown-ordered-marker-width:max\(1\.75rem, 3ch\))/);
  for (const marker of ['12.', '13.']) {
    assert.match(multiDigitHtml, new RegExp(`inkra-markdown__ordered-marker[^>]*>[\\s\\S]*?inkra-pencil-text__source">${marker.replace('.', '\\.')}</span>`));
  }
  assert.match(crossingHtml, /<ol(?=[^>]*start="99")(?=[^>]*style="--inkra-markdown-ordered-marker-width:max\(1\.75rem, 4ch\)")/);
  assert.match(crossingHtml, /inkra-pencil-text__source">99\.<\/span>/);
  assert.match(crossingHtml, /inkra-pencil-text__source">100\.<\/span>/);

  const mixedList = html.match(/<ul class="inkra-markdown__list inkra-markdown__list--unordered contains-task-list">([\s\S]*?)<\/ul>/)?.[1] ?? '';
  assert.match(mixedList, /<li class="inkra-markdown__list-item"[^>]*>[\s\S]*inkra-markdown__bullet/);
  assert.match(mixedList, /<li class="inkra-markdown__list-item task-list-item"/);
  assert.equal([...mixedList.matchAll(/inkra-markdown__bullet/g)].length, 1);
});

test('Markdown ignores raw HTML and rejects executable or embedded URL schemes', () => {
  const html = renderToStaticMarkup(createElement(Markdown, null, `
<script>alert('raw')</script>
<span data-raw="true">hidden html</span>

[bad](javascript:alert(1)) [also bad](vbscript:msgbox(1)) [mail](mailto:hello@example.com)

![bad image](data:image/svg+xml;base64,PHN2Zy8+) ![good image](./safe.png)
  `));

  assert.doesNotMatch(html, /<script|<span data-raw|javascript:|vbscript:|data:image/i);
  assert.match(html, /hidden html/);
  assert.match(html, /inkra-markdown__link-text/);
  assert.match(html, /inkra-markdown__image-alt/);
  assert.match(html, /href="mailto:hello@example.com"/);
  assert.match(html, /src="\.\/safe.png"/);
});

test('Markdown keeps safety defaults after a consumer URL transform', () => {
  const html = renderToStaticMarkup(createElement(Markdown, {
    transformUrl: (_url, kind) => kind === 'link' ? 'javascript:alert(1)' : 'https://cdn.example.com/image.png',
  }, '[link](/safe) ![image](/safe.png)'));

  assert.doesNotMatch(html, /javascript:/i);
  assert.match(html, /src="https:\/\/cdn.example.com\/image.png"/);

  const controlCharacterScheme = renderToStaticMarkup(createElement(Markdown, {
    transformUrl: () => 'java\nscript:alert(1)',
  }, '[link](/safe)'));
  assert.doesNotMatch(controlCharacterScheme, /java\s*script:/i);
  assert.match(controlCharacterScheme, /inkra-markdown__link-text/);
});

test('Markdown source and styles retain parser, theme and responsive contracts', () => {
  assert.match(source, /const markdownPlugins = \[remarkGfm\]/);
  assert.match(source, /const resolvedLabels = useMemo<Required<MarkdownLabels>>/);
  assert.match(source, /const builtIns = useMemo\(/);
  assert.match(source, /const resolvedComponents = useMemo\(/);
  assert.match(source, /components=\{resolvedComponents\}/);
  assert.match(source, /remarkPlugins=\{markdownPlugins\}/);
  assert.match(source, /skipHtml/);
  assert.match(source, /safeUrl\(transformed, kind\)/);
  assert.match(source, /import \{ Checkbox \} from '\.\.\/selection\/Checkbox\.js'/);
  assert.match(source, /<Checkbox/);
  assert.match(source, /<codeContext\.Provider value="block">/);
  assert.match(source, /<MarkdownCodeBlock/);
  assert.match(source, /data-inline=\{kind === 'inline' \|\| undefined\}/);
  assert.match(source, /className="inkra-markdown__code-wash"/);
  assert.match(source, /seed=\{`markdown-inline-code-wash-\$\{value\}`\}/);
  assert.match(source, /<PencilText className="inkra-markdown__code-text"/);
  assert.match(codeSource, /import Prism from 'prismjs'/);
  assert.match(codeSource, /prism-(?:jsx|typescript|tsx|bash|json|markdown)\.js/);
  assert.match(codeSource, /function flatten\(stream: Prism\.TokenStream/);
  assert.match(codeSource, /<PencilText/);
  assert.doesNotMatch(source, /inkra-markdown__task-(?:input|mark|glyph)|checkPaths/);
  assert.match(source, /<PencilIcon className="inkra-markdown__bullet"/);
  assert.match(source, /<PencilLine className="inkra-markdown__link-line"/);
  assert.match(source, /className="inkra-markdown__link-focus"/);
  assert.match(codeSource, /className="inkra-markdown__code-focus"/);
  assert.match(source, /className="inkra-markdown__table-focus"/);
  assert.match(source, /<Table\.Container/);
  assert.match(styles, /\[data-theme="dark"\]|var\(--inkra-ink\)/);
  assert.match(styles, /font-family: var\(--inkra-font-body\)/);
  assert.match(styles, /font-family: var\(--inkra-font-mono\)/);
  assert.match(styles, /font-size: var\(--inkra-text-md\)/);
  assert.match(styles, /font-weight: var\(--inkra-weight-semibold\)/);
  assert.match(styles, /\.inkra-markdown em \{[^}]*font-style: italic/);
  assert.match(styles, /color: var\(--inkra-accent-strong\)/);
  assert.match(styles, /\.inkra-markdown__link \{[^}]*display: inline-block;[^}]*vertical-align: baseline;/);
  assert.match(styles, /\.inkra-markdown__link > \.inkra-markdown__link-line \{[^}]*pointer-events: none;[^}]*position: absolute;/);
  assert.match(styles, /overflow-x: auto/);
  assert.match(styles, /\.inkra-markdown__list--unordered > \.task-list-item > \.inkra-markdown__list-content \{ grid-column: 1; \}/);
  assert.match(styles, /\.inkra-markdown__task-row \{[\s\S]*grid-template-columns: 18px minmax\(0, 1fr\)/);
  assert.match(styles, /\.inkra-markdown__task-content \{ min-width: 0; \}/);
  assert.doesNotMatch(styles, /text-indent:/);
  assert.match(styles, /\.inkra-markdown__ordered-marker \{[\s\S]*justify-self: end;[\s\S]*white-space: nowrap;/);
  assert.match(styles, /grid-template-columns: var\(--inkra-markdown-ordered-marker-width, 1\.75rem\) minmax\(0, 1fr\)/);
  assert.match(source, /'--inkra-markdown-ordered-marker-width': `max\(1\.75rem, \$\{markerCharacters\}ch\)`/);
  assert.match(styles, /\.inkra-selection-control\.inkra-markdown__task-checkbox \{[\s\S]*grid-template-columns: 18px;[\s\S]*min-height: 0;/);
  assert.match(styles, /\.inkra-markdown__code-text \{[\s\S]*--inkra-letter-fill: 0\.24;[\s\S]*font-family: inherit;/);
  assert.match(styles, /\.inkra-markdown__code-text > \.inkra-pencil-text__source \{ font-family: inherit; \}/);
  assert.match(styles, /\.inkra-markdown__code-surface \{[\s\S]*background: transparent;[\s\S]*font-family: "Trip Map Hand", var\(--inkra-font-hand\);[\s\S]*overflow-x: auto;[\s\S]*overflow-wrap: normal;/);
  assert.match(styles, /\.inkra-markdown__code-surface \.inkra-pencil-text,[\s\S]*max-width: none;[\s\S]*overflow-wrap: normal;/);
  assert.match(styles, /\.token-keyword,[\s\S]*color: var\(--inkra-danger\)/);
  assert.match(styles, /\.token-string,[\s\S]*color: var\(--inkra-success-foreground\)/);
  assert.match(styles, /\.inkra-markdown \.inkra-markdown__list--unordered \{ list-style: disc; padding-inline-start: 1\.4rem; \}/);
  assert.match(styles, /\.inkra-markdown \.inkra-markdown__list--ordered \{ list-style: decimal; padding-inline-start: 1\.8rem; \}/);
  assert.match(styles, /\.inkra-markdown__list--unordered > \.task-list-item \{ list-style: none; \}/);
  assert.match(styles, /\.inkra-markdown__code-surface:focus-visible \+ \.inkra-markdown__code-focus \{ opacity: 1; \}/);
  assert.match(styles, /\.inkra-markdown__table:focus-visible \+ \.inkra-markdown__table-focus \{ opacity: 1; \}/);
  assert.doesNotMatch(styles, /\.inkra-markdown h[123] \{ font-size: (?:24|20|17)px; \}/);
  assert.doesNotMatch(styles, /\.inkra-markdown__code-surface:focus-visible \{[^}]*outline:[^}]*solid/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(styles, /@media print/);
  assert.match(styles, /@media print \{[\s\S]*\.inkra-markdown__task-checkbox > \.inkra-selection-control__input \{[\s\S]*appearance: auto;[\s\S]*position: static;[\s\S]*\.inkra-markdown__task-checkbox > \.inkra-selection-control__mark \{ display: none !important; \}/);

  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.dependencies['react-markdown'], '^10.1.0');
  assert.equal(packageJson.dependencies['remark-gfm'], '^4.0.1');
  assert.equal(packageJson.dependencies.prismjs, '^1.30.0');
  assert.equal(packageJson.devDependencies['@types/prismjs'], '^1.26.6');
  assert.match(readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8'), /export \* from '\.\/markdown\/index\.js'/);
  assert.match(readFileSync(new URL('../scripts/copy-styles.mjs', import.meta.url), 'utf8'), /markdown\/styles\.css/);
});
