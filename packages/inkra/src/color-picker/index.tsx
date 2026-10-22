import { useEffect, useId, useMemo, useState } from 'react';
import type { FieldsetHTMLAttributes, ReactNode } from 'react';

import { Input } from '../form/Input.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { Slider } from '../slider/index.js';
import {
  DEFAULT_COLOR_VALUE,
  colorAlphaPercent,
  colorRgbValue,
  normalizeColorValue,
  withColorAlpha,
  withColorRgb,
} from './color.js';
import type { ColorValue } from './color.js';

export interface ColorPreset {
  value: string;
  label?: string;
}

export interface ColorPickerLabels {
  palette?: string;
  value?: string;
  alpha?: string;
  presets?: string;
  invalid?: string;
}

export interface ColorPickerChangeDetails {
  source: 'palette' | 'alpha' | 'input' | 'preset';
}

export interface ColorPickerProps extends Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'defaultValue' | 'onChange' | 'value'> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: ColorValue, details: ColorPickerChangeDetails) => void;
  onInvalidInput?: (input: string) => void;
  presets?: readonly (string | ColorPreset)[];
  label?: ReactNode;
  labels?: ColorPickerLabels;
  name?: string;
  showAlpha?: boolean;
  seed?: string | number;
}

const defaultLabels: Required<ColorPickerLabels> = {
  palette: 'Open color palette',
  value: 'Color value',
  alpha: 'Opacity',
  presets: 'Color presets',
  invalid: 'Use #RGB, #RGBA, #RRGGBB, or #RRGGBBAA.',
};

function presetData(preset: string | ColorPreset) {
  const input = typeof preset === 'string' ? preset : preset.value;
  const value = normalizeColorValue(input);
  if (!value) return null;
  return { value, label: typeof preset === 'string' ? value : preset.label ?? value };
}

export function ColorPicker({
  className,
  defaultValue = DEFAULT_COLOR_VALUE,
  disabled = false,
  id,
  label = 'Color',
  labels,
  name,
  onInvalidInput,
  onValueChange,
  presets = [],
  seed,
  showAlpha = true,
  value,
  ...props
}: ColorPickerProps) {
  const generatedId = useId();
  const resolvedId = id ?? `inkra-color-picker-${generatedId}`;
  const resolvedSeed = seed ?? resolvedId;
  const controlledValue = value === undefined ? null : normalizeColorValue(value);
  const normalizedDefault = normalizeColorValue(defaultValue) ?? DEFAULT_COLOR_VALUE;
  const [uncontrolledValue, setUncontrolledValue] = useState<ColorValue>(normalizedDefault);
  const currentValue = controlledValue ?? (value === undefined ? uncontrolledValue : DEFAULT_COLOR_VALUE);
  const [draft, setDraft] = useState<string>(currentValue);
  const copy = { ...defaultLabels, ...labels };
  const parsedPresets = useMemo(() => presets.map(presetData).filter((preset): preset is NonNullable<typeof preset> => preset !== null), [presets]);
  const inputInvalid = normalizeColorValue(draft) === null;
  const rgbValue = colorRgbValue(currentValue) ?? '#4b96aa';
  const alpha = colorAlphaPercent(currentValue);

  useEffect(() => setDraft(currentValue), [currentValue]);

  const commit = (next: ColorValue, source: ColorPickerChangeDetails['source']) => {
    if (value === undefined) setUncontrolledValue(next);
    else setDraft(currentValue);
    onValueChange?.(next, { source });
  };

  const submitDraft = () => {
    const normalized = normalizeColorValue(draft);
    if (normalized) commit(normalized, 'input');
    else onInvalidInput?.(draft);
  };

  return <fieldset
    {...props}
    className={['inkra-color-picker', className].filter(Boolean).join(' ')}
    data-alpha={showAlpha || undefined}
    data-controlled={value !== undefined || undefined}
    data-invalid-value={value !== undefined && controlledValue === null || undefined}
    disabled={disabled}
    id={resolvedId}
  >
    <legend className="inkra-color-picker__legend">
      {typeof label === 'string' ? <PencilText seed={`${resolvedSeed}-legend`}>{label}</PencilText> : label}
    </legend>
    <div className="inkra-color-picker__main">
      <label className="inkra-color-picker__palette" aria-label={copy.palette} title={copy.palette}>
        <span className="inkra-color-picker__checker" aria-hidden="true" />
        <span className="inkra-color-picker__current" aria-hidden="true" style={{ backgroundColor: currentValue }} />
        <PencilSurface as="span" aria-hidden="true" className="inkra-color-picker__palette-outline" variant="outline" seed={`${resolvedSeed}-palette`} />
        <input
          aria-label={copy.palette}
          className="inkra-color-picker__native"
          disabled={disabled}
          type="color"
          value={rgbValue}
          onChange={event => {
            const next = withColorRgb(currentValue, event.currentTarget.value);
            if (next) commit(next, 'palette');
          }}
        />
      </label>
      <div className="inkra-color-picker__value-field">
        <label className="inkra-color-picker__label" htmlFor={`${resolvedId}-value`}>
          <PencilText seed={`${resolvedSeed}-value-label`}>{copy.value}</PencilText>
        </label>
        <Input
          id={`${resolvedId}-value`}
          aria-describedby={inputInvalid ? `${resolvedId}-error` : undefined}
          aria-invalid={inputInvalid || undefined}
          autoCapitalize="off"
          autoComplete="off"
          className="inkra-color-picker__input"
          disabled={disabled}
          inputMode="text"
          spellCheck={false}
          value={draft}
          onBlur={submitDraft}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submitDraft();
            }
            if (event.key === 'Escape') setDraft(currentValue);
          }}
          onValueChange={setDraft}
        />
        <span className="inkra-color-picker__error" id={`${resolvedId}-error`} aria-live="polite">
          {inputInvalid ? copy.invalid : ''}
        </span>
      </div>
    </div>
    {showAlpha ? <div className="inkra-color-picker__alpha">
      <div className="inkra-color-picker__alpha-heading">
        <span id={`${resolvedId}-alpha-label`}><PencilText seed={`${resolvedSeed}-alpha-label`}>{copy.alpha}</PencilText></span>
        <output htmlFor={`${resolvedId}-alpha`}>{alpha}%</output>
      </div>
      <Slider
        aria-labelledby={`${resolvedId}-alpha-label`}
        disabled={disabled}
        id={`${resolvedId}-alpha`}
        max={100}
        min={0}
        seed={`${resolvedSeed}-alpha`}
        value={[alpha]}
        getValueLabel={number => `${number}%`}
        onValueChange={values => {
          const next = withColorAlpha(currentValue, values[0]);
          if (next) commit(next, 'alpha');
        }}
      />
    </div> : null}
    {parsedPresets.length ? <>
      <PencilLine className="inkra-color-picker__divider" seed={`${resolvedSeed}-divider`} />
      <div className="inkra-color-picker__presets" role="group" aria-label={copy.presets}>
        {parsedPresets.map((preset, index) => <button
          type="button"
          aria-label={preset.label}
          aria-pressed={preset.value === currentValue}
          className="inkra-color-picker__preset"
          disabled={disabled}
          key={`${preset.value}-${index}`}
          title={preset.label}
          onClick={() => commit(preset.value, 'preset')}
        >
          <span className="inkra-color-picker__checker" aria-hidden="true" />
          <span className="inkra-color-picker__preset-color" aria-hidden="true" style={{ backgroundColor: preset.value }} />
          <PencilSurface as="span" aria-hidden="true" className="inkra-color-picker__preset-outline" variant={preset.value === currentValue ? 'selection' : 'outline'} seed={`${resolvedSeed}-preset-${index}`} />
        </button>)}
      </div>
    </> : null}
    {name ? <input type="hidden" name={name} value={currentValue} /> : null}
  </fieldset>;
}

export {
  DEFAULT_COLOR_VALUE,
  colorAlphaPercent,
  colorRgbValue,
  formatColorValue,
  normalizeColorValue,
  parseColorValue,
  withColorAlpha,
  withColorRgb,
} from './color.js';
export type { ColorChannels, ColorValue } from './color.js';
