import { useInkraLocale, type InkraTranslate } from '../i18n/index.js';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FieldsetHTMLAttributes, ReactNode } from 'react';

import { Button } from '../Button.js';
import { ColorSwatch } from '../color-swatch/index.js';
import { Input } from '../form/Input.js';
import { Popover } from '../overlay/Popover.js';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { Slider } from '../slider/index.js';
import { ToggleGroup } from '../toggle-group/index.js';
import { GradientEditor, defaultGradientLabels } from './GradientEditor.js';
import type { ColorGradientLabels } from './GradientEditor.js';
import { colorPaintTypes, createColorGradient, formatColorPaint, normalizeColorPaint } from './gradient.js';
import type { ColorGradient, ColorPaint, ColorPaintType } from './gradient.js';
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
  value: string | ColorGradient;
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
  source: 'palette' | 'alpha' | 'input' | 'preset' | 'type' | 'stop' | 'geometry';
}

export type ColorPickerPresentation = 'inline' | 'compact' | 'popover' | 'swatches';

export interface ColorPickerBaseProps extends Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'defaultValue' | 'onChange' | 'value'> {
  onInvalidInput?: (input: string) => void;
  presets?: readonly (string | ColorPreset)[];
  label?: ReactNode;
  labels?: ColorPickerLabels;
  gradientLabels?: ColorGradientLabels;
  name?: string;
  showAlpha?: boolean;
  presentation?: ColorPickerPresentation;
  seed?: string | number;
}

export type ColorPickerProps = ColorPickerBaseProps & ({
  allowGradient?: false;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: ColorValue, details: ColorPickerChangeDetails) => void;
  colorTypes?: never;
  maxStops?: never;
} | {
  allowGradient: true;
  value?: string | ColorGradient;
  defaultValue?: string | ColorGradient;
  onValueChange?: (value: ColorPaint, details: ColorPickerChangeDetails) => void;
  colorTypes?: readonly ColorPaintType[];
  maxStops?: number;
});

const defaultLabels = (t: InkraTranslate): Required<ColorPickerLabels> => ({
  palette: t('color.palette'),
  value: t('color.value'),
  alpha: t('color.alpha'),
  presets: t('color.presets'),
  invalid: t('color.invalid'),
});

function presetData(preset: string | ColorPreset, allowGradient: boolean) {
  const input = typeof preset === 'string' ? preset : preset.value;
  const value = typeof input === 'string' || allowGradient ? normalizeColorPaint(input) : null;
  if (!value) return null;
  return { value, label: typeof preset === 'string' ? preset : preset.label ?? formatColorPaint(value) };
}

export function ColorPicker(options: ColorPickerProps) {
  const { t } = useInkraLocale();
  const {
    allowGradient = false,
    colorTypes = colorPaintTypes,
    maxStops = 8,
    gradientLabels,
    className,
    defaultValue = DEFAULT_COLOR_VALUE,
    disabled = false,
    form,
    id,
    label = t('color.label'),
    labels,
    name,
    onInvalidInput,
    onValueChange: _onValueChange,
    presets = [],
    presentation = 'inline',
    seed,
    showAlpha = true,
    value,
    ...props
  } = options;
  const generatedId = useId();
  const resolvedId = id ?? `inkra-color-picker-${generatedId}`;
  const resolvedSeed = seed ?? resolvedId;
  const controlled = value !== undefined;
  const normalized = (input: string | ColorGradient) => typeof input === 'string' || allowGradient ? normalizeColorPaint(input) : null;
  const controlledValue = useMemo(() => value === undefined ? null : normalized(value), [value, allowGradient]);
  const normalizedDefault = normalized(defaultValue) ?? DEFAULT_COLOR_VALUE;
  const defaultValueRef = useRef<ColorPaint>(normalizedDefault);
  const [uncontrolledValue, setUncontrolledValue] = useState<ColorPaint>(normalizedDefault);
  const currentValue = controlledValue ?? (controlled ? DEFAULT_COLOR_VALUE : uncontrolledValue);
  const currentValueRef = useRef<ColorPaint>(currentValue);
  const gradient = typeof currentValue === 'string' ? null : currentValue;
  const currentColor = typeof currentValue === 'string' ? currentValue : currentValue.stops[0].color as ColorValue;
  const cssValue = formatColorPaint(currentValue);
  const currentType = gradient?.type ?? 'solid';
  const gradientMemory = useRef<ColorGradient | null>(null);
  const availableTypes = [...new Set(colorTypes.filter(type => colorPaintTypes.includes(type)))];
  if (!availableTypes.includes(currentType)) availableTypes.unshift(currentType);
  const stopLimit = Number.isFinite(maxStops) ? Math.min(64, Math.max(2, Math.floor(maxStops))) : 8;
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const skipNextBlurRef = useRef(false);
  const [draft, setDraft] = useState<string>(currentColor);
  const [open, setOpen] = useState(false);
  const copy = { ...defaultLabels(t), ...labels };
  const gradientCopy = { ...defaultGradientLabels(t), ...gradientLabels };
  const parsedPresets = useMemo(() => presets.map(preset => presetData(preset, allowGradient)).filter((preset): preset is NonNullable<typeof preset> => preset !== null), [presets, allowGradient]);
  const inputInvalid = normalizeColorValue(draft) === null;
  const rgbValue = colorRgbValue(currentColor) ?? '#4b96aa';
  const alpha = colorAlphaPercent(currentColor);

  useEffect(() => { setOpen(false); }, [disabled, presentation]);

  useEffect(() => {
    currentValueRef.current = currentValue;
    setDraft(currentColor);
    if (gradient) gradientMemory.current = gradient;
  }, [currentValue, currentColor]);

  useEffect(() => {
    const ownerForm = hiddenInputRef.current?.form ?? fieldsetRef.current?.form;
    if (!ownerForm) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = (event: Event) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (event.defaultPrevented) return;
        const restored = controlled ? currentValueRef.current : defaultValueRef.current;
        if (!controlled) setUncontrolledValue(restored);
        setDraft(typeof restored === 'string' ? restored : restored.stops[0].color);
        gradientMemory.current = typeof restored === 'string' ? null : restored;
        if (hiddenInputRef.current) hiddenInputRef.current.value = formatColorPaint(restored);
        composingRef.current = false;
        skipNextBlurRef.current = false;
      }, 0);
    };
    ownerForm.addEventListener('reset', reset);
    return () => {
      clearTimeout(timer);
      ownerForm.removeEventListener('reset', reset);
    };
  }, [controlled, form, name]);

  const commit = (input: ColorPaint, source: ColorPickerChangeDetails['source']) => {
    if (disabled) return;
    const next = normalized(input);
    if (!next) return;
    if (JSON.stringify(next) === JSON.stringify(currentValue)) {
      setDraft(currentColor);
      return;
    }
    if (!controlled) {
      setUncontrolledValue(next);
      setDraft(typeof next === 'string' ? next : next.stops[0].color);
    } else setDraft(currentColor);
    if (options.allowGradient) options.onValueChange?.(next, { source });
    else if (typeof next === 'string') options.onValueChange?.(next, { source });
  };

  const submitDraft = () => {
    if (disabled || composingRef.current) return;
    const normalized = normalizeColorValue(draft);
    if (normalized) commit(normalized, 'input');
    else onInvalidInput?.(draft);
  };

  // With no usable presets, retain the editor rather than rendering an empty control.
  const swatchesOnly = presentation === 'swatches' && parsedPresets.length > 0;
  const editor = <div className="inkra-color-picker__editor" data-presentation={presentation}>
    {allowGradient && !swatchesOnly && <ToggleGroup.Root className="inkra-color-picker__types" aria-label={gradientCopy.type}
      disabled={disabled} size="sm" value={[currentType]} onValueChange={values => {
        const type = values[0] as ColorPaintType | undefined;
        if (!type || type === currentType) return;
        if (type === 'solid') commit(currentColor, 'type');
        else commit(gradient ? { ...gradient, type } : gradientMemory.current ? { ...gradientMemory.current, type } : createColorGradient(type, currentColor), 'type');
      }}>
      {availableTypes.map(type => <ToggleGroup.Item key={type} value={type}>{gradientCopy[type]}</ToggleGroup.Item>)}
    </ToggleGroup.Root>}
    {!swatchesOnly && gradient && <GradientEditor value={gradient} disabled={disabled} maxStops={stopLimit}
      labels={gradientCopy} onChange={commit} renderColorEditor={(color, onChange) => <ColorPicker
        label={gradientCopy.stopColor} labels={labels} disabled={disabled} showAlpha={showAlpha}
        value={color} onValueChange={onChange} seed={`${resolvedSeed}-stop`} />} />}
    {!swatchesOnly && !gradient && <>
    <div className="inkra-color-picker__main">
      <label className="inkra-color-picker__palette" aria-label={copy.palette} title={copy.palette}>
        <span className="inkra-color-picker__checker" aria-hidden="true" />
        <span className="inkra-color-picker__current" aria-hidden="true" style={{ backgroundColor: currentColor }} />
        <PencilSurface as="span" aria-hidden="true" className="inkra-color-picker__palette-outline" variant="outline" seed={`${resolvedSeed}-palette`} />
        <PencilSurface as="span" aria-hidden="true" className="inkra-color-picker__focus" variant="outline" seed={`${resolvedSeed}-palette-focus`} />
        <input
          aria-label={copy.palette}
          className="inkra-color-picker__native"
          disabled={disabled}
          type="color"
          value={rgbValue}
          onChange={event => {
            const next = withColorRgb(currentColor, event.currentTarget.value);
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
          onBlur={() => {
            if (skipNextBlurRef.current) {
              skipNextBlurRef.current = false;
              return;
            }
            submitDraft();
          }}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              skipNextBlurRef.current = true;
              submitDraft();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              skipNextBlurRef.current = true;
              setDraft(currentColor);
            }
          }}
          onValueChange={next => {
            skipNextBlurRef.current = false;
            setDraft(next);
          }}
        />
        <span className="inkra-color-picker__error" id={`${resolvedId}-error`} aria-live="polite" hidden={!inputInvalid}>
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
          const next = withColorAlpha(currentColor, values[0]);
          if (next) commit(next, 'alpha');
        }}
      />
    </div> : null}
    </>}
    {parsedPresets.length ? <>
      {!swatchesOnly && <PencilLine className="inkra-color-picker__divider" seed={`${resolvedSeed}-divider`} />}
      <div className="inkra-color-picker__presets" role="group" aria-label={copy.presets}>
        {parsedPresets.map((preset, index) => <ColorSwatch
          color={typeof preset.value === 'string' ? preset.value : preset.value.stops[0].color}
          background={typeof preset.value === 'string' ? undefined : formatColorPaint(preset.value)}
          label={preset.label}
          selected={formatColorPaint(preset.value) === cssValue}
          className="inkra-color-picker__preset"
          disabled={disabled}
          key={`${formatColorPaint(preset.value)}-${index}`}
          seed={`${resolvedSeed}-preset-${index}`}
          onClick={() => commit(preset.value, 'preset')}
        />)}
      </div>
    </> : null}
  </div>;

  return <fieldset
    {...props}
    className={['inkra-color-picker', className].filter(Boolean).join(' ')}
    data-presentation={presentation}
    data-alpha={showAlpha || undefined}
    data-controlled={value !== undefined || undefined}
    data-invalid-value={value !== undefined && controlledValue === null || undefined}
    disabled={disabled}
    form={form}
    id={resolvedId}
    ref={fieldsetRef}
  >
    <legend className="inkra-color-picker__legend" id={`${resolvedId}-legend`}>
      {typeof label === 'string' ? <PencilText seed={`${resolvedSeed}-legend`}>{label}</PencilText> : label}
    </legend>
    {presentation === 'popover' ? <Popover.Root open={open && !disabled} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="outline" className="inkra-color-picker__trigger" disabled={disabled}
          aria-label={`${copy.palette}: ${typeof currentValue === 'string' ? currentValue : gradientCopy[currentValue.type]}`}>
          <span className="inkra-color-picker__trigger-content">
            <span className="inkra-color-picker__preview" aria-hidden="true">
              <span className="inkra-color-picker__checker" />
              <span className="inkra-color-picker__current" style={{ background: cssValue }} />
            </span>
            <PencilText>{typeof currentValue === 'string' ? currentValue : gradientCopy[currentValue.type]}</PencilText>
          </span>
        </Button>
      </Popover.Trigger>
      <Popover.Portal><Popover.Content className="inkra-color-picker__popover" sideOffset={8} align="start"
        aria-label={typeof label === 'string' ? label : copy.palette} aria-describedby={undefined}>
        {editor}
      </Popover.Content></Popover.Portal>
    </Popover.Root> : editor}
    {name ? <input ref={hiddenInputRef} type="hidden" form={form} name={name} value={cssValue} /> : null}
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
export { createColorGradient, formatColorPaint, normalizeColorPaint } from './gradient.js';
export type { ColorGradient, ColorGradientStop, ColorPaint, ColorPaintType } from './gradient.js';
export type { ColorGradientLabels } from './GradientEditor.js';
