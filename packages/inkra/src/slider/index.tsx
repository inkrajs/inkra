import * as SliderPrimitive from '@radix-ui/react-slider';
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

import { PencilSurface } from '../PencilSurface.js';

export type SliderSize = 'sm' | 'md' | 'lg';
export type SliderVariant = 'standard' | 'inset';

export interface SliderProps extends Omit<SliderPrimitive.SliderProps, 'children' | 'asChild'> {
  size?: SliderSize;
  variant?: SliderVariant;
  seed?: string | number;
  thumbLabels?: readonly string[];
  getValueLabel?: (value: number, index: number) => string;
}

export const Slider = forwardRef<HTMLSpanElement, SliderProps>(function Slider(
  {
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'aria-valuetext': ariaValueText,
    className,
    defaultValue,
    dir,
    disabled = false,
    getValueLabel,
    inverted = false,
    min = 0,
    max = 100,
    onValueChange,
    orientation = 'horizontal',
    seed,
    size = 'md',
    thumbLabels,
    value,
    variant = 'standard',
    ...props
  },
  forwardedRef,
) {
  const generatedId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  useImperativeHandle(forwardedRef, () => rootRef.current as HTMLSpanElement);
  const [uncontrolledValue, setUncontrolledValue] = useState(() => defaultValue ?? [min]);
  const [inferredDir, setInferredDir] = useState<'ltr' | 'rtl'>('ltr');
  const values = value ?? uncontrolledValue;
  const resolvedDir = dir ?? inferredDir;
  const resolvedSeed = seed ?? `inkra-slider-${generatedId}`;

  useEffect(() => {
    const root = rootRef.current;
    if (dir || !root) return undefined;
    const refresh = () => setInferredDir(getComputedStyle(root.parentElement ?? root).direction === 'rtl' ? 'rtl' : 'ltr');
    refresh();
    const observer = new MutationObserver(refresh);
    for (let parent = root.parentElement; parent; parent = parent.parentElement) {
      observer.observe(parent, { attributes: true, attributeFilter: ['dir', 'class', 'style'] });
    }
    return () => observer.disconnect();
  }, [dir]);

  const percentage = (number: number) => max > min ? Math.min(100, Math.max(0, (number - min) / (max - min) * 100)) : 0;
  const low = values.length > 1 ? percentage(Math.min(...values)) : 0;
  const high = values.length ? percentage(Math.max(...values)) : 0;
  const reversed = orientation === 'horizontal' ? (resolvedDir === 'rtl') !== inverted : !inverted;
  const start = reversed ? 100 - high : low;
  const end = reversed ? low : 100 - high;
  const clip: CSSProperties = {
    clipPath: orientation === 'horizontal' ? `inset(0 ${end}% 0 ${start}%)` : `inset(${start}% 0 ${end}% 0)`,
  };

  return <SliderPrimitive.Root
    {...props}
    className={['inkra-slider', className].filter(Boolean).join(' ')}
    data-size={size}
    data-variant={variant}
    defaultValue={defaultValue}
    dir={resolvedDir}
    disabled={disabled}
    inverted={inverted}
    min={min}
    max={max}
    onValueChange={next => {
      if (value === undefined) setUncontrolledValue(next);
      onValueChange?.(next);
    }}
    orientation={orientation}
    ref={rootRef}
    value={value}
  >
    <SliderPrimitive.Track className="inkra-slider__track">
      <PencilSurface as="span" aria-hidden="true" className="inkra-slider__track-surface" variant="outline" radius={variant === 'inset' ? 8 : 3} seed={`${resolvedSeed}-track`} />
      <span aria-hidden="true" className="inkra-slider__range" style={clip}>
        <PencilSurface as="span" className="inkra-slider__range-surface" variant="selection" seed={`${resolvedSeed}-range`} />
      </span>
    </SliderPrimitive.Track>
    {values.map((current, index) => {
      const thumbLabel = thumbLabels?.[index];
      const labelledBy = thumbLabel ? undefined : ariaLabelledBy;
      const label = thumbLabel ?? (ariaLabel ? `${ariaLabel}${values.length > 1 ? ` ${index + 1}` : ''}` : labelledBy ? undefined : `Value${values.length > 1 ? ` ${index + 1}` : ''}`);
      return <SliderPrimitive.Thumb
        key={index}
        aria-describedby={ariaDescribedBy}
        aria-label={label}
        aria-labelledby={labelledBy}
        aria-valuenow={current}
        aria-valuetext={getValueLabel?.(current, index) ?? ariaValueText}
        className="inkra-slider__thumb"
      >
        <PencilSurface as="span" aria-hidden="true" className="inkra-slider__thumb-surface" variant="paper" radius={8} seed={`${resolvedSeed}-thumb-${index}`}>
          <PencilSurface as="span" className="inkra-slider__focus-ring" variant="outline" radius={8} seed={`${resolvedSeed}-focus-${index}`} />
        </PencilSurface>
      </SliderPrimitive.Thumb>;
    })}
  </SliderPrimitive.Root>;
});
