import { useRef } from 'react';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import type { RefObject } from 'react';

import { effectiveDpr } from '../internal/cache.js';
import { observeCanvasRecovery } from '../internal/recovery.js';
import { seedToNumber } from '../internal/random.js';
import { renderPencilText } from '../internal/textRenderer.js';
import { queueTextPaint } from '../internal/textQueue.js';

type EditableControl = HTMLInputElement | HTMLTextAreaElement;

interface EditablePencilTextProps {
  controlRef: RefObject<EditableControl | null>;
  defaultValue?: string | number | readonly string[];
  multiline?: boolean;
  placeholder?: string;
  seed: string | number;
  value?: string | number | readonly string[];
  wrap?: string;
}

interface MeasuredLine {
  text: string;
  left: number;
  top: number;
}

const MAX_EDITABLE_TEXT = 4096;
const MAX_EDITABLE_LINE = 256;
const complexScript = /[\u0590-\u08ff\u0900-\u0dff\u0e00-\u0fff\u1780-\u18af\u200c\u200d]/u;

function numeric(style: CSSStyleDeclaration, property: string): number {
  const value = Number.parseFloat(style.getPropertyValue(property));
  return Number.isFinite(value) ? value : 0;
}

function editableText(control: EditableControl) {
  const placeholder = control.value.length === 0;
  return { text: placeholder ? control.placeholder : control.value, placeholder };
}

function visibleText(
  text: string,
  context: CanvasRenderingContext2D,
  scrollLeft: number,
  viewportWidth: number,
): { text: string; offset: number } | null {
  const characters = Array.from(text);
  const overscan = Math.max(16, viewportWidth * 0.2);
  const startEdge = Math.max(0, scrollLeft - overscan);
  const endEdge = scrollLeft + viewportWidth + overscan;
  let offset = 0;
  let start = 0;
  let end = characters.length;

  for (let index = 0; index < characters.length; index += 1) {
    const width = context.measureText(characters[index]).width;
    if (offset + width < startEdge) start = index + 1;
    if (offset <= endEdge) end = index + 1;
    offset += width;
    if (offset > endEdge) break;
  }
  const visible = characters.slice(start, end).join('');
  if (Array.from(visible).length > MAX_EDITABLE_LINE) return null;
  return { text: visible, offset: context.measureText(characters.slice(0, start).join('')).width };
}

function copyMirrorStyle(mirror: HTMLDivElement, control: HTMLTextAreaElement, style: CSSStyleDeclaration) {
  Object.assign(mirror.style, {
    boxSizing: 'border-box',
    position: 'fixed',
    left: '-100000px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    width: `${control.clientWidth}px`,
    minHeight: `${control.scrollHeight}px`,
    paddingTop: style.paddingTop,
    paddingRight: style.paddingRight,
    paddingBottom: style.paddingBottom,
    paddingLeft: style.paddingLeft,
    border: '0',
    font: style.font,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    fontKerning: style.fontKerning,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    textAlign: style.textAlign,
    textIndent: style.textIndent,
    textTransform: style.textTransform,
    direction: style.direction,
    unicodeBidi: style.unicodeBidi,
    tabSize: style.tabSize,
    overflowWrap: style.overflowWrap,
    wordBreak: style.wordBreak,
    whiteSpace: control.wrap === 'off' ? 'pre' : 'pre-wrap',
  });
}

function measureTextareaLines(
  control: HTMLTextAreaElement,
  text: string,
  style: CSSStyleDeclaration,
): MeasuredLine[] | null {
  const mirror = document.createElement('div');
  copyMirrorStyle(mirror, control, style);
  const source = document.createTextNode(text);
  mirror.appendChild(source);
  document.body.appendChild(mirror);
  const mirrorBox = mirror.getBoundingClientRect();
  const range = document.createRange();
  const lines: MeasuredLine[] = [];
  let offset = 0;

  try {
    for (const character of text) {
      range.setStart(source, offset);
      offset += character.length;
      range.setEnd(source, offset);
      const rectangle = range.getBoundingClientRect();
      let line = lines[lines.length - 1];
      if (!line || Math.abs(line.top - rectangle.top) > 1) {
        line = { text: '', left: rectangle.left - mirrorBox.left, top: rectangle.top - mirrorBox.top };
        lines.push(line);
      }
      line.text += character;
      if (Array.from(line.text).length > MAX_EDITABLE_LINE) return null;
    }
    return lines;
  } finally {
    range.detach();
    mirror.remove();
  }
}

function textStart(
  direction: string,
  textAlign: string,
  controlWidth: number,
  paddingStart: number,
  paddingEnd: number,
  advance: number,
): number {
  const available = Math.max(0, controlWidth - paddingStart - paddingEnd);
  const resolved = textAlign === 'start'
    ? (direction === 'rtl' ? 'right' : 'left')
    : textAlign === 'end'
      ? (direction === 'rtl' ? 'left' : 'right')
      : textAlign;
  if (resolved === 'center') return paddingStart + (available - advance) / 2;
  if (resolved === 'right') return controlWidth - paddingEnd - advance;
  return paddingStart;
}

function paintEditableText(
  canvas: HTMLCanvasElement,
  control: EditableControl,
  seed: string | number,
  multiline: boolean,
): boolean {
  const width = control.clientWidth;
  const height = control.clientHeight;
  const context = canvas.getContext('2d');
  if (!context || context.isContextLost?.() || width < 2 || height < 2) return false;
  Object.assign(canvas.style, {
    left: `${control.offsetLeft}px`,
    top: `${control.offsetTop}px`,
    right: 'auto',
    bottom: 'auto',
    width: `${width}px`,
    height: `${height}px`,
  });
  const content = editableText(control);
  if (Array.from(content.text).length > MAX_EDITABLE_TEXT) return false;

  const style = getComputedStyle(control);
  if (style.direction === 'rtl' || complexScript.test(content.text)) return false;
  const fontSize = Number.parseFloat(style.fontSize);
  if (!Number.isFinite(fontSize) || fontSize <= 0) return false;
  const dpr = effectiveDpr(2);
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  if (!content.text) return true;

  const family = style.fontFamily;
  const color = content.placeholder
    ? style.getPropertyValue('--inkra-editable-placeholder-color').trim() || style.color
    : style.getPropertyValue('--inkra-editable-text-color').trim() || style.color;
  const paddingStart = numeric(style, 'padding-inline-start') || numeric(style, 'padding-left');
  const paddingEnd = numeric(style, 'padding-inline-end') || numeric(style, 'padding-right');
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return false;
  measure.font = `400 ${fontSize}px ${family}`;
  measure.fontKerning = 'none';
  if (!multiline && Array.from(content.text).length > MAX_EDITABLE_LINE) return false;
  if (!multiline && style.direction === 'rtl'
    && measure.measureText(content.text).width > control.clientWidth - paddingStart - paddingEnd) return false;
  const measuredLines = multiline
    ? measureTextareaLines(control as HTMLTextAreaElement, content.text, style)
    : [{ text: content.text, left: 0, top: 0 }];
  if (!measuredLines) return false;
  const baseSeed = seedToNumber(seed);

  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.clip();
  for (let index = 0; index < measuredLines.length; index += 1) {
    const line = measuredLines[index];
    const visible = multiline && (control as HTMLTextAreaElement).wrap !== 'off'
      ? { text: line.text, offset: 0 }
      : visibleText(line.text, measure, control.scrollLeft, width - paddingStart - paddingEnd);
    if (!visible?.text) continue;
    const sprite = renderPencilText(visible.text, {
      size: fontSize,
      family,
      color,
      seed: baseSeed + index * 131,
      dpr,
      cache: false,
    });
    const start = multiline
      ? line.left
      : textStart(style.direction, style.textAlign, control.clientWidth, paddingStart, paddingEnd, sprite.advance);
    const x = start + visible.offset - control.scrollLeft - sprite.padding;
    const y = multiline
      ? line.top - control.scrollTop - sprite.padding
      : (control.clientHeight - sprite.height) / 2;
    if (y > height || y + sprite.height < 0) continue;
    context.drawImage(sprite.ink, x, y, sprite.width, sprite.height);
  }
  context.restore();
  return true;
}

export function EditablePencilText({
  controlRef,
  defaultValue,
  multiline = false,
  placeholder,
  seed,
  value,
}: EditablePencilTextProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scheduleRef = useRef<() => void>(() => {});
  const composingRef = useRef(false);

  useBrowserLayoutEffect(() => {
    const control = controlRef.current;
    const canvas = canvasRef.current;
    if (!control || !canvas) return undefined;
    const root = control.closest<HTMLElement>('.inkra-field-control-hit');
    let frame = 0;
    let pending: (() => void) | null = null;
    let disposed = false;

    const paint = () => {
      pending = null;
      if (disposed || composingRef.current) return;
      try {
        const ready = paintEditableText(canvas, control, seed, multiline);
        if (ready) root?.setAttribute('data-pencil-editable-ready', 'true');
        else root?.removeAttribute('data-pencil-editable-ready');
      } catch {
        root?.removeAttribute('data-pencil-editable-ready');
      }
    };
    const schedule = () => {
      if (disposed || composingRef.current || frame || pending) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        pending = queueTextPaint(paint);
      });
    };
    scheduleRef.current = schedule;
    const invalidate = () => {
      root?.removeAttribute('data-pencil-editable-ready');
      schedule();
    };
    const showNativeComposition = () => {
      composingRef.current = true;
      pending?.();
      pending = null;
      root?.setAttribute('data-composing', 'true');
      root?.removeAttribute('data-pencil-editable-ready');
    };
    const finishComposition = () => {
      composingRef.current = false;
      root?.removeAttribute('data-composing');
      schedule();
    };
    const reset = () => window.setTimeout(invalidate, 0);
    const form = control.form;
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(invalidate);
    resize?.observe(control);
    const appearance = new MutationObserver(invalidate);
    appearance.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-theme', 'data-inkra-theme'],
    });
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    colorScheme.addEventListener('change', invalidate);
    control.addEventListener('input', invalidate);
    control.addEventListener('scroll', invalidate, { passive: true });
    control.addEventListener('compositionstart', showNativeComposition);
    control.addEventListener('compositionend', finishComposition);
    form?.addEventListener('reset', reset);
    document.fonts?.addEventListener('loadingdone', invalidate);
    document.fonts?.addEventListener('loadingerror', invalidate);
    document.fonts?.ready.then(() => { if (!disposed) invalidate(); });
    const stopRecovery = observeCanvasRecovery(invalidate);
    invalidate();

    return () => {
      disposed = true;
      stopRecovery();
      pending?.();
      resize?.disconnect();
      appearance.disconnect();
      colorScheme.removeEventListener('change', invalidate);
      control.removeEventListener('input', invalidate);
      control.removeEventListener('scroll', invalidate);
      control.removeEventListener('compositionstart', showNativeComposition);
      control.removeEventListener('compositionend', finishComposition);
      form?.removeEventListener('reset', reset);
      document.fonts?.removeEventListener('loadingdone', invalidate);
      document.fonts?.removeEventListener('loadingerror', invalidate);
      cancelAnimationFrame(frame);
      root?.removeAttribute('data-pencil-editable-ready');
      root?.removeAttribute('data-composing');
      composingRef.current = false;
      scheduleRef.current = () => {};
    };
  }, [controlRef, multiline, seed]);

  useBrowserLayoutEffect(() => {
    if (composingRef.current) return;
    controlRef.current?.closest<HTMLElement>('.inkra-field-control-hit')
      ?.removeAttribute('data-pencil-editable-ready');
    scheduleRef.current();
  }, [controlRef, defaultValue, placeholder, value]);

  return <canvas aria-hidden="true" className="inkra-editable-text" data-renderer="inkra-editable-lettering" ref={canvasRef} />;
}
