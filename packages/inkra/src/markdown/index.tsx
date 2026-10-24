import ReactMarkdown from 'react-markdown';
import type { Components, UrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  type CSSProperties,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from 'react';

import { PencilIcon } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { Table } from '../content/index.js';
import { Checkbox } from '../selection/Checkbox.js';
import { MarkdownCodeBlock, type MarkdownCodeLabels } from './CodeBlock.js';
import { Deletion } from './Deletion.js';

const listContext = createContext<'ordered' | 'unordered'>('unordered');
const codeContext = createContext<'inline' | 'block'>('inline');
const bulletPaths = [{ d: 'M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15' }] as const;
const markdownPlugins = [remarkGfm];

export interface MarkdownLabels extends Partial<MarkdownCodeLabels> {
  code?: string;
  table?: string;
  taskChecked?: string;
  taskUnchecked?: string;
}

export interface MarkdownProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  children: string;
  components?: Components;
  headingLevelOffset?: number;
  labels?: MarkdownLabels;
  transformUrl?: (url: string, kind: 'link' | 'image') => string | null | undefined;
}

function classes(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

function pencilChildren(children: ReactNode, seed: string): ReactNode {
  return Children.map(children, (child, index) => {
    if (typeof child !== 'string' && typeof child !== 'number') return child;
    const value = String(child);
    if (!/\S/.test(value)) return value;
    const [, leading, text, trailing] = /^(\s*)([\s\S]*?)(\s*)$/.exec(value)!;
    return <>{leading}<PencilText seed={`${seed}-${index}`}>{text}</PencilText>{trailing}</>;
  });
}

function taskContent(children: ReactNode) {
  let checkbox: ReactNode;
  const extract = (content: ReactNode): ReactNode => Children.map(content, child => {
    if (!isValidElement<{ node?: { tagName?: string }; type?: string; children?: ReactNode }>(child)) return child;
    if (!checkbox && child.props.node?.tagName === 'input' && child.props.type === 'checkbox') {
      checkbox = child;
      return null;
    }
    if (!checkbox && child.props.node?.tagName === 'p') return cloneElement(child, {}, extract(child.props.children));
    return child;
  });
  const content = extract(children);
  return { checkbox, content };
}

function textChildren(children: ReactNode): string {
  let value = '';
  Children.forEach(children, child => {
    if (typeof child === 'string' || typeof child === 'number') value += String(child);
  });
  return value;
}

function codeBlockContent(children: ReactNode) {
  if (isValidElement<{ children?: ReactNode; className?: string }>(children)) {
    return {
      className: children.props.className,
      code: textChildren(children.props.children),
    };
  }
  return { className: undefined, code: textChildren(children) };
}

function safeUrl(url: string, kind: 'link' | 'image'): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^(?:[#/?]|\.\.?\/)/.test(trimmed)) return trimmed;
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(trimmed.replace(/[\u0000-\u001f\u007f]/g, ''))?.[1]?.toLowerCase();
  if (!scheme) return trimmed;
  if (scheme === 'http' || scheme === 'https') return trimmed;
  if (kind === 'link' && (scheme === 'mailto' || scheme === 'tel')) return trimmed;
  return null;
}

type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

function headingTag(level: number, offset: number): HeadingTag {
  return `h${Math.max(1, Math.min(6, level + offset))}` as HeadingTag;
}

interface MarkdownListItemProps extends ComponentPropsWithoutRef<'li'> {
  node?: unknown;
  'data-inkra-ordered-index'?: number;
}

type MarkdownOrderedListStyle = CSSProperties & {
  '--inkra-markdown-ordered-marker-width'?: string;
};

function MarkdownTaskCheckbox({
  checked = false,
  className,
  label,
  ...props
}: Omit<ComponentPropsWithoutRef<'input'>, 'type'> & { label: string }) {
  const selected = Boolean(checked);
  return <Checkbox
    {...props}
    aria-label={props['aria-label'] ?? label}
    checked={selected}
    className={classes('inkra-markdown__task-checkbox', className)}
    disabled
    label={<span aria-hidden="true" />}
    seed={`markdown-task-${selected ? 'checked' : 'unchecked'}`}
  />;
}

function createMarkdownComponents(
  headingLevelOffset: number,
  labels: Required<MarkdownLabels>,
): Components {
  const heading = (level: number): NonNullable<Components['h1']> => {
    const Heading = headingTag(level, headingLevelOffset);
    return ({ node: _node, children, className, ...props }) => (
      <Heading {...props} className={classes('inkra-markdown__heading', className)}>
        {pencilChildren(children, `markdown-heading-${level}`)}
      </Heading>
    );
  };

  return {
    h1: heading(1),
    h2: heading(2),
    h3: heading(3),
    h4: heading(4),
    h5: heading(5),
    h6: heading(6),
    p: ({ node: _node, children, className, ...props }) => (
      <p {...props} className={classes('inkra-markdown__paragraph', className)}>
        {pencilChildren(children, 'markdown-paragraph')}
      </p>
    ),
    strong: ({ node: _node, children, ...props }) => <strong {...props}>{pencilChildren(children, 'markdown-strong')}</strong>,
    em: ({ node: _node, children, ...props }) => <em {...props}>{pencilChildren(children, 'markdown-emphasis')}</em>,
    del: ({ node: _node, children, ...props }) => <Deletion {...props}>{pencilChildren(children, 'markdown-deleted')}</Deletion>,
    a: ({ node: _node, children, className, href, ...props }) => href ? (
      <a {...props} className={classes('inkra-markdown__link', className)} href={href}>
        <PencilSurface aria-hidden="true" as="span" className="inkra-markdown__link-focus" radius={3} seed={`markdown-link-focus-${href}`} variant="outline" />
        <span>{pencilChildren(children, 'markdown-link')}</span>
        <PencilLine className="inkra-markdown__link-line" seed={`markdown-link-${href}`} />
      </a>
    ) : <span className={classes('inkra-markdown__link-text', className)}>{pencilChildren(children, 'markdown-link-text')}</span>,
    blockquote: ({ node: _node, children, className, ...props }) => (
      <blockquote {...props} className={classes('inkra-markdown__quote', className)}>
        <PencilLine className="inkra-markdown__quote-line" orientation="vertical" seed="markdown-quote" />
        <div>{children}</div>
      </blockquote>
    ),
    hr: ({ node: _node, className, ...props }) => (
      <div {...props} className={classes('inkra-markdown__divider', className)} role="separator">
        <PencilLine seed="markdown-divider" />
      </div>
    ),
    pre: ({ node: _node, children, ...props }) => {
      const block = codeBlockContent(children);
      return <codeContext.Provider value="block">
        <MarkdownCodeBlock
          {...props}
          aria-label={labels.code}
          labels={labels}
          code={block.code}
          codeClassName={block.className}
        />
      </codeContext.Provider>;
    },
    code: ({ node: _node, children, className, ...props }) => {
      const kind = useContext(codeContext);
      const value = textChildren(children);
      return <code {...props} className={classes('inkra-markdown__code', className)} data-inline={kind === 'inline' || undefined}>
        {kind === 'inline'
          ? <>
              <PencilSurface
                aria-hidden="true"
                as="span"
                className="inkra-markdown__code-wash"
                radius={3}
                seed={`markdown-inline-code-wash-${value}`}
                variant="wash"
              />
              <PencilText className="inkra-markdown__code-text" seed={`markdown-inline-code-${value}`}>{value}</PencilText>
            </>
          : children}
      </code>;
    },
    ul: ({ node: _node, children, className, ...props }) => (
      <listContext.Provider value="unordered">
        <ul {...props} className={classes('inkra-markdown__list', 'inkra-markdown__list--unordered', className)}>{children}</ul>
      </listContext.Provider>
    ),
    ol: ({ node: _node, children, className, start, style, ...props }) => {
      const first = typeof start === 'number' && Number.isFinite(start) ? Math.trunc(start) : 1;
      let itemIndex = 0;
      const numberedChildren = Children.map(children, child => {
        if (!isValidElement(child)) return child;
        const marker = first + itemIndex;
        itemIndex += 1;
        return cloneElement(child as ReactElement<MarkdownListItemProps>, { 'data-inkra-ordered-index': marker });
      });
      const last = first + Math.max(0, itemIndex - 1);
      const markerCharacters = Math.max(`${first}.`.length, `${last}.`.length);
      const listStyle: MarkdownOrderedListStyle = {
        ...style,
        '--inkra-markdown-ordered-marker-width': `max(1.75rem, ${markerCharacters}ch)`,
      };
      return <listContext.Provider value="ordered">
        <ol {...props} className={classes('inkra-markdown__list', 'inkra-markdown__list--ordered', className)} start={first} style={listStyle}>{numberedChildren}</ol>
      </listContext.Provider>;
    },
    li: ({ node: _node, children, className, 'data-inkra-ordered-index': orderedIndex, ...props }: MarkdownListItemProps) => {
      const kind = useContext(listContext);
      const task = className?.split(/\s+/).includes('task-list-item');
      const extracted = task ? taskContent(children) : undefined;
      return <li {...props} className={classes('inkra-markdown__list-item', className)} data-inkra-list-kind={kind}>
        {kind === 'unordered' && !task && <PencilIcon className="inkra-markdown__bullet" paths={bulletPaths} size={12} sourceSize={24} strokeWidth={1.2} intensity={0.78} />}
        {kind === 'ordered' && orderedIndex != null && <PencilText aria-hidden="true" className="inkra-markdown__ordered-marker" seed={`markdown-order-${orderedIndex}`}>{`${orderedIndex}.`}</PencilText>}
        <div className="inkra-markdown__list-content">{extracted?.checkbox
          ? <div className="inkra-markdown__task-row">{extracted.checkbox}<div className="inkra-markdown__task-content">{pencilChildren(extracted.content, 'markdown-list-item')}</div></div>
          : pencilChildren(children, 'markdown-list-item')}</div>
      </li>;
    },
    input: ({ node: _node, checked, type, ...props }) => type === 'checkbox'
      ? <MarkdownTaskCheckbox {...props} checked={checked} label={checked ? labels.taskChecked : labels.taskUnchecked} />
      : <input {...props} checked={checked} type={type} />,
    table: ({ node: _node, children, className, ...props }) => (
      <div className="inkra-markdown__table-frame">
        <Table.Container aria-label={labels.table} className="inkra-markdown__table" role="region">
          <Table.Root {...props} className={className}>{children}</Table.Root>
        </Table.Container>
        <PencilSurface aria-hidden="true" as="span" className="inkra-markdown__table-focus" radius={6} seed="markdown-table-focus" variant="outline" />
      </div>
    ),
    thead: ({ node: _node, ...props }) => <Table.Header {...props} />,
    tbody: ({ node: _node, ...props }) => <Table.Body {...props} />,
    tr: ({ node: _node, ...props }) => <Table.Row {...props} />,
    th: ({ node: _node, children, align, ...props }) => <Table.Head {...props} align={align}>{pencilChildren(children, 'markdown-table-heading')}</Table.Head>,
    td: ({ node: _node, children, align, ...props }) => <Table.Cell {...props} align={align} verticalAlign="top">{pencilChildren(children, 'markdown-table-cell')}</Table.Cell>,
    img: ({ node: _node, className, alt = '', ...props }) => props.src ? (
      <PencilSurface as="span" className="inkra-markdown__image-frame" radius={6} seed={`markdown-image-${props.src ?? ''}`} variant="outline">
        <img {...props} alt={alt} className={classes('inkra-markdown__image', className)} decoding="async" loading="lazy" />
      </PencilSurface>
    ) : <span className={classes('inkra-markdown__image-alt', className)}>{pencilChildren(alt, 'markdown-image-alt')}</span>,
  };
}

export const Markdown = forwardRef<HTMLDivElement, MarkdownProps>(function Markdown(
  {
    children,
    className,
    components,
    headingLevelOffset = 0,
    labels,
    transformUrl,
    ...props
  },
  ref,
) {
  const offset = Number.isFinite(headingLevelOffset) ? Math.trunc(headingLevelOffset) : 0;
  const resolvedLabels = useMemo<Required<MarkdownLabels>>(() => ({
    code: labels?.code ?? 'Code block',
    plainText: labels?.plainText ?? 'Plain text',
    copy: labels?.copy ?? 'Copy code',
    copied: labels?.copied ?? 'Code copied',
    copyFailed: labels?.copyFailed ?? 'Copy failed. Select the code to copy it manually.',
    table: labels?.table ?? 'Markdown table',
    taskChecked: labels?.taskChecked ?? 'Completed task',
    taskUnchecked: labels?.taskUnchecked ?? 'Incomplete task',
  }), [labels?.code, labels?.plainText, labels?.copy, labels?.copied, labels?.copyFailed, labels?.table, labels?.taskChecked, labels?.taskUnchecked]);
  const builtIns = useMemo(
    () => createMarkdownComponents(offset, resolvedLabels),
    [offset, resolvedLabels],
  );
  const resolvedComponents = useMemo(
    () => ({ ...builtIns, ...components }),
    [builtIns, components],
  );
  const urlTransform = useCallback<UrlTransform>((url, key) => {
    const kind = key === 'src' ? 'image' : 'link';
    const transformed = transformUrl ? transformUrl(url, kind) : url;
    return transformed == null ? null : safeUrl(transformed, kind);
  }, [transformUrl]);

  return <div {...props} ref={ref} className={classes('inkra-markdown', className)}>
    <ReactMarkdown
      components={resolvedComponents}
      remarkPlugins={markdownPlugins}
      skipHtml
      urlTransform={urlTransform}
    >
      {children}
    </ReactMarkdown>
  </div>;
});
