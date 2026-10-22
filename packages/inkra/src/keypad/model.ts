import type { ReactNode } from 'react';

export type KeypadAction = 'input' | 'delete' | 'confirm' | 'custom';
export type KeypadKeyVariant = 'default' | 'secondary' | 'confirm' | 'danger';

export interface KeypadKey {
  id: string;
  label: ReactNode;
  action?: KeypadAction;
  value?: string;
  ariaLabel?: string;
  disabled?: boolean;
  span?: number;
  variant?: KeypadKeyVariant;
}

export interface KeypadValueResult {
  nextValue: string;
  changed: boolean;
}

function removeLastGrapheme(value: string): string {
  if (value.length === 0) return value;
  const Segmenter = (Intl as unknown as { Segmenter?: new (
    locale?: string | string[],
    options?: { granularity: 'grapheme' },
  ) => { segment(input: string): Iterable<{ index: number }> } }).Segmenter;
  if (Segmenter) {
    const segments = Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(value));
    const last = segments[segments.length - 1];
    return last ? value.slice(0, last.index) : '';
  }
  return Array.from(value).slice(0, -1).join('');
}

export function getKeypadAction(key: KeypadKey): KeypadAction {
  return key.action ?? 'input';
}

export function applyKeypadKey(value: string, key: KeypadKey, maxLength?: number): KeypadValueResult {
  const action = getKeypadAction(key);
  if (action === 'delete') {
    const nextValue = removeLastGrapheme(value);
    return { nextValue, changed: nextValue !== value };
  }
  if (action !== 'input') return { nextValue: value, changed: false };

  const addition = key.value ?? (typeof key.label === 'string' || typeof key.label === 'number' ? String(key.label) : '');
  if (addition.length === 0) return { nextValue: value, changed: false };
  if (maxLength !== undefined && value.length + addition.length > maxLength) {
    return { nextValue: value, changed: false };
  }
  return { nextValue: value + addition, changed: true };
}

export function getKeypadColumnCount(layout: readonly (readonly KeypadKey[])[]): number {
  return Math.max(1, ...layout.map(row => row.reduce((total, key) => total + Math.max(1, Math.floor(key.span ?? 1)), 0)));
}

