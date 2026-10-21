import { useEffect, useState } from 'react';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import type { RefObject } from 'react';

interface NativeCheckedOptions {
  checked?: boolean;
  defaultChecked?: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  indeterminate?: boolean;
}

export function useNativeChecked({
  checked,
  defaultChecked,
  inputRef,
  indeterminate = false,
}: NativeCheckedOptions) {
  const controlled = checked !== undefined;
  const [uncontrolledChecked, setUncontrolledChecked] = useState(Boolean(defaultChecked));

  useBrowserLayoutEffect(() => {
    const input = inputRef.current;
    if (input) input.indeterminate = indeterminate;
  }, [indeterminate, inputRef]);

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!input || !form || controlled) return undefined;

    const handleReset = () => {
      queueMicrotask(() => setUncontrolledChecked(input.checked));
    };
    form.addEventListener('reset', handleReset);
    return () => form.removeEventListener('reset', handleReset);
  }, [controlled, inputRef]);

  return {
    controlled,
    visualChecked: controlled ? Boolean(checked) : uncontrolledChecked,
    syncUncontrolled: setUncontrolledChecked,
  };
}
