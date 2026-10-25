import { useInkraLocale } from '../i18n/index.js';
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode, TextareaHTMLAttributes } from 'react';

import { PencilSurface } from '../PencilSurface.js';
import { PencilLine } from '../PencilLine.js';
import { PencilText } from '../PencilText.js';
import { PencilIcon } from '../PencilIcon.js';
import { Button } from '../Button.js';
import { Progress } from '../display/index.js';
import { useResolvedControlProps } from './controlProps.js';
import { EditablePencilText } from './EditablePencilText.js';
import { InputAction } from './InputAction.js';
import type { FieldControlStateProps } from './types.js';
import { textareaResizeHeight, useTextareaSizing } from './textareaSizing.js';
import type { TextareaAutoSizeOptions } from './textareaSizing.js';

export type { TextareaAutoSizeOptions } from './textareaSizing.js';

export interface TextareaCountDetails {
  count: number;
  maxLength: number;
  remaining: number;
}

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    FieldControlStateProps {
  variant?: 'outline' | 'underline';
  endAction?: ReactNode;
  countMode?: 'remaining' | 'fraction' | 'progress' | 'none';
  countDisplay?: 'auto' | 'always';
  /** Ratio of maxLength at which the automatic counter appears. */
  countThreshold?: number;
  getCountLabel?: (details: TextareaCountDetails) => string;
  resize?: 'none' | 'vertical';
  resizeLabel?: string;
  /** Grow and shrink with content. Takes precedence over manual resize and inline height. */
  autoSize?: boolean | TextareaAutoSizeOptions;
}

const resizePaths = [{ d: 'M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4' }];

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  inkraProps,
  ref,
) {
  const { t } = useInkraLocale();
  const {
    'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage,
    'aria-invalid': ariaInvalid,
    className,
    disabled,
    id,
    invalid = false,
    readOnly,
    required,
    seed,
    size = 'md',
    variant = 'outline',
    endAction,
    countMode = 'remaining',
    countDisplay = 'auto',
    countThreshold = 0.8,
    getCountLabel = ({ remaining }) => t(remaining < 0 ? 'textarea.overLimit' : 'textarea.countRemaining', { count: Math.abs(remaining) }),
    resize = 'none',
    resizeLabel = t('textarea.resize'),
    autoSize = false,
    ...props
  } = inkraProps;
  const generatedId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [uncontrolledCount, setUncontrolledCount] = useState(() => String(props.defaultValue ?? '').length);
  const [height, setHeight] = useState<number>();
  const [measuredHeight, setMeasuredHeight] = useState<number>();
  const drag = useRef<{ y: number; height: number } | null>(null);
  const sizing = useTextareaSizing(textareaRef, autoSize, props.rows, props.form, resize === 'vertical');
  const manualResize = resize === 'vertical' && !sizing.enabled;
  const controlled = props.value != null;
  const count = controlled ? String(props.value).length : uncontrolledCount;
  const maximum = props.maxLength;
  const hasCount = countMode !== 'none' && typeof maximum === 'number' && Number.isFinite(maximum) && maximum >= 0;
  const threshold = Number.isFinite(countThreshold) ? Math.max(0, Math.min(1, countThreshold)) : 0.8;
  const showCount = hasCount && (countDisplay === 'always' || count >= maximum * threshold);
  const countId = `inkra-textarea-${generatedId}-count`;
  const controlId = id ?? `inkra-textarea-${generatedId}`;
  const remaining = hasCount ? maximum - count : 0;
  const countLabel = hasCount ? getCountLabel({ count, maxLength: maximum, remaining }) : '';
  const minimumHeight = (sizing.minimumHeight ?? (size === 'sm' ? 80 : size === 'lg' ? 112 : 96)) + sizing.boxAdjustment;
  const maximumHeight = Math.max(1200, minimumHeight);
  const resizeTo = (next: number) => setHeight(textareaResizeHeight(next, minimumHeight, maximumHeight, sizing.boxAdjustment));
  useEffect(() => {
    const control = textareaRef.current;
    if (!manualResize || !control) return;
    const measure = () => setMeasuredHeight(control.getBoundingClientRect().height);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(control);
    return () => observer.disconnect();
  }, [manualResize]);
  useEffect(() => {
    const control = textareaRef.current;
    const form = control?.form;
    let frame = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setUncontrolledCount(control?.value.length ?? 0));
    };
    form?.addEventListener('reset', reset);
    if (!controlled) setUncontrolledCount(control?.value.length ?? 0);
    return () => {
      cancelAnimationFrame(frame);
      form?.removeEventListener('reset', reset);
    };
  }, [controlled, props.defaultValue, props.form]);
  useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement);
  const state = useResolvedControlProps({
    id: controlId,
    required,
    disabled,
    readOnly,
    invalid,
    'aria-describedby': ariaDescribedBy,
    'aria-errormessage': ariaErrorMessage,
    'aria-invalid': ariaInvalid,
  });
  const resolvedSeed = seed ?? `inkra-textarea-${state.id ?? generatedId}`;
  const classes = ['inkra-textarea', className].filter(Boolean).join(' ');

  return (
    <div
      className="inkra-field-control-hit inkra-field-control-hit--textarea"
      data-disabled={state.disabled || undefined}
      data-invalid={state.invalid || undefined}
      data-readonly={state.readOnly || undefined}
      data-size={size}
      data-variant={variant}
      data-end-action={endAction != null || undefined}
      data-row-sizing={sizing.rowSizing || undefined}
    >
      <PencilSurface
        className="inkra-field-control inkra-field-control--textarea"
        seed={resolvedSeed}
        variant={variant === 'underline' ? 'ghost' : state.invalid ? 'danger' : 'outline'}
      >
        <textarea
          {...props}
          aria-describedby={[state.describedBy, showCount && countId].filter(Boolean).join(' ') || undefined}
          aria-errormessage={state.errorMessage}
          aria-invalid={state.ariaInvalid}
          className={classes}
          disabled={state.disabled}
          id={state.id}
          readOnly={state.readOnly}
          ref={textareaRef}
          required={state.required}
          rows={sizing.enabled ? sizing.minRows : props.rows}
          style={{ ...props.style, ...(manualResize && height !== undefined ? { height } : {}), ...sizing.style, resize: 'none' }}
          onInput={event => {
            if (!controlled) setUncontrolledCount(event.currentTarget.value.length);
            props.onInput?.(event);
            // Wait for React to accept or restore a controlled value before measuring.
            sizing.schedule();
          }}
        />
        <EditablePencilText
          controlRef={textareaRef}
          defaultValue={props.defaultValue}
          multiline
          placeholder={props.placeholder}
          seed={`${resolvedSeed}-editable`}
          value={props.value}
        />
        {endAction != null && <div className="inkra-textarea__end-action">
          <InputAction disabled={Boolean(state.disabled)} seed={`${resolvedSeed}-action`}>{endAction}</InputAction>
        </div>}
        {(hasCount || manualResize) && <div className="inkra-textarea__footer">
          {hasCount && <div className="inkra-textarea__count" id={countId}
            data-visible={showCount} data-limit={remaining <= 0 ? 'reached' : 'near'}
            aria-hidden={!showCount || undefined}>
            {countMode === 'progress' && <Progress size="sm"
              value={maximum === 0 ? 1 : count} max={maximum === 0 ? 1 : maximum}
              aria-label={countLabel} aria-valuetext={countLabel} />}
            <PencilText>{countMode === 'fraction' ? `${count} / ${maximum}` : countLabel}</PencilText>
          </div>}
          {manualResize && <Button className="inkra-textarea__resize" variant="ghost" size="icon"
            role="slider" aria-label={resizeLabel} title={resizeLabel} aria-controls={state.id}
            aria-orientation="vertical" aria-valuemin={minimumHeight} aria-valuemax={maximumHeight}
            aria-valuenow={Math.round(measuredHeight ?? minimumHeight)} disabled={state.disabled}
            onPointerDown={event => {
              if (event.button !== 0) return;
              drag.current = { y: event.clientY, height: textareaRef.current?.getBoundingClientRect().height ?? minimumHeight };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
              if (drag.current) resizeTo(drag.current.height + event.clientY - drag.current.y);
            }}
            onPointerUp={event => {
              drag.current = null;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={() => { drag.current = null; }}
            onLostPointerCapture={() => { drag.current = null; }}
            onKeyDown={event => {
              const current = textareaRef.current?.getBoundingClientRect().height ?? minimumHeight;
              if (event.key === 'ArrowUp') resizeTo(current - 20);
              else if (event.key === 'ArrowDown') resizeTo(current + 20);
              else if (event.key === 'Home') resizeTo(minimumHeight);
              else if (event.key === 'End') resizeTo(maximumHeight);
              else return;
              event.preventDefault();
            }}>
            <PencilIcon paths={resizePaths} size={22} />
          </Button>}
        </div>}
        {variant === 'underline' && <PencilLine className="inkra-textarea__underline" seed={`${resolvedSeed}-underline`} />}
      </PencilSurface>
    </div>
  );
});
