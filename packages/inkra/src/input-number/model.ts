export interface InputNumberStepModifier {
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  step: number;
}

export type InputNumberModifierState = Pick<KeyboardEvent, 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>;
export type InputNumberStepDirection = 'increment' | 'decrement';

export const defaultInputNumberStepModifiers: readonly InputNumberStepModifier[] = [
  { shiftKey: true, step: 10 },
];

export function resolveInputNumberStep(
  modifiers: InputNumberModifierState,
  rules: readonly InputNumberStepModifier[] = defaultInputNumberStepModifiers,
): number | undefined {
  return rules.find(rule => Number.isFinite(rule.step) && rule.step > 0
    && Boolean(rule.shiftKey) === modifiers.shiftKey
    && Boolean(rule.altKey) === modifiers.altKey
    && Boolean(rule.ctrlKey) === modifiers.ctrlKey
    && Boolean(rule.metaKey) === modifiers.metaKey)?.step;
}

export function normalizeInputNumberRepeat(value: number | undefined, fallback: number, minimum: number): number {
  return value === undefined || !Number.isFinite(value)
    ? fallback
    : Math.min(60_000, Math.max(minimum, value));
}

export function stepInputNumber(
  input: HTMLInputElement,
  direction: InputNumberStepDirection,
  modifierStep?: number,
): boolean {
  const before = input.value;
  const min = input.min === '' ? -Infinity : Number(input.min);
  const max = input.max === '' ? Infinity : Number(input.max);
  if (input.disabled || input.readOnly || input.step === 'any' || min > max) return false;
  if ((direction === 'increment' && input.valueAsNumber >= max)
    || (direction === 'decrement' && input.valueAsNumber <= min)) return false;

  if (modifierStep === undefined) {
    if (direction === 'increment') input.stepUp();
    else input.stepDown();
  } else {
    // A detached native input anchors the step base at the current value, so
    // modifier steps are absolute deltas without floating-point arithmetic.
    const probe = input.cloneNode(false) as HTMLInputElement;
    probe.removeAttribute('min');
    probe.removeAttribute('max');
    probe.step = String(modifierStep);
    probe.defaultValue = before || '0';
    probe.value = before;
    if (direction === 'increment') probe.stepUp();
    else probe.stepDown();
    const next = probe.valueAsNumber;
    if (!Number.isFinite(next)) return false;
    input.value = String(Math.min(Number.isFinite(max) ? max : Infinity, Math.max(Number.isFinite(min) ? min : -Infinity, next)));
  }
  return before !== input.value;
}
