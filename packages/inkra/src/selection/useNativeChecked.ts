import { useEffect, useRef, useState } from 'react';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import type { RefObject } from 'react';

interface NativeCheckedOptions {
  checked?: boolean;
  defaultChecked?: boolean;
  form?: string;
  inputRef: RefObject<HTMLInputElement | null>;
  indeterminate?: boolean;
}

export function useNativeChecked({
  checked,
  defaultChecked,
  form,
  inputRef,
  indeterminate = false,
}: NativeCheckedOptions) {
  const controlled = checked !== undefined;
  const defaultCheckedRef = useRef(Boolean(defaultChecked));
  const checkedRef = useRef(checked);
  const indeterminateRef = useRef(indeterminate);
  const [uncontrolledChecked, setUncontrolledChecked] = useState(defaultCheckedRef.current);
  checkedRef.current = checked;
  indeterminateRef.current = indeterminate;

  useBrowserLayoutEffect(() => {
    const input = inputRef.current;
    if (input) input.indeterminate = indeterminate;
  }, [indeterminate, inputRef]);

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!input || !form) return undefined;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const handleReset = (event: Event) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (event.defaultPrevented) return;
        const restored = controlled ? Boolean(checkedRef.current) : defaultCheckedRef.current;
        input.checked = restored;
        input.indeterminate = indeterminateRef.current;
        if (!controlled) setUncontrolledChecked(restored);
      }, 0);
    };
    form.addEventListener('reset', handleReset);
    return () => {
      clearTimeout(timer);
      form.removeEventListener('reset', handleReset);
    };
  }, [controlled, form, inputRef]);

  return {
    controlled,
    visualChecked: controlled ? Boolean(checked) : uncontrolledChecked,
    syncUncontrolled: setUncontrolledChecked,
  };
}
