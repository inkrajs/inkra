import { useCallback, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';

export interface TextareaAutoSizeOptions {
  /** Minimum visible text rows. Falls back to rows, then 1. */
  minRows?: number;
  /** Maximum visible text rows, including soft wraps. Omit for unlimited growth. */
  maxRows?: number;
}

function positiveRows(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function resolveTextareaRows(autoSize: boolean | TextareaAutoSizeOptions | undefined, rows?: number) {
  const options = typeof autoSize === 'object' ? autoSize : undefined;
  const minRows = positiveRows(options?.minRows, positiveRows(rows, 1));
  return { minRows, maxRows: Math.max(minRows, positiveRows(options?.maxRows, Infinity)) };
}

const sizingProperties = [
  'boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'fontVariant',
  'fontFeatureSettings', 'fontVariationSettings', 'fontKerning', 'lineHeight', 'letterSpacing',
  'wordSpacing', 'textIndent', 'textTransform', 'textAlign', 'tabSize', 'direction',
  'overflowWrap', 'wordBreak', 'whiteSpace', 'scrollbarGutter',
] as const;

/** Measure a native textarea without changing its value, selection, scroll position or height. */
export function measureTextareaSize(control: HTMLTextAreaElement, minRows: number, maxRows: number, measureContent = true) {
  const document = control.ownerDocument;
  const view = document.defaultView;
  if (!view || !document.body || control.getClientRects().length === 0) return undefined;
  const computed = view.getComputedStyle(control);
  if (Number.parseFloat(computed.width) <= 0) return undefined;
  const number = (value: string) => Number.parseFloat(value) || 0;
  const padding = number(computed.paddingTop) + number(computed.paddingBottom);
  const border = number(computed.borderTopWidth) + number(computed.borderBottomWidth);
  const mirror = document.createElement('textarea');
  mirror.setAttribute('aria-hidden', 'true');
  mirror.tabIndex = -1;
  mirror.rows = 1;
  mirror.wrap = control.wrap;
  for (const property of sizingProperties) mirror.style[property] = computed[property];
  Object.assign(mirror.style, {
    position: 'fixed', left: '-100000px', top: '0', visibility: 'hidden',
    pointerEvents: 'none', height: '0', minHeight: '0', maxHeight: 'none',
    overflow: 'hidden', resize: 'none',
  });
  document.body.appendChild(mirror);
  try {
    mirror.value = 'x';
    let lineHeight = number(computed.lineHeight);
    if (!lineHeight) {
      // scrollHeight rounds to integer pixels. A bounded multi-line probe avoids
      // multiplying that rounding error by maxRows when line-height is normal.
      mirror.value = Array(100).fill('x').join('\n');
      lineHeight = Math.max(1, (mirror.scrollHeight - padding) / 100);
    }
    // Placeholder copy does not change the height of an otherwise empty editor.
    mirror.value = measureContent ? control.value || ' ' : ' ';
    const contentHeight = Math.max(lineHeight, mirror.scrollHeight - padding);
    const extra = computed.boxSizing === 'border-box' ? padding + border : 0;
    const minimumHeight = Math.ceil(minRows * lineHeight + extra);
    const maximumHeight = Math.ceil(maxRows * lineHeight + extra);
    return {
      minimumHeight,
      boxAdjustment: computed.boxSizing === 'border-box' ? 0 : padding + border,
      height: Math.min(maximumHeight, Math.max(minimumHeight, Math.ceil(contentHeight + extra))),
      overflowY: contentHeight > maxRows * lineHeight + 1 ? 'auto' as const : 'hidden' as const,
    };
  } finally {
    mirror.remove();
  }
}

export function useTextareaSizing(
  controlRef: RefObject<HTMLTextAreaElement | null>,
  autoSize: boolean | TextareaAutoSizeOptions | undefined,
  rows: number | undefined,
  form: string | undefined,
  manualResize = false,
) {
  const enabled = Boolean(autoSize);
  const rowSizing = enabled || rows !== undefined;
  const measureEnabled = enabled || (rowSizing && manualResize);
  const { minRows, maxRows } = resolveTextareaRows(autoSize, rows);
  const [measurement, setMeasurement] = useState<ReturnType<typeof measureTextareaSize>>();
  const measure = useCallback(() => {
    const control = controlRef.current;
    if (!measureEnabled || !control) return;
    const next = measureTextareaSize(control, minRows, maxRows, enabled);
    if (next) setMeasurement(previous => previous?.height === next.height && previous.minimumHeight === next.minimumHeight
      && previous.boxAdjustment === next.boxAdjustment
      && previous.overflowY === next.overflowY ? previous : next);
  }, [controlRef, measureEnabled, enabled, minRows, maxRows]);
  const latestMeasure = useRef(measure);
  latestMeasure.current = measure;
  const scheduleRef = useRef<() => void>(() => {});
  const schedule = useCallback(() => scheduleRef.current(), []);

  // Includes controlled/default value, class, style, size and row-option updates.
  useBrowserLayoutEffect(() => { measure(); });
  useBrowserLayoutEffect(() => {
    const control = controlRef.current;
    const view = control?.ownerDocument.defaultView;
    if (!measureEnabled || !control || !view) return;
    let frame = 0;
    let disposed = false;
    const schedule = () => {
      if (!frame && !disposed) frame = view.requestAnimationFrame(() => {
        frame = 0;
        if (!disposed) latestMeasure.current();
      });
    };
    scheduleRef.current = schedule;
    // Height changes are our output; only width changes should schedule another measurement.
    let width = control.getBoundingClientRect().width;
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => {
      const nextWidth = control.getBoundingClientRect().width;
      if (nextWidth !== width) { width = nextWidth; schedule(); }
    });
    observer?.observe(control);
    const inheritedStyle = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(schedule);
    // Do not observe our own inline height: React updates already measure it.
    for (let element = control.parentElement; element; element = element.parentElement) {
      inheritedStyle?.observe(element, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-inkra-theme'] });
    }
    const fonts = control.ownerDocument.fonts;
    void fonts?.ready.then(() => { if (!disposed) schedule(); });
    fonts?.addEventListener('loadingdone', schedule);
    fonts?.addEventListener('loadingerror', schedule);
    view.addEventListener('resize', schedule);
    // The frame runs after the native reset default action, including cancelled resets.
    const ownerForm = control.form;
    ownerForm?.addEventListener('reset', schedule);
    return () => {
      disposed = true;
      scheduleRef.current = () => {};
      view.cancelAnimationFrame(frame);
      observer?.disconnect();
      inheritedStyle?.disconnect();
      fonts?.removeEventListener('loadingdone', schedule);
      fonts?.removeEventListener('loadingerror', schedule);
      view.removeEventListener('resize', schedule);
      ownerForm?.removeEventListener('reset', schedule);
    };
  }, [controlRef, measureEnabled, form]);

  const style: CSSProperties | undefined = enabled && measurement ? {
    height: measurement.height, minHeight: measurement.minimumHeight, maxHeight: 'none', overflowY: measurement.overflowY,
  } : undefined;
  return { enabled, rowSizing, minRows, minimumHeight: rowSizing ? measurement?.minimumHeight : undefined,
    boxAdjustment: rowSizing ? measurement?.boxAdjustment ?? 0 : 0, style, schedule };
}

/** Manual handles and ARIA use visible border-box pixels; CSS height may use content-box pixels. */
export function textareaResizeHeight(visibleHeight: number, minimum: number, maximum: number, boxAdjustment: number) {
  return Math.max(minimum, Math.min(maximum, visibleHeight)) - boxAdjustment;
}
