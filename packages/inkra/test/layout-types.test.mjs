import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

test('published Layout declarations expose shared columns without changing other region contracts', () => {
  const path = fileURLToPath(new URL('./layout-api-typecheck.tsx', import.meta.url));
  const source = `
    import { createElement } from 'react';
    import { Layout, type LayoutProps, type LayoutHeaderProps, type LayoutSidebarProps, type LayoutContentProps } from '../dist/layout/index.js';
    const root: LayoutProps = { sidebarWidth: 240, collapseAt: 'never' };
    const proportional: LayoutProps = { sidebarWidth: '25%' };
    const header: LayoutHeaderProps = { sidebar: createElement('a', { href: '/' }, 'Brand'), sidebarDivided: true, divided: true, padding: 4 };
    const sidebar: LayoutSidebarProps = { width: 120, padding: 0 };
    createElement(Layout.Root, root, createElement(Layout.Header, header), createElement(Layout.Sidebar, sidebar));
    createElement(Layout.Root, proportional);
    // @ts-expect-error Header slot is not a Content attribute.
    const content: LayoutContentProps = { sidebar: 'Brand' };
    // @ts-expect-error Shared widths do not accept boolean values.
    const invalid: LayoutProps = { sidebarWidth: true };
    void content; void invalid;
  `;
  const options = { noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, jsx: ts.JsxEmit.ReactJSX };
  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, ...args) => name === path ? ts.createSourceFile(name, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX) : getSourceFile(name, ...args);
  const program = ts.createProgram([path], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(diagnostics.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')), []);
});
