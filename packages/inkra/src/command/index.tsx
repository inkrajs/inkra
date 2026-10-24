import { Command as Primitive } from 'cmdk';
import { __iconData as searchIcon } from 'lucide-react/dist/esm/icons/search.mjs';
import { forwardRef, useCallback, useRef } from 'react';
import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode, Ref } from 'react';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { PencilLine } from '../PencilLine.js';
import { EditablePencilText } from '../form/EditablePencilText.js';
import { PencilIcon } from '../PencilIcon.js';

const searchPaths = searchIcon.node.map(([tag, attributes]) => {
  if (tag === 'circle') {
    const cx = Number(attributes.cx);
    const cy = Number(attributes.cy);
    const r = Number(attributes.r);
    return { d: `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 -${r * 2} 0` };
  }
  return { d: attributes.d };
});

function classes(base: string, extra?: string) { return [base, extra].filter(Boolean).join(' '); }
function copy(value: ReactNode) { return typeof value === 'string' ? <PencilText>{value}</PencilText> : value; }
function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export type CommandRootProps = Omit<ComponentPropsWithoutRef<typeof Primitive>, 'asChild'> & {
  /** Disable when a parent dialog already supplies the paper and outline. */
  surface?: boolean;
};
const Root = forwardRef<HTMLDivElement, CommandRootProps>(function Root({
  className, children, loop = true, surface = true, onKeyDown, onCompositionStartCapture, onCompositionEndCapture, ...props
}, ref) {
  const composing = useRef(false);
  return <Primitive {...props} ref={ref} loop={loop} className={classes('inkra-command', className)}
    onCompositionStartCapture={event => { composing.current = true; onCompositionStartCapture?.(event); }}
    onCompositionEndCapture={event => { composing.current = false; onCompositionEndCapture?.(event); }}
    onKeyDown={event => {
      // Capture composition state as well as native flags before cmdk handles Enter.
      if (event.key === 'Enter' && (composing.current || event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
      onKeyDown?.(event);
    }}>
    {surface ? <PencilSurface variant="paper" radius={8} className="inkra-command__paper">{children}</PencilSurface> : children}
  </Primitive>;
});

export type CommandInputProps = Omit<ComponentPropsWithoutRef<typeof Primitive.Input>, 'asChild'>;
const Input = forwardRef<HTMLInputElement, CommandInputProps>(function Input({ className, defaultValue, placeholder, value, ...props }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const captureRef = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node;
    assignRef(ref, node);
  }, [ref]);
  return <div className="inkra-command__input-wrap inkra-field-control-hit">
    <div className="inkra-command__input-frame">
      <span aria-hidden="true" className="inkra-command__input-icon"><PencilIcon paths={searchPaths} size={22} sourceSize={24} /></span>
      <Primitive.Input {...props} defaultValue={defaultValue} placeholder={placeholder} value={value}
        ref={captureRef} className={classes('inkra-command__input', className)} />
      <EditablePencilText controlRef={inputRef} defaultValue={defaultValue} placeholder={placeholder}
        seed="command-input" value={value} />
    </div>
    <PencilLine className="inkra-command__input-line" />
    <PencilLine className="inkra-command__input-focus-line" seed="command-input-focus" weight={2.2} />
  </div>;
});

export type CommandListProps = Omit<ComponentPropsWithoutRef<typeof Primitive.List>, 'asChild'>;
const List = forwardRef<HTMLDivElement, CommandListProps>(function List({ className, ...props }, ref) {
  return <Primitive.List {...props} ref={ref} className={classes('inkra-command__list', className)} />;
});

export interface CommandItemProps extends Omit<ComponentPropsWithoutRef<typeof Primitive.Item>, 'asChild'> {
  icon?: ReactNode;
  shortcut?: ReactNode;
}
const Item = forwardRef<HTMLDivElement, CommandItemProps>(function Item({ className, children, icon, shortcut, ...props }, ref) {
  return <Primitive.Item {...props} ref={ref} className={classes('inkra-command__item', className)}>
    <PencilSurface as="span" variant="selection" aria-hidden="true" className="inkra-command__highlight" />
    <PencilSurface as="span" variant="outline" aria-hidden="true" className="inkra-command__item-focus" />
    {icon != null && <span aria-hidden="true" className="inkra-command__icon">{icon}</span>}
    <span className="inkra-command__label">{copy(children)}</span>
    {shortcut != null && <Shortcut>{shortcut}</Shortcut>}
  </Primitive.Item>;
});

export type CommandGroupProps = Omit<ComponentPropsWithoutRef<typeof Primitive.Group>, 'asChild'>;
const Group = forwardRef<HTMLDivElement, CommandGroupProps>(function Group({ className, heading, ...props }, ref) {
  return <Primitive.Group {...props} heading={copy(heading)} ref={ref} className={classes('inkra-command__group', className)} />;
});

export type CommandEmptyProps = Omit<ComponentPropsWithoutRef<typeof Primitive.Empty>, 'asChild'>;
const Empty = forwardRef<HTMLDivElement, CommandEmptyProps>(function Empty({ className, children, ...props }, ref) {
  return <Primitive.Empty {...props} ref={ref} className={classes('inkra-command__empty', className)}>{copy(children)}</Primitive.Empty>;
});

export type CommandSeparatorProps = Omit<ComponentPropsWithoutRef<typeof Primitive.Separator>, 'asChild' | 'children'>;
const Separator = forwardRef<HTMLDivElement, CommandSeparatorProps>(function Separator({ className, ...props }, ref) {
  return <Primitive.Separator {...props} ref={ref} className={classes('inkra-command__separator', className)}><PencilLine /></Primitive.Separator>;
});

export type CommandShortcutProps = HTMLAttributes<HTMLElement>;
const Shortcut = forwardRef<HTMLElement, CommandShortcutProps>(function Shortcut({ className, children, ...props }, ref) {
  return <kbd {...props} ref={ref} className={classes('inkra-command__shortcut', className)}>{copy(children)}</kbd>;
});

export const Command = { Root, Input, List, Group, Item, Empty, Separator, Shortcut };
