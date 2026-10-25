import { forwardRef } from 'react';
import { useInkraLocale } from '../i18n/index.js';

import { Slider } from '../slider/index.js';
import type { SliderProps } from '../slider/index.js';

/** A numeric range ordered as [minimum, maximum]. */
export type RangeSliderValue = [number, number];

export interface RangeSliderProps extends Omit<
  SliderProps,
  'defaultValue' | 'minStepsBetweenThumbs' | 'onValueChange' | 'onValueCommit' | 'preserveThumbOrder' | 'thumbLabels' | 'value'
> {
  value?: RangeSliderValue;
  defaultValue?: RangeSliderValue;
  onValueChange?: (value: RangeSliderValue) => void;
  onValueCommit?: (value: RangeSliderValue) => void;
  /** Minimum numeric distance between endpoints. Rounded up to the next step and ignored when allowCross is true. */
  minDistance?: number;
  /** Allow a thumb to pass the other and exchange its low/high endpoint role. */
  allowCross?: boolean;
  /** Accessible names for the current low and high endpoints. */
  thumbLabels?: readonly [string, string];
}

function asRangeValue(value: number[]): RangeSliderValue {
  return [value[0], value[1]];
}

function normalizeRangeValue(value: RangeSliderValue): RangeSliderValue {
  return value[0] <= value[1] ? value : [value[1], value[0]];
}

function getMinimumSteps(minDistance: number, step: number) {
  if (!Number.isFinite(minDistance) || minDistance <= 0) return 0;
  if (!Number.isFinite(step) || step <= 0) return 0;
  return Math.ceil(minDistance / step);
}

export const RangeSlider = forwardRef<HTMLSpanElement, RangeSliderProps>(function RangeSlider(
  {
    allowCross = false,
    defaultValue,
    max = 100,
    min = 0,
    minDistance = 0,
    onValueChange,
    onValueCommit,
    step = 1,
    thumbLabels,
    value,
    ...props
  },
  forwardedRef,
) {
  const { t } = useInkraLocale();
  const controlledValue = value === undefined ? undefined : normalizeRangeValue(value);
  const uncontrolledDefault = value === undefined ? normalizeRangeValue(defaultValue ?? [min, max]) : undefined;

  return <Slider
    {...props}
    defaultValue={uncontrolledDefault}
    max={max}
    min={min}
    minStepsBetweenThumbs={allowCross ? 0 : getMinimumSteps(minDistance, step)}
    onValueChange={next => onValueChange?.(asRangeValue(next))}
    onValueCommit={next => onValueCommit?.(asRangeValue(next))}
    preserveThumbOrder={!allowCross}
    ref={forwardedRef}
    step={step}
    thumbLabels={thumbLabels ?? [t('rangeSlider.minimum'), t('rangeSlider.maximum')]}
    value={controlledValue}
  />;
});
