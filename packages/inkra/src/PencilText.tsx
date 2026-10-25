import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useBrowserLayoutEffect } from './internal/useBrowserLayoutEffect.js';
import type {
  ComponentPropsWithoutRef,
  ComponentPropsWithRef,
  ElementType,
  ReactElement,
} from 'react';

import { boundedCanvasSize, effectiveDpr } from './internal/cache.js';
import { observeCanvasRecovery } from './internal/recovery.js';
import { seedToNumber } from './internal/random.js';
import { pencilLettering, renderPencilText } from './internal/textRenderer.js';
import { readRenderToken } from './internal/renderTokens.js';
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

interface LocalTextLine {
  text: string;
  left: number;
  top: number;
}

function pixelValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function localBorderBox(element: HTMLElement, style = getComputedStyle(element)): { width: number; height: number } {
  const horizontalExtras = pixelValue(style.paddingLeft) + pixelValue(style.paddingRight)
    + pixelValue(style.borderLeftWidth) + pixelValue(style.borderRightWidth);
  const verticalExtras = pixelValue(style.paddingTop) + pixelValue(style.paddingBottom)
    + pixelValue(style.borderTopWidth) + pixelValue(style.borderBottomWidth);
  const computedWidth = pixelValue(style.width);
  const computedHeight = pixelValue(style.height);
  return {
    width: computedWidth > 0
      ? computedWidth + (style.boxSizing === 'border-box' ? 0 : horizontalExtras)
      : element.offsetWidth,
    height: computedHeight > 0
      ? computedHeight + (style.boxSizing === 'border-box' ? 0 : verticalExtras)
      : element.offsetHeight,
  };
}

function copyComputedStyle(source: CSSStyleDeclaration, target: CSSStyleDeclaration) {
  for (const property of source) {
    target.setProperty(property, source.getPropertyValue(property), source.getPropertyPriority(property));
  }
}

function measureLocalTextLines(
  element: HTMLElement,
  liveSource: HTMLSpanElement,
  text: string,
  width: number,
  height: number,
): LocalTextLine[] {
  if (!width || !height || !text) return [];
  const computed = getComputedStyle(element);
  const sourceComputed = getComputedStyle(liveSource);
  const probe = document.createElement(element.tagName.toLowerCase());
  const source = document.createElement('span');
  copyComputedStyle(computed, probe.style);
  copyComputedStyle(sourceComputed, source.style);
  probe.setAttribute('aria-hidden', 'true');
  probe.inert = true;
  Object.assign(probe.style, {
    boxSizing: 'border-box',
    contain: 'layout style paint',
    height: `${height}px`,
    left: '-100000px',
    margin: '0',
    maxHeight: `${height}px`,
    maxWidth: `${width}px`,
    minHeight: `${height}px`,
    minWidth: `${width}px`,
    overflow: 'visible',
    pointerEvents: 'none',
    position: 'fixed',
    rotate: 'none',
    scale: 'none',
    top: '0',
    transform: 'none',
    translate: 'none',
    visibility: 'hidden',
    width: `${width}px`,
  });
  source.textContent = text;
  probe.append(source);
  document.body.append(probe);
  try {
    const box = probe.getBoundingClientRect();
    const range = document.createRange();
    const lines: LocalTextLine[] = [];
    let offset = 0;
    for (const character of text) {
      range.setStart(source.firstChild!, offset);
      offset += character.length;
      range.setEnd(source.firstChild!, offset);
      const rectangle = range.getBoundingClientRect();
      const left = rectangle.left - box.left;
      const top = rectangle.top - box.top;
      let line = lines[lines.length - 1];
      if (!line || Math.abs(line.top - top) > 1) {
        line = { text: '', left, top };
        lines.push(line);
      }
      line.text += character;
    }
    return lines;
  } finally {
    probe.remove();
  }
}

function paintText(
  element: HTMLElement,
  source: HTMLSpanElement,
  canvas: HTMLCanvasElement,
  text: string,
  seed: string | number,
  glyphSeed: number,
): boolean {
  const style = getComputedStyle(element);
  const { width: localWidth, height: localHeight } = localBorderBox(element, style);
  if (!localWidth || !localHeight || text.length > 4096 || !source.firstChild) return false;
  const size = Number.parseFloat(style.fontSize);
  const context = canvas.getContext('2d');
  const padding = 5;
  const width = localWidth + padding * 2;
  const height = localHeight + padding * 2;
  const dpr = effectiveDpr(2);
  if (width * height * dpr ** 2 > 2 * 1024 * 1024 || !context || context.isContextLost?.()) return false;
  const pixels = boundedCanvasSize(width, height, dpr);
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  Object.assign(canvas.style, {
    left: `-${padding}px`,
    top: `-${padding}px`,
    right: 'auto',
    bottom: 'auto',
    width: `${width}px`,
    height: `${height}px`,
  });
  context.scale(dpr, dpr);
  context.font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
  context.fontKerning = 'none';
  const ascent = context.measureText(text).fontBoundingBoxAscent ?? size;
  const lines = measureLocalTextLines(element, source, text, localWidth, localHeight);

  for (const line of lines) {
    const lineText = line.text.trimEnd();
    if (!lineText) continue;
    const sprite = renderPencilText(lineText, {
      size,
      seed: seedToNumber(seed) ^ textSeed(line.text),
      glyphSeed,
      color: style.color,
      family: style.fontFamily,
      weight: style.fontWeight,
      style: style.fontStyle,
      dpr,
      settings: {
        variation: readRenderToken(style, '--inkra-letter-variation', pencilLettering.variation, 0, 1),
        breaks: readRenderToken(style, '--inkra-letter-breaks', pencilLettering.breaks, 0, 1),
        outline: readRenderToken(style, '--inkra-letter-outline', pencilLettering.outline, 0, 1),
        fill: readRenderToken(style, '--inkra-letter-fill', pencilLettering.fill, 0, 1),
        grain: readRenderToken(style, '--inkra-letter-grain', pencilLettering.grain, 0, 1),
      },
    });
    if (sprite.ink.getContext('2d')?.isContextLost?.()) return false;
    context.drawImage(
      sprite.ink,
      padding + line.left - sprite.padding,
      padding + line.top + ascent - sprite.ascent - sprite.padding,
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
    const [fittedText, setText] = useState<string>(children);
    const text = ellipsis ? fittedText : children;
    const elementRef = useRef<HTMLElement>(null);
    const sourceRef = useRef<HTMLSpanElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const resolvedSeed = seed ?? children;
    const glyphSeed = seedToNumber(seed ?? 'inkra-latin-lettering-v1');
    useImperativeHandle(forwardedRef, () => elementRef.current as HTMLElement);

    useBrowserLayoutEffect(() => {
      if (!ellipsis) {
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
        context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
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

    useBrowserLayoutEffect(() => {
      const node = elementRef.current;
      const source = sourceRef.current;
      const canvas = canvasRef.current;
      if (!node || !source || !canvas) return undefined;
      delete node.dataset.pencilReady;
      let disposed = false;
      const inViewport = () => {
        const box = node.getBoundingClientRect();
        if (!box.width || !box.height || !node.isConnected) return false;
        let left = Math.max(0, box.left);
        let top = Math.max(0, box.top);
        let right = Math.min(window.innerWidth, box.right);
        let bottom = Math.min(window.innerHeight, box.bottom);
        for (let parent = node.parentElement; parent && left < right && top < bottom; parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
          const clip = parent.getBoundingClientRect();
          if (style.overflowX !== 'visible') {
            left = Math.max(left, clip.left);
            right = Math.min(right, clip.right);
          }
          if (style.overflowY !== 'visible') {
            top = Math.max(top, clip.top);
            bottom = Math.min(bottom, clip.bottom);
          }
        }
        return left < right && top < bottom;
      };
      let visible = inViewport() || typeof IntersectionObserver === 'undefined';
      let pending: (() => void) | null = null;
      let dirty = true;
      let lastAppearance = '';
      const appearanceKey = () => {
        const style = getComputedStyle(node);
        const localBox = localBorderBox(node, style);
        return JSON.stringify([
          localBox.width, localBox.height, effectiveDpr(2),
          style.fontSize && style.fontFamily
            ? document.fonts?.check(`${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, text) : false,
          ...['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'text-align', 'text-indent',
            'letter-spacing', 'white-space', 'word-break', 'overflow-wrap', 'direction',
            'padding-top', 'padding-left', 'padding-right', 'padding-bottom',
            '--inkra-letter-variation', '--inkra-letter-breaks', '--inkra-letter-outline',
            '--inkra-letter-fill', '--inkra-letter-grain'].map(name => style.getPropertyValue(name)),
        ]);
      };
      const paint = () => {
        pending = null;
        if (!disposed && visible && dirty) {
          try {
            paintText(node, source, canvas, text, resolvedSeed, glyphSeed);
          } catch {
            delete node.dataset.pencilReady;
          }
          // Remember fallback appearances too. An oversized/unsupported label
          // must not retry expensive measurement for unrelated ancestor styles.
          // Theme/font/size changes and explicit canvas recovery still retry.
          lastAppearance = appearanceKey();
          dirty = false;
        }
      };
      const schedule = () => {
        if (!visible || !dirty || disposed) return;
        // Visible text is enhanced before paint; only nearby text waits for idle time.
        if (inViewport()) {
          pending?.();
          pending = null;
          paint();
        } else if (!pending) {
          pending = queueTextPaint(paint);
        }
      };
      const markDirty = () => {
        dirty = true;
        delete node.dataset.pencilReady;
        schedule();
      };
      // Scroll locks and pointer-event changes must not hide already-painted text.
      const refreshAppearance = () => {
        if (disposed || !node.isConnected) return;
        if (appearanceKey() !== lastAppearance) markDirty();
      };
      const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refreshAppearance);
      resize?.observe(node);
      const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
      const inheritedStyle = new MutationObserver(refreshAppearance);
      for (let element: HTMLElement | null = node; element; element = element.parentElement) {
        inheritedStyle.observe(element, { attributes: true, attributeFilter: ['style', 'class', 'dir', 'data-theme', 'data-inkra-theme'] });
      }
      colorScheme.addEventListener('change', refreshAppearance);
      const intersection = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
        visible = entries[entries.length - 1]?.isIntersecting ?? false;
        schedule();
      }, { rootMargin: '240px' });
      intersection?.observe(node);
      const fonts = document.fonts;
      fonts?.addEventListener('loadingdone', refreshAppearance);
      fonts?.addEventListener('loadingerror', refreshAppearance);
      fonts?.ready.then(() => { if (!disposed) refreshAppearance(); });
      const stopRecovery = observeCanvasRecovery(() => {
        pending?.();
        pending = null;
        markDirty();
      });
      schedule();
      // Ancestor layout effects can reveal a clipped label during the same commit.
      if (!visible) queueMicrotask(() => {
        if (!disposed && dirty && inViewport()) {
          visible = true;
          schedule();
        }
      });

      return () => {
        disposed = true;
        stopRecovery();
        pending?.();
        resize?.disconnect();
        intersection?.disconnect();
        inheritedStyle.disconnect();
        colorScheme.removeEventListener('change', refreshAppearance);
        fonts?.removeEventListener('loadingdone', refreshAppearance);
        fonts?.removeEventListener('loadingerror', refreshAppearance);
      };
    }, [text, resolvedSeed, glyphSeed]);

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
