import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useBrowserLayoutEffect } from './internal/useBrowserLayoutEffect.js';
import type {
  ComponentPropsWithoutRef,
  ComponentPropsWithRef,
  ElementType,
  ReactElement,
} from 'react';

import { effectiveDpr } from './internal/cache.js';
import { observeCanvasRecovery } from './internal/recovery.js';
import { seedToNumber } from './internal/random.js';
import { renderPencilText } from './internal/textRenderer.js';
import { queueTextPaint } from './internal/textQueue.js';

interface PencilTextBaseProps {
  children: string;
  seed?: string | number;
  ellipsis?: boolean;
  className?: string;
}

type PencilTextOwnProps<Element extends ElementType> = PencilTextBaseProps & { as?: Element };

export type PencilTextProps<Element extends ElementType = 'span'> = PencilTextOwnProps<Element>
  & Omit<ComponentPropsWithoutRef<Element>, keyof PencilTextOwnProps<Element>>;

type PencilTextComponent = <Element extends ElementType = 'span'>(
  props: PencilTextProps<Element> & { ref?: ComponentPropsWithRef<Element>['ref'] },
) => ReactElement | null;

function textSeed(text: string): number {
  return Array.from(text).reduce(
    (seed, character) => Math.imul(seed ^ character.codePointAt(0)!, 16777619),
    71,
  ) >>> 0;
}

function paintText(
  element: HTMLElement,
  source: HTMLSpanElement,
  canvas: HTMLCanvasElement,
  text: string,
  seed: string | number,
): boolean {
  const box = element.getBoundingClientRect();
  if (!box.width || !box.height || text.length > 4096 || !source.firstChild) return false;
  const style = getComputedStyle(element);
  const size = Number.parseFloat(style.fontSize);
  const context = canvas.getContext('2d');
  const padding = 5;
  const width = box.width + padding * 2;
  const height = box.height + padding * 2;
  const dpr = effectiveDpr(2);
  if (width * height * dpr ** 2 > 2 * 1024 * 1024 || !context || context.isContextLost?.()) return false;
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(height * dpr);
  Object.assign(canvas.style, {
    left: `-${padding}px`,
    top: `-${padding}px`,
    right: 'auto',
    bottom: 'auto',
    width: `${width}px`,
    height: `${height}px`,
  });
  context.scale(dpr, dpr);
  context.font = `400 ${size}px ${style.fontFamily}`;
  context.fontKerning = 'none';
  const ascent = context.measureText(text).fontBoundingBoxAscent ?? size;
  const range = document.createRange();
  const lines: Array<{ text: string; left: number; top: number }> = [];
  let offset = 0;

  for (const character of text) {
    range.setStart(source.firstChild, offset);
    offset += character.length;
    range.setEnd(source.firstChild, offset);
    const rectangle = range.getBoundingClientRect();
    let line = lines[lines.length - 1];
    if (!line || Math.abs(line.top - rectangle.top) > 1) {
      line = { text: '', left: rectangle.left, top: rectangle.top };
      lines.push(line);
    }
    line.text += character;
  }

  for (const line of lines) {
    const lineText = line.text.trimEnd();
    if (!lineText) continue;
    const sprite = renderPencilText(lineText, {
      size,
      seed: seedToNumber(seed) ^ textSeed(line.text),
      color: style.color,
      family: style.fontFamily,
      dpr,
    });
    if (sprite.ink.getContext('2d')?.isContextLost?.()) return false;
    context.drawImage(
      sprite.ink,
      padding + line.left - box.left - sprite.padding,
      padding + line.top - box.top + ascent - sprite.ascent - sprite.padding,
      sprite.width,
      sprite.height,
    );
  }

  canvas.dataset.lines = String(lines.length);
  element.dataset.pencilReady = 'true';
  return true;
}

type PencilTextImplementationProps = PencilTextBaseProps & { as?: ElementType } & Record<string, any>;

const PencilTextImplementation = forwardRef<HTMLElement, PencilTextImplementationProps>(
  function PencilText(
    { as: Element = 'span', children, seed, ellipsis = false, className = '', ...props },
    forwardedRef,
  ) {
    const [text, setText] = useState<string>(children);
    const elementRef = useRef<HTMLElement>(null);
    const sourceRef = useRef<HTMLSpanElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const resolvedSeed = seed ?? children;
    useImperativeHandle(forwardedRef, () => elementRef.current as HTMLElement);

    useBrowserLayoutEffect(() => {
      if (!ellipsis) {
        setText(children);
        return undefined;
      }
      const node = elementRef.current;
      const canvas = canvasRef.current;
      if (!node || !canvas) return undefined;
      let disposed = false;
      const fit = () => {
        const width = node.clientWidth - 8;
        if (width <= 0) return;
        const style = getComputedStyle(node);
        const context = canvas.getContext('2d');
        if (!context || context.isContextLost?.()) return;
        context.font = `400 ${style.fontSize} ${style.fontFamily}`;
        context.fontKerning = 'none';
        const measure = (value: string) => context.measureText(value).width;
        if (measure(children) <= width) {
          setText(previous => previous === children ? previous : children);
          return;
        }
        const characters = Array.from(children);
        let low = 0;
        let high = characters.length;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          if (measure(`${characters.slice(0, middle).join('')}…`) <= width) low = middle;
          else high = middle - 1;
        }
        const clipped = `${characters.slice(0, low).join('').trimEnd()}…`;
        setText(previous => previous === clipped ? previous : clipped);
      };
      const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
      resize?.observe(node);
      document.fonts?.ready.then(() => { if (!disposed) fit(); });
      fit();
      return () => {
        disposed = true;
        resize?.disconnect();
      };
    }, [children, ellipsis]);

    useEffect(() => {
      const node = elementRef.current;
      const source = sourceRef.current;
      const canvas = canvasRef.current;
      if (!node || !source || !canvas) return undefined;
      delete node.dataset.pencilReady;
      let disposed = false;
      let visible = typeof IntersectionObserver === 'undefined';
      let pending: (() => void) | null = null;
      let dirty = true;
      const schedule = () => {
        if (!visible || !dirty || pending || disposed) return;
        pending = queueTextPaint(() => {
          pending = null;
          if (!disposed && visible && dirty) {
            try {
              paintText(node, source, canvas, text, resolvedSeed);
            } catch {
              delete node.dataset.pencilReady;
            }
            dirty = false;
          }
        });
      };
      const markDirty = () => {
        dirty = true;
        delete node.dataset.pencilReady;
        schedule();
      };
      const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(markDirty);
      resize?.observe(node);
      const appearance = new MutationObserver(markDirty);
      appearance.observe(document.documentElement, {
        attributes: true,
        subtree: true,
        attributeFilter: ['data-theme', 'data-inkra-theme'],
      });
      const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
      colorScheme.addEventListener('change', markDirty);
      const intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
        visible = entries[entries.length - 1]?.isIntersecting ?? false;
        schedule();
      }, { rootMargin: '80px' });
      intersection?.observe(node);
      const fonts = document.fonts;
      fonts?.addEventListener('loading', markDirty);
      fonts?.addEventListener('loadingdone', markDirty);
      fonts?.addEventListener('loadingerror', markDirty);
      fonts?.ready.then(() => { if (!disposed) markDirty(); });
      const stopRecovery = observeCanvasRecovery(() => {
        pending?.();
        pending = null;
        markDirty();
      });
      schedule();

      return () => {
        disposed = true;
        stopRecovery();
        pending?.();
        resize?.disconnect();
        intersection?.disconnect();
        appearance.disconnect();
        colorScheme.removeEventListener('change', markDirty);
        fonts?.removeEventListener('loading', markDirty);
        fonts?.removeEventListener('loadingdone', markDirty);
        fonts?.removeEventListener('loadingerror', markDirty);
      };
    }, [text, resolvedSeed]);

    const classes = ['inkra-pencil-text', ellipsis && 'inkra-pencil-text--ellipsis', className]
      .filter(Boolean).join(' ');
    const title = props.title ?? (ellipsis ? children : undefined);
    return (
      <Element {...props} className={classes} ref={elementRef} title={title}>
        <span className="inkra-pencil-text__source" ref={sourceRef}>{children}</span>
        <canvas aria-hidden="true" data-renderer="inkra-pencil-lettering-c" ref={canvasRef} />
      </Element>
    );
  },
);

export const PencilText = PencilTextImplementation as PencilTextComponent;
