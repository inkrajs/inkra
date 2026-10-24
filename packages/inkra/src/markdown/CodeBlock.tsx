import Prism from 'prismjs';
import 'prismjs/components/prism-jsx.js';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-tsx.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-markdown.js';
import { useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef } from 'react';

import { Button } from '../Button.js';
import { Card } from '../content/index.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { Tooltip } from '../tooltip/Tooltip.js';
import { codeIcons } from './icons.js';

Prism.manual = true;

interface CodePart {
  classes: string;
  text: string;
}

const languageAliases: Record<string, string> = {
  js: 'javascript',
  md: 'markdown',
  sh: 'bash',
  shell: 'bash',
  ts: 'typescript',
  txt: 'plain',
  text: 'plain',
  plaintext: 'plain',
};

const languageNames: Record<string, string> = {
  javascript: 'JavaScript', typescript: 'TypeScript', jsx: 'JSX', tsx: 'TSX',
  bash: 'Bash', json: 'JSON', markdown: 'Markdown', css: 'CSS', html: 'HTML',
};

export interface MarkdownCodeLabels {
  plainText: string;
  copy: string;
  copied: string;
  copyFailed: string;
}

function classes(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

function flatten(stream: Prism.TokenStream, inheritedClasses = ''): CodePart[] {
  const tokens = Array.isArray(stream) ? stream : [stream];
  return tokens.flatMap(token => {
    if (typeof token === 'string') return [{ text: token, classes: inheritedClasses }];
    const aliases = Array.isArray(token.alias) ? token.alias : token.alias ? [token.alias] : [];
    const tokenClasses = classes(
      inheritedClasses,
      `token-${token.type}`,
      ...aliases.map(alias => `token-${alias}`),
    );
    return flatten(token.content, tokenClasses);
  });
}

function languageFromClassName(className?: string) {
  return /(?:^|\s)language-([^\s]+)/.exec(className ?? '')?.[1]?.toLowerCase();
}

function tokenize(code: string, language?: string): CodePart[] {
  const normalized = languageAliases[language ?? ''] ?? language ?? 'plain';
  const grammar = Prism.languages[normalized] ?? Prism.languages.plain;
  return flatten(Prism.tokenize(code, grammar)).flatMap(part =>
    part.text.split(/(\r\n|\r|\n)/).filter(Boolean).map(text => ({ ...part, text })),
  );
}

export interface MarkdownCodeBlockProps extends Omit<ComponentPropsWithoutRef<'pre'>, 'children'> {
  code: string;
  codeClassName?: string;
  labels: MarkdownCodeLabels;
}

export function MarkdownCodeBlock({
  code,
  codeClassName,
  className,
  labels,
  tabIndex: _tabIndex,
  ...props
}: MarkdownCodeBlockProps) {
  const language = languageFromClassName(codeClassName);
  const normalizedLanguage = languageAliases[language ?? ''] ?? language ?? 'plain';
  const languageLabel = normalizedLanguage === 'plain' ? labels.plainText : languageNames[normalizedLanguage] ?? language;
  const parts = useMemo(() => tokenize(code, language), [code, language]);
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  const request = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    setStatus('idle');
    return () => { request.current += 1; clearTimeout(timer.current); };
  }, [code]);
  const copyLabel = status === 'copied' ? labels.copied : status === 'failed' ? labels.copyFailed : labels.copy;
  async function copyCode() {
    const id = ++request.current;
    clearTimeout(timer.current);
    setStatus('copying');
    try {
      await navigator.clipboard.writeText(code);
      if (request.current !== id) return;
      setStatus('copied');
    } catch {
      if (request.current !== id) return;
      setStatus('failed');
    }
    timer.current = setTimeout(() => setStatus('idle'), 2000);
  }

  return <Card.Root className="inkra-markdown__code-frame" radius={6} seed={`markdown-code-frame-${language ?? 'plain'}`}>
    <Card.Header className="inkra-markdown__code-header" align="center" action={
      <Tooltip.Provider>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Button size="icon" variant="ghost" aria-label={copyLabel} aria-busy={status === 'copying' || undefined} disabled={status === 'copying'} onClick={() => void copyCode()}>
              <PencilIcon paths={status === 'copied' ? codeIcons.check : codeIcons.copy} size={22} />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Portal><Tooltip.Content>{copyLabel}</Tooltip.Content></Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    }>
      <span className="inkra-markdown__code-language">
        <PencilIcon paths={normalizedLanguage === 'bash' ? codeIcons.terminal : codeIcons.code} size={22} />
        <PencilText>{languageLabel}</PencilText>
      </span>
    </Card.Header>
    <pre
      {...props}
      className={classes('inkra-markdown__code-surface', className)}
      data-language={language ?? 'plain'}
      tabIndex={0}
    >
      <code className={classes('inkra-markdown__code', codeClassName)}>
        {parts.map((part, index) => /\S/.test(part.text)
          ? <PencilText
              className={classes('inkra-markdown__code-token', part.classes)}
              key={index}
              seed={`markdown-code-${language ?? 'plain'}-${index}-${part.text}`}
            >
              {part.text}
            </PencilText>
          : part.text)}
      </code>
    </pre>
    <PencilSurface
      aria-hidden="true"
      as="span"
      className="inkra-markdown__code-focus"
      radius={6}
      seed="markdown-code-focus"
      variant="outline"
    />
    <span className="inkra-markdown__code-status" role="status">{status === 'copied' ? labels.copied : status === 'failed' ? labels.copyFailed : ''}</span>
  </Card.Root>;
}
