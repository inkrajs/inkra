import { createContext, useContext } from 'react';

export interface FieldContextValue {
  controlId: string;
  descriptionId?: string;
  errorId?: string;
  required: boolean;
  invalid: boolean;
  disabled: boolean;
  readOnly: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);

export function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext);
}

export function mergeAriaIds(...values: Array<string | undefined>): string | undefined {
  const ids = values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
  const merged = Array.from(new Set(ids));
  return merged.length ? merged.join(' ') : undefined;
}
