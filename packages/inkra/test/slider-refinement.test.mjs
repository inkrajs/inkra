import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const slider = readFileSync(new URL('../src/slider/index.tsx', import.meta.url), 'utf8');
const range = readFileSync(new URL('../src/range-slider/index.tsx', import.meta.url), 'utf8');

test('Slider owns one coherent value for Radix interaction, ARIA, fill and form inputs', () => {
  assert.match(slider, /const controlled = value !== undefined/);
  assert.match(slider, /const values = value \?\? uncontrolledValue/);
  assert.match(slider, /<SliderPrimitive\.Root[\s\S]*?value=\{values\}/);
  assert.match(slider, /const low = values\.length/);
  assert.match(slider, /values\.map\(\(current, index\) =>/);
  assert.match(slider, /aria-valuenow=\{current\}/);
  assert.match(slider, /const inputName = name \? values\.length > 1 \? `\$\{name\}\[\]` : name : undefined/);
});

test('Slider isolates Radix reset while retaining its BubbleInput form event contract', () => {
  assert.match(slider, /const radixFormId = `\$\{generatedId\}-radix-inert-form`/);
  assert.match(slider, /<SliderPrimitive\.Root[\s\S]*?form=\{radixFormId\}/);
  assert.doesNotMatch(slider, /<SliderPrimitive\.Root[\s\S]*?name=\{name\}/);
  assert.match(slider, /SliderPrimitive\.unstable_ThumbProvider[\s\S]*?name=\{inputName\}/);
  assert.match(slider, /SliderPrimitive\.unstable_ThumbTrigger/);
  assert.match(slider, /SliderPrimitive\.unstable_BubbleInput disabled=\{disabled\} form=\{form\} name=\{inputName\}[\s\S]*?formInputRefs\.current\.set\(index, input\)/);
  assert.doesNotMatch(slider, /<input\b/);
});

test('Slider native reset is cancel-aware, external-form aware and callback-free', () => {
  assert.match(slider, /const defaultValueRef = useRef\(\[\.\.\.\(defaultValue \?\? \[min\]\)\]\)/);
  assert.match(slider, /const candidate = form \? ownerDocument\.getElementById\(form\) : root\.closest\('form'\)/);
  assert.match(slider, /candidate instanceof FormElement \? candidate : null/);
  assert.match(slider, /formElement\.addEventListener\('reset', reset\)/);
  assert.match(slider, /if \(event\.defaultPrevented\) return/);
  assert.match(slider, /if \(controlled\)[\s\S]*?input\.value = String\(valuesRef\.current\[index\] \?\? ''\)/);
  assert.match(slider, /setUncontrolledValue\(\[\.\.\.defaultValueRef\.current\]\)/);
  const resetEffect = slider.match(/useEffect\(\(\) => \{[\s\S]*?formElement\.removeEventListener\('reset', reset\);[\s\S]*?\}, \[controlled, form\]\);/)?.[0] ?? '';
  assert.doesNotMatch(resetEffect, /onValueChange|onValueCommit|focus/);
});

test('RangeSlider continues to delegate spacing and crossing to the Slider engine', () => {
  assert.match(range, /minStepsBetweenThumbs=\{allowCross \? 0 : getMinimumSteps\(minDistance, step\)\}/);
  assert.match(range, /preserveThumbOrder=\{!allowCross\}/);
  assert.match(range, /onValueCommit=\{next => onValueCommit\?\.\(asRangeValue\(next\)\)\}/);
});
