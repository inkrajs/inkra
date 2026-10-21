import type { AriaAttributes } from 'react';

import { mergeAriaIds, useFieldContext } from './context.js';

interface NativeControlState {
  id?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  'aria-describedby'?: string;
  'aria-errormessage'?: string;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
}

export function useResolvedControlProps(props: NativeControlState & { invalid?: boolean }) {
  const field = useFieldContext();
  const resolvedInvalid = Boolean(
    props.invalid
    || field?.invalid
    || props['aria-invalid'] === true
    || props['aria-invalid'] === 'true',
  );
  const describedBy = mergeAriaIds(
    props['aria-describedby'],
    field?.descriptionId,
    field?.errorId,
  );
  const errorMessage = mergeAriaIds(
    props['aria-errormessage'],
    resolvedInvalid ? field?.errorId : undefined,
  );

  return {
    id: field?.controlId ?? props.id,
    required: Boolean(props.required || field?.required),
    disabled: Boolean(props.disabled || field?.disabled),
    readOnly: Boolean(props.readOnly || field?.readOnly),
    invalid: resolvedInvalid,
    describedBy,
    errorMessage,
    ariaInvalid: resolvedInvalid ? true : props['aria-invalid'],
  };
}
