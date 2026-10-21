import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { InputActionContext } from '../internal/InputActionContext.js';
import { useSelectionDrawing } from '../internal/useSelectionDrawing.js';

export function InputAction({ children, disabled, seed, position = 'end' }: {
  children: ReactNode;
  disabled: boolean;
  seed: string;
  position?: 'start' | 'end';
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const washRef = useRef<HTMLSpanElement>(null);
  const active = !disabled && (hovered || focused);
  useSelectionDrawing(washRef, active);
  useEffect(() => {
    if (disabled) {
      setHovered(false);
      setFocused(false);
    }
  }, [disabled]);

  return <span
    className={`inkra-input__end-action${position === 'start' ? ' inkra-input__start-action' : ''}`}
    inert={disabled || undefined}
    data-active={active || undefined}
    onPointerEnter={event => { if (event.pointerType !== 'touch') setHovered(true); }}
    onPointerLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)}
    onBlurCapture={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
    }}
  >
    <PencilSurface<'span'> as="span" aria-hidden="true" className="inkra-input__action-wash"
      variant="selection" seed={`${seed}-selection`} ref={washRef} />
    <PencilLine className="inkra-input__action-divider" orientation="vertical" seed={`${seed}-divider`} weight={0.9} />
    <InputActionContext.Provider value>{children}</InputActionContext.Provider>
  </span>;
}
