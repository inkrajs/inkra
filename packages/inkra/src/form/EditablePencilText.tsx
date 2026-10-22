import { useRef } from 'react';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import type { RefObject } from 'react';

import { BoundedCache, canvasByteCost, canvasIsUsable, effectiveDpr } from '../internal/cache.js';
import { observeCanvasRecovery } from '../internal/recovery.js';
import { seedToNumber } from '../internal/random.js';
import { pencilLettering, renderPencilText } from '../internal/textRenderer.js';
import type { PencilTextSprite } from '../internal/textRenderer.js';
import { readRenderToken } from '../internal/renderTokens.js';

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
  start: number;
}

interface CompositionRange {
  value: string;
  start: number;
  end: number;
}

const MAX_EDITABLE_TEXT = 4096;
const MAX_EDITABLE_LINE = 256;
const complexScript = /[\u0300-\u036f\u0590-\u08ff\u0900-\u0dff\u0e00-\u0fff\u1780-\u18af\u200c\u200d\ufe00-\ufe0f]/u;

function numeric(style: CSSStyleDeclaration, property: string): number {
  const value = Number.parseFloat(style.getPropertyValue(property));
  return Number.isFinite(value) ? value : 0;
}

function editableText(control: EditableControl) {
  const placeholder = control.value.length === 0;
  return { text: placeholder ? control.placeholder : control.value, placeholder };
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
        line = { text: '', left: rectangle.left - mirrorBox.left, top: rectangle.top - mirrorBox.top, start: offset - character.length };
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
  buffer: HTMLCanvasElement,
  glyphs: BoundedCache<PencilTextSprite>,
  control: EditableControl,
  seed: string | number,
  multiline: boolean,
  composition: CompositionRange | null,
): boolean {
  const width = control.clientWidth;
  const height = control.clientHeight;
  const target = canvas.getContext('2d');
  const context = buffer.getContext('2d');
  const dpr = effectiveDpr(2);
  if (!target || target.isContextLost?.() || !context || context.isContextLost?.()
    || width < 2 || height < 2 || width * height * dpr ** 2 > 2 * 1024 * 1024) return false;
  const content = editableText(control);
  if (content.text.length > MAX_EDITABLE_TEXT) return false;
  const style = getComputedStyle(control);
  if (style.direction === 'rtl' || complexScript.test(content.text)) return false;
  const fontSize = Number.parseFloat(style.fontSize);
  if (!Number.isFinite(fontSize) || fontSize <= 0) return false;
  const family = style.fontFamily;
  const color = content.placeholder
    ? style.getPropertyValue('--inkra-editable-placeholder-color').trim() || style.color
    : style.getPropertyValue('--inkra-editable-text-color').trim() || style.color;
  const settings = {
    variation: readRenderToken(style, '--inkra-letter-variation', pencilLettering.variation, 0, 1),
    breaks: readRenderToken(style, '--inkra-letter-breaks', pencilLettering.breaks, 0, 1),
    outline: readRenderToken(style, '--inkra-letter-outline', pencilLettering.outline, 0, 1),
    fill: readRenderToken(style, '--inkra-letter-fill', pencilLettering.fill, 0, 1),
    grain: readRenderToken(style, '--inkra-letter-grain', pencilLettering.grain, 0, 1),
  };
  buffer.width = Math.ceil(width * dpr);
  buffer.height = Math.ceil(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.font = `400 ${fontSize}px ${family}`;
  context.fontKerning = 'none';
  context.fillStyle = color;
  const metrics = context.measureText('Mg');
  const ascent = metrics.fontBoundingBoxAscent ?? fontSize;
  const descent = metrics.fontBoundingBoxDescent ?? fontSize * 0.25;
  const paddingStart = numeric(style, 'padding-inline-start') || numeric(style, 'padding-left');
  const paddingEnd = numeric(style, 'padding-inline-end') || numeric(style, 'padding-right');
  if (!multiline && content.text.length > MAX_EDITABLE_LINE) return false;
  const lines = multiline
    ? measureTextareaLines(control as HTMLTextAreaElement, content.text, style)
    : [{ text: content.text, left: 0, top: 0, start: 0 }];
  if (!lines) return false;
  const baseSeed = seedToNumber(seed);
  const glyphAppearance = JSON.stringify([fontSize, family, color, baseSeed, dpr, settings]);
  const composingStart = composition?.start ?? -1;
  const composingEnd = composition
    ? Math.max(composition.start, control.value.length - (composition.value.length - composition.end))
    : -1;

  for (const line of lines) {
    const baseline = multiline
      ? line.top - control.scrollTop + ascent
      : (height - ascent - descent) / 2 + ascent;
    if (baseline - ascent > height || baseline + descent < 0) continue;
    let left = (multiline ? line.left : textStart(style.direction, style.textAlign,
      width, paddingStart, paddingEnd, context.measureText(line.text).width)) - control.scrollLeft;
    let offset = line.start;
    for (const character of line.text) {
      const advance = character === '\n' || character === '\r' ? 0
        : character === '\t' ? numeric(style, 'tab-size') * context.measureText(' ').width
          : context.measureText(character).width;
      if (advance && left + advance >= 0 && left <= width) {
        if (composition && !content.placeholder && offset >= composingStart && offset < composingEnd) {
          // Keep preedit visibly underlined without changing the native IME session.
          context.fillText(character, left, baseline);
          context.fillRect(left, baseline + 2, advance, 1 / dpr);
        } else if (character.trim()) {
          const key = glyphAppearance + character;
          let glyph = glyphs.get(key);
          if (!glyph || !canvasIsUsable(glyph.ink)) {
            glyph = renderPencilText(character, {
              size: fontSize, family, color, seed: baseSeed ^ seedToNumber(character),
              dpr, settings, cache: false,
            });
            glyphs.set(key, glyph, canvasByteCost(glyph.ink));
          }
          context.drawImage(glyph.ink, left - glyph.padding, baseline - glyph.ascent - glyph.padding, glyph.width, glyph.height);
        }
      }
      left += advance;
      offset += character.length;
    }
  }

  // Commit only a complete frame. The visible canvas never waits empty for idle work.
  if (canvas.width !== buffer.width) canvas.width = buffer.width;
  if (canvas.height !== buffer.height) canvas.height = buffer.height;
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.clearRect(0, 0, canvas.width, canvas.height);
  target.drawImage(buffer, 0, 0);
  Object.assign(canvas.style, {
    left: `${control.offsetLeft}px`, top: `${control.offsetTop}px`,
    right: 'auto', bottom: 'auto', width: `${width}px`, height: `${height}px`,
  });
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
  const composingRef = useRef<CompositionRange | null>(null);

  useBrowserLayoutEffect(() => {
    const control = controlRef.current;
    const canvas = canvasRef.current;
    if (!control || !canvas) return undefined;
    const root = control.closest<HTMLElement>('.inkra-field-control-hit');
    const buffer = document.createElement('canvas');
    // Private, bounded, per-editor glyphs. Never enter the shared text cache.
    let glyphs = new BoundedCache<PencilTextSprite>(128, 4 * 1024 * 1024);
    let disposed = false;
    let lastAppearance = '';
    const appearanceKey = () => {
      const style = getComputedStyle(control);
      return JSON.stringify([
        control.clientWidth, control.clientHeight, control.offsetLeft, control.offsetTop,
        control.scrollLeft, control.scrollTop, control.value, control.placeholder, effectiveDpr(2),
        composingRef.current?.start, composingRef.current?.end, composingRef.current?.value.length,
        ...['font-family', 'font-size', 'line-height', 'text-align', 'text-indent',
          'letter-spacing', 'white-space', 'word-break', 'overflow-wrap', 'direction', 'tab-size',
          'padding-top', 'padding-left', 'padding-right', 'padding-bottom',
          '--inkra-letter-variation', '--inkra-letter-breaks', '--inkra-letter-outline',
          '--inkra-letter-fill', '--inkra-letter-grain',
          '--inkra-editable-text-color', '--inkra-editable-placeholder-color'].map(name => style.getPropertyValue(name)),
      ]);
    };
    const paint = () => {
      if (disposed) return;
      const key = appearanceKey();
      if (key === lastAppearance && root?.hasAttribute('data-pencil-editable-ready')) return;
      try {
        if (paintEditableText(canvas, buffer, glyphs, control, seed, multiline, composingRef.current)) {
          root?.setAttribute('data-pencil-editable-ready', 'true');
          lastAppearance = key;
        } else {
          root?.removeAttribute('data-pencil-editable-ready');
          lastAppearance = '';
        }
      } catch {
        root?.removeAttribute('data-pencil-editable-ready');
        lastAppearance = '';
      }
    };
    scheduleRef.current = paint;
    const startComposition = () => {
      composingRef.current = {
        value: control.value,
        start: control.selectionStart ?? control.value.length,
        end: control.selectionEnd ?? control.value.length,
      };
      root?.setAttribute('data-composing', 'true');
      paint();
    };
    const finishComposition = () => {
      composingRef.current = null;
      root?.removeAttribute('data-composing');
      paint();
    };
    const refreshFonts = () => {
      glyphs = new BoundedCache<PencilTextSprite>(128, 4 * 1024 * 1024);
      lastAppearance = '';
      paint();
    };
    const reset = () => queueMicrotask(() => {
      if (disposed) return;
      composingRef.current = null;
      root?.removeAttribute('data-composing');
      refreshFonts();
    });
    const form = control.form;
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(paint);
    resize?.observe(control);
    const appearance = new MutationObserver(paint);
    for (let element: HTMLElement | null = control; element; element = element.parentElement) {
      appearance.observe(element, { attributes: true, attributeFilter: ['style', 'class', 'dir', 'data-theme', 'data-inkra-theme'] });
    }
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    colorScheme.addEventListener('change', paint);
    control.addEventListener('input', paint);
    control.addEventListener('scroll', paint, { passive: true });
    control.addEventListener('compositionstart', startComposition);
    control.addEventListener('compositionend', finishComposition);
    form?.addEventListener('reset', reset);
    document.fonts?.addEventListener('loadingdone', refreshFonts);
    document.fonts?.addEventListener('loadingerror', refreshFonts);
    document.fonts?.ready.then(() => { if (!disposed) refreshFonts(); });
    const stopRecovery = observeCanvasRecovery(refreshFonts);
    paint();

    return () => {
      disposed = true;
      stopRecovery();
      resize?.disconnect();
      appearance.disconnect();
      colorScheme.removeEventListener('change', paint);
      control.removeEventListener('input', paint);
      control.removeEventListener('scroll', paint);
      control.removeEventListener('compositionstart', startComposition);
      control.removeEventListener('compositionend', finishComposition);
      form?.removeEventListener('reset', reset);
      document.fonts?.removeEventListener('loadingdone', refreshFonts);
      document.fonts?.removeEventListener('loadingerror', refreshFonts);
      root?.removeAttribute('data-pencil-editable-ready');
      root?.removeAttribute('data-composing');
      composingRef.current = null;
      glyphs = new BoundedCache<PencilTextSprite>(0, 0);
      buffer.width = buffer.height = 0;
      scheduleRef.current = () => {};
    };
  }, [controlRef, multiline, seed]);

  useBrowserLayoutEffect(() => {
    scheduleRef.current();
  }, [controlRef, defaultValue, placeholder, value]);

  return <canvas aria-hidden="true" className="inkra-editable-text" data-renderer="inkra-editable-lettering" ref={canvasRef} />;
}
