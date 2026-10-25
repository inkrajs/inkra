import { type InkraTranslate } from '../i18n/index.js';
import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { __iconData as addIcon } from 'lucide-react/dist/esm/icons/plus.mjs';
import { __iconData as removeIcon } from 'lucide-react/dist/esm/icons/minus.mjs';
import { __iconData as reverseIcon } from 'lucide-react/dist/esm/icons/arrow-left-right.mjs';
import { Button } from '../Button.js';
import { ColorSwatch } from '../color-swatch/index.js';
import { Field } from '../form/Field.js';
import { InputNumber } from '../input-number/index.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { Select } from '../select/index.js';
import { Slider } from '../slider/index.js';
import { Switch } from '../selection/Switch.js';
import { ToggleGroup } from '../toggle-group/index.js';
import { formatColorPaint } from './gradient.js';
import type { ColorGradient, ColorGradientStop } from './gradient.js';
import type { ColorValue } from './color.js';

export interface ColorGradientLabels {
  type?: string;
  solid?: string;
  linear?: string;
  radial?: string;
  conic?: string;
  preview?: string;
  stops?: string;
  stop?: string;
  stopColor?: string;
  addStop?: string;
  removeStop?: string;
  reverse?: string;
  position?: string;
  angle?: string;
  centerX?: string;
  centerY?: string;
  shape?: string;
  circle?: string;
  ellipse?: string;
  extent?: string;
  closestSide?: string;
  closestCorner?: string;
  farthestSide?: string;
  farthestCorner?: string;
  repeating?: string;
}
export const defaultGradientLabels = (t: InkraTranslate): Required<ColorGradientLabels> => ({
  type: t('gradient.type'), solid: t('gradient.solid'), linear: t('gradient.linear'), radial: t('gradient.radial'), conic: t('gradient.conic'),
  preview: t('gradient.preview'), stops: t('gradient.stops'), stop: t('gradient.stop'), stopColor: t('gradient.stopColor'),
  addStop: t('gradient.add'), removeStop: t('gradient.remove'), reverse: t('gradient.reverse'),
  position: t('gradient.position'), angle: t('gradient.angle'), centerX: t('gradient.centerX'), centerY: t('gradient.centerY'),
  shape: t('gradient.shape'), circle: t('gradient.circle'), ellipse: t('gradient.ellipse'), extent: t('gradient.extent'),
  closestSide: t('gradient.closestSide'), closestCorner: t('gradient.closestCorner'),
  farthestSide: t('gradient.farthestSide'), farthestCorner: t('gradient.farthestCorner'), repeating: t('gradient.repeat'),
});
const iconPaths = (data: typeof addIcon) => data.node.filter(([tag]) => tag === 'path').map(([, attrs]) => ({ d: attrs.d }));
const actions = { add: iconPaths(addIcon), remove: iconPaths(removeIcon), reverse: iconPaths(reverseIcon) };

export function GradientEditor({ value, disabled, maxStops, labels, onChange, renderColorEditor }: {
  value: ColorGradient;
  disabled: boolean;
  maxStops: number;
  labels: Required<ColorGradientLabels>;
  onChange: (value: ColorGradient, source: 'stop' | 'geometry') => void;
  renderColorEditor: (value: ColorValue, onChange: (value: ColorValue) => void) => ReactNode;
}) {
  const id = useId();
  const counter = useRef(0);
  const [selected, setSelected] = useState<string>();
  const stop = value.stops.find(stop => stop.id === selected) ?? value.stops[0];
  const updateStop = (patch: Partial<ColorGradientStop>) => onChange({
    ...value, stops: value.stops.map(item => item.id === stop.id ? { ...item, ...patch } : item),
  }, 'stop');
  const numberField = (label: string, current: number, max: number, update: (number: number) => void) =>
    <Field label={label} disabled={disabled}><InputNumber controls={false} min={0} max={max} value={current}
      onValueChange={next => { if (next !== null) update(Math.min(max, Math.max(0, next))); }} /></Field>;

  function addStop() {
    // Insert in the widest interval, preserving existing stops and their identities.
    let left = value.stops[0];
    let right = value.stops[1];
    for (let index = 1; index < value.stops.length - 1; index++) {
      if (value.stops[index + 1].position - value.stops[index].position > right.position - left.position) {
        left = value.stops[index]; right = value.stops[index + 1];
      }
    }
    let nextId: string;
    do { nextId = `${id}-${counter.current++}`; } while (value.stops.some(item => item.id === nextId));
    onChange({ ...value, stops: [...value.stops, { id: nextId, color: stop.color, position: (left.position + right.position) / 2 }] }, 'stop');
    setSelected(nextId);
  }

  return <div className="inkra-color-picker__gradient">
    <div className="inkra-color-picker__gradient-preview" role="img" aria-label={`${labels.preview}: ${formatColorPaint(value)}`}>
      <span className="inkra-color-picker__checker" aria-hidden="true" />
      <span className="inkra-color-picker__current" aria-hidden="true" style={{ background: formatColorPaint(value) }} />
      <PencilSurface as="span" aria-hidden="true" variant="outline" className="inkra-color-picker__palette-outline" />
    </div>
    <div className="inkra-color-picker__stop-toolbar">
      <div className="inkra-color-picker__stops" role="group" aria-label={labels.stops}>
        {value.stops.map((item, index) => <span className="inkra-color-picker__stop" key={item.id}>
          <ColorSwatch color={item.color} selected={item.id === stop.id} disabled={disabled}
            label={`${labels.stop} ${index + 1}: ${item.color} (${item.position}%)`} onClick={() => setSelected(item.id)} />
          <PencilText aria-hidden="true">{`${item.position}%`}</PencilText>
        </span>)}
      </div>
      <div className="inkra-color-picker__stop-actions">
        <Button size="icon" variant="ghost" aria-label={labels.addStop} title={labels.addStop} disabled={disabled || value.stops.length >= maxStops} onClick={addStop}><PencilIcon paths={actions.add} size={20} /></Button>
        <Button size="icon" variant="ghost" aria-label={labels.removeStop} title={labels.removeStop} disabled={disabled || value.stops.length <= 2} onClick={() => {
          const index = value.stops.indexOf(stop);
          const stops = value.stops.filter(item => item.id !== stop.id);
          onChange({ ...value, stops }, 'stop');
          setSelected(stops[Math.min(index, stops.length - 1)].id);
        }}><PencilIcon paths={actions.remove} size={20} /></Button>
        <Button size="icon" variant="ghost" aria-label={labels.reverse} title={labels.reverse} disabled={disabled} onClick={() => onChange({ ...value, stops: [...value.stops].reverse().map(item => ({ ...item, position: 100 - item.position })) }, 'stop')}><PencilIcon paths={actions.reverse} size={20} /></Button>
      </div>
    </div>
    <div className="inkra-color-picker__stop-position">
      {numberField(labels.position, stop.position, 100, position => updateStop({ position }))}
      <Slider aria-label={labels.position} disabled={disabled} value={[stop.position]} min={0} max={100} step={1}
        getValueLabel={value => `${value}%`} onValueChange={([position]) => updateStop({ position })} />
    </div>
    {renderColorEditor(stop.color as ColorValue, color => updateStop({ color }))}
    <div className="inkra-color-picker__geometry">
      {value.type !== 'radial' && numberField(labels.angle, value.angle ?? 0, 359, angle => onChange({ ...value, angle }, 'geometry'))}
      {value.type !== 'linear' && <>
        {numberField(labels.centerX, value.center?.x ?? 50, 100, x => onChange({ ...value, center: { x, y: value.center?.y ?? 50 } }, 'geometry'))}
        {numberField(labels.centerY, value.center?.y ?? 50, 100, y => onChange({ ...value, center: { x: value.center?.x ?? 50, y } }, 'geometry'))}
      </>}
    </div>
    {value.type === 'radial' && <div className="inkra-color-picker__radial-options">
      <ToggleGroup.Root aria-label={labels.shape} disabled={disabled} value={[value.shape ?? 'ellipse']} size="sm"
        onValueChange={values => { if (values[0]) onChange({ ...value, shape: values[0] as ColorGradient['shape'] }, 'geometry'); }}>
        <ToggleGroup.Item value="circle">{labels.circle}</ToggleGroup.Item>
        <ToggleGroup.Item value="ellipse">{labels.ellipse}</ToggleGroup.Item>
      </ToggleGroup.Root>
      <Select.Root disabled={disabled} value={value.extent ?? 'farthest-corner'} onValueChange={extent => onChange({ ...value, extent: extent as ColorGradient['extent'] }, 'geometry')}>
        <Select.Trigger aria-label={labels.extent}><Select.Value /></Select.Trigger>
        <Select.Portal><Select.Content position="popper"><Select.Viewport>
          {([['closest-side', labels.closestSide], ['closest-corner', labels.closestCorner], ['farthest-side', labels.farthestSide], ['farthest-corner', labels.farthestCorner]] as const).map(([key, label]) => <Select.Item key={key} value={key}><Select.ItemText>{label}</Select.ItemText><Select.ItemIndicator /></Select.Item>)}
        </Select.Viewport></Select.Content></Select.Portal>
      </Select.Root>
    </div>}
    <Switch label={labels.repeating} disabled={disabled} checked={value.repeating ?? false} onCheckedChange={repeating => onChange({ ...value, repeating }, 'geometry')} />
  </div>;
}
