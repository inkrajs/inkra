import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { ProgressRing } from '../display/ProgressRing.js';
import { advanceArcPosition, initialArcPosition, normalizeAngle, snapCircularValue, stepCircularValue } from './circularMath.js';

export interface CircularSliderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue' | 'onChange'> {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  onValueCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  readOnly?: boolean;
  name?: string;
  form?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Outer size in CSS pixels, bounded to 96–512. Defaults to 128/160/192 by size. */
  diameter?: number;
  /** Degrees from the top, increasing clockwise. Defaults to 225. */
  startAngle?: number;
  /** Available arc in degrees, from 1 to 360. Defaults to 270. */
  sweepAngle?: number;
  /** Physical direction of increasing values; unaffected by the page's text direction. */
  clockwise?: boolean;
  /** Shows the default value when centerContent is not specified. */
  showValue?: boolean;
  /** Decorative, non-interactive icon placed above the center content. */
  centerIcon?: ReactNode;
  /** Overrides the default value. Strings/numbers use PencilText; null/false hide it.
   * Custom nodes must be non-interactive; the center is inert and hidden from accessibility APIs.
   */
  centerContent?: ReactNode | ((value: number) => ReactNode);
  /** Used for the center label and aria-valuetext. */
  getValueLabel?: (value: number) => string;
  seed?: string | number;
}

type Gesture = { id: number; angle: number; position: number; value: number; changed: boolean };
const diameters = { sm: 128, md: 160, lg: 192 };
const thicknesses = { sm: 5, md: 6, lg: 8 };
const thumbSizes = { sm: 20, md: 24, lg: 28 };

export const CircularSlider = forwardRef<HTMLDivElement, CircularSliderProps>(function CircularSlider({
  value, defaultValue, onValueChange, onValueCommit, min: suppliedMin = 0, max: suppliedMax = 100,
  step: suppliedStep = 1, disabled = false, readOnly = false, name, form, size = 'md', diameter,
  startAngle = 225, sweepAngle = 270, clockwise = true, showValue = true, centerIcon, centerContent, getValueLabel, seed,
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, 'aria-valuetext': ariaValueText,
  className, style, tabIndex, onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
  onLostPointerCapture, onKeyDown, ...props
}, forwardedRef) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const gesture = useRef<Gesture | null>(null);
  useImperativeHandle(forwardedRef, () => rootRef.current as HTMLDivElement);
  const min = Number.isFinite(suppliedMin) ? suppliedMin : 0;
  const max = Number.isFinite(suppliedMax) && Number.isFinite(suppliedMax - min) ? Math.max(min, suppliedMax) : min;
  const step = Number.isFinite(suppliedStep) && suppliedStep > 0 ? suppliedStep : 1;
  const initialValue = useRef(defaultValue ?? min);
  const [uncontrolledValue, setUncontrolledValue] = useState(initialValue.current);
  const controlled = value !== undefined;
  const current = snapCircularValue(value ?? uncontrolledValue, min, max, step);
  const latest = useRef({ current, controlled, min, max, step });
  latest.current = { current, controlled, min, max, step };
  const blocked = disabled || readOnly || min === max;
  const resolvedDiameter = Math.min(512, Math.max(96, Number.isFinite(diameter) ? diameter! : diameters[size]));
  const start = normalizeAngle(Number.isFinite(startAngle) ? startAngle : 225);
  const sweep = Math.min(360, Math.max(1, Number.isFinite(sweepAngle) ? sweepAngle : 270));
  const ringDiameter = resolvedDiameter - 32;
  // Explicitly tiny diameters scale visual weight rather than consuming the center slot.
  const thickness = Math.min(thicknesses[size], 5 + (resolvedDiameter - 96) / 4);
  const thumbSize = Math.min(thumbSizes[size], 16 + (resolvedDiameter - 96) / 2);
  const radius = ringDiameter / 2 - thickness - 4;
  const progress = max > min ? (current - min) / (max - min) : 0;
  const angle = (start + progress * sweep * (clockwise ? 1 : -1)) * Math.PI / 180;
  const label = getValueLabel?.(current) ?? String(current);
  const content = centerContent === undefined ? (showValue ? label : null) : typeof centerContent === 'function' ? centerContent(current) : centerContent;
  const hasCenterIcon = centerIcon != null && typeof centerIcon !== 'boolean';
  const hasCenterContent = content != null && typeof content !== 'boolean';
  // Compact icon/value stacks need more vertical room than an inscribed square.
  const centerWidth = Math.max(16, (radius - thickness - 4) * 2) + 10;
  const centerHeight = Math.max(20, (radius - thickness - 2) * 2);
  const combinedCenter = hasCenterIcon && hasCenterContent;
  const requestedIconSize = Math.min(24, Math.max(12, 16 + (resolvedDiameter - 104) / 4));
  // Account for gap + padding, reserving a complete value line at every supported size.
  const centerIconSize = combinedCenter ? Math.min(requestedIconSize, centerHeight - 20) : 24;
  const centerLineHeight = Math.min(resolvedDiameter <= 112 ? 18 : 24, centerHeight - centerIconSize - 6);
  const centerFontSize = centerLineHeight < 18 ? '12px' : centerLineHeight < 22 ? '14px' : 'var(--inkra-text-lg)';
  const resolvedSeed = seed ?? `inkra-circular-slider-${id}`;

  function releaseCapture(pointerId: number) {
    const root = rootRef.current;
    if (root?.hasPointerCapture?.(pointerId)) root.releasePointerCapture(pointerId);
  }

  useEffect(() => {
    if (!blocked || !gesture.current) return;
    const pointerId = gesture.current.id;
    gesture.current = null;
    releaseCapture(pointerId);
  }, [blocked]);

  useEffect(() => () => {
    const active = gesture.current;
    gesture.current = null;
    if (active) releaseCapture(active.id);
  }, []);

  useEffect(() => {
    const document = inputRef.current?.ownerDocument;
    if (!document) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = (event: Event) => {
      // Resolve ownership at dispatch time, including forms moved or replaced after mount.
      if (event.target !== inputRef.current?.form) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (event.defaultPrevented) return;
        const active = gesture.current;
        gesture.current = null;
        if (active) releaseCapture(active.id);
        const state = latest.current;
        const next = state.controlled ? state.current : snapCircularValue(initialValue.current, state.min, state.max, state.step);
        if (!state.controlled) setUncontrolledValue(next);
        if (inputRef.current) inputRef.current.value = String(next);
      }, 0);
    };
    document.addEventListener('reset', reset, true);
    return () => { clearTimeout(timer); document.removeEventListener('reset', reset, true); };
  }, []);

  function propose(next: number) {
    if (!controlled) setUncontrolledValue(next);
    onValueChange?.(next);
  }

  function pointerPosition(clientX: number, clientY: number) {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    const x = (clientX - rect.left) / rect.width - 0.5;
    const y = (clientY - rect.top) / rect.height - 0.5;
    return { angle: normalizeAngle(Math.atan2(x, -y) * 180 / Math.PI), distance: Math.hypot(x, y) * resolvedDiameter };
  }

  function movePointer(clientX: number, clientY: number) {
    const active = gesture.current;
    const point = pointerPosition(clientX, clientY);
    if (!active || !point || point.distance < Math.max(8, radius * 0.25)) return;
    active.position = advanceArcPosition(active.position, active.angle, point.angle, sweep, clockwise);
    active.angle = point.angle;
    const next = snapCircularValue(min + active.position / sweep * (max - min), min, max, step);
    if (next === active.value) return;
    active.value = next;
    active.changed = true;
    propose(next);
  }

  return <div {...props} ref={rootRef} role="slider"
    className={['inkra-circular-slider', className].filter(Boolean).join(' ')}
    data-size={size} data-disabled={disabled ? '' : undefined} data-readonly={readOnly ? '' : undefined}
    aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : 'Value')} aria-labelledby={ariaLabelledBy}
    aria-valuemin={min} aria-valuemax={max} aria-valuenow={current}
    aria-valuetext={getValueLabel ? label : ariaValueText} aria-disabled={disabled || undefined} aria-readonly={readOnly || undefined}
    tabIndex={disabled ? -1 : tabIndex ?? 0}
    style={{ '--inkra-circular-slider-diameter': `${resolvedDiameter}px`, '--inkra-circular-slider-thumb-size': `${thumbSize}px`, '--inkra-circular-slider-center-width': `${centerWidth}px`, '--inkra-circular-slider-center-height': `${centerHeight + 6}px`, '--inkra-circular-slider-center-icon-size': `${centerIconSize}px`, '--inkra-circular-slider-center-font-size': combinedCenter ? centerFontSize : 'var(--inkra-text-lg)', '--inkra-circular-slider-center-line-height': combinedCenter ? `${centerLineHeight}px` : 'var(--inkra-line-ui)', ...style } as CSSProperties}
    onPointerDown={event => {
      onPointerDown?.(event);
      if (event.defaultPrevented || blocked || gesture.current || event.button !== 0 || event.isPrimary === false) return;
      const point = pointerPosition(event.clientX, event.clientY);
      if (!point || point.distance < Math.max(8, radius - 22) || point.distance > radius + 22) return;
      event.preventDefault();
      event.currentTarget.focus({ preventScroll: true });
      const thumbAngle = start + progress * sweep * (clockwise ? 1 : -1);
      const delta = (point.angle - thumbAngle) * Math.PI / 180;
      const thumbDistance = Math.sqrt(Math.max(0, point.distance ** 2 + radius ** 2 - 2 * point.distance * radius * Math.cos(delta)));
      // The whole 44px thumb target grabs without changing the current value.
      const position = thumbDistance <= 22 ? progress * sweep : initialArcPosition(point.angle, start, sweep, clockwise, progress * sweep);
      const next = snapCircularValue(min + position / sweep * (max - min), min, max, step);
      gesture.current = { id: event.pointerId, angle: point.angle, position, value: next, changed: next !== current };
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is unavailable in some synthetic event environments. */ }
      if (next !== current) propose(next);
    }}
    onPointerMove={event => {
      onPointerMove?.(event);
      if (event.defaultPrevented || blocked || event.pointerId !== gesture.current?.id) return;
      event.preventDefault();
      movePointer(event.clientX, event.clientY);
    }}
    onPointerUp={event => {
      onPointerUp?.(event);
      const active = gesture.current;
      if (!active || active.id !== event.pointerId) return;
      if (!event.defaultPrevented && !blocked) movePointer(event.clientX, event.clientY);
      gesture.current = null;
      releaseCapture(event.pointerId);
      if (!event.defaultPrevented && !blocked && active.changed) onValueCommit?.(active.value);
    }}
    onPointerCancel={event => {
      onPointerCancel?.(event);
      if (event.pointerId !== gesture.current?.id) return;
      gesture.current = null;
      releaseCapture(event.pointerId);
    }}
    onLostPointerCapture={event => {
      onLostPointerCapture?.(event);
      if (event.pointerId === gesture.current?.id) gesture.current = null;
    }}
    onKeyDown={event => {
      onKeyDown?.(event);
      if (event.defaultPrevented || blocked || event.altKey || event.ctrlKey || event.metaKey) return;
      let next: number;
      if (event.key === 'Home') next = min;
      else if (event.key === 'End') next = max;
      else if (['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'PageUp', 'PageDown'].includes(event.key)) {
        const sign = ['ArrowRight', 'ArrowUp', 'PageUp'].includes(event.key) ? 1 : -1;
        const count = event.key.startsWith('Page') || event.shiftKey ? 10 : 1;
        next = stepCircularValue(current, sign * count, min, max, step);
      } else return;
      event.preventDefault();
      if (next !== current) { propose(next); onValueCommit?.(next); }
    }}
  >
    <span className="inkra-circular-slider__arc" aria-hidden="true" style={{ transform: `rotate(${start}deg) scaleX(${clockwise ? 1 : -1})` }}>
      <span className="inkra-circular-slider__track"><ProgressRing diameter={ringDiameter} thickness={thickness} percent={sweep / 3.6} seed={`${resolvedSeed}-track`} /></span>
      <span className="inkra-circular-slider__range"><ProgressRing diameter={ringDiameter} thickness={thickness} percent={progress * sweep / 3.6} seed={`${resolvedSeed}-range`} /></span>
    </span>
    {(hasCenterIcon || hasCenterContent) && <div className="inkra-circular-slider__center" aria-hidden="true" inert>
      {hasCenterIcon && <div className="inkra-circular-slider__center-icon">{centerIcon}</div>}
      {hasCenterContent && <div className="inkra-circular-slider__center-content">
        {typeof content === 'string' || typeof content === 'number'
          ? <PencilText className="inkra-circular-slider__value" ellipsis={centerContent !== undefined}>{String(content)}</PencilText>
          : content}
      </div>}
    </div>}
    <span aria-hidden="true" className="inkra-circular-slider__thumb" style={{ left: `${50 + Math.sin(angle) * radius / resolvedDiameter * 100}%`, top: `${50 - Math.cos(angle) * radius / resolvedDiameter * 100}%` }}>
      <PencilSurface as="span" className="inkra-circular-slider__thumb-surface" variant="paper" radius={thumbSize / 2} seed={`${resolvedSeed}-thumb`}>
        <PencilSurface as="span" className="inkra-circular-slider__focus-ring" variant="outline" radius={thumbSize / 2 + 4} seed={`${resolvedSeed}-focus`} />
      </PencilSurface>
    </span>
    <input ref={inputRef} type="hidden" name={name} form={form} value={current} disabled={disabled} />
  </div>;
});
