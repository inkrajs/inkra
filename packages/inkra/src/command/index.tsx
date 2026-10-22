import { Command as Primitive } from 'cmdk';
import { forwardRef, useRef } from 'react';
import type { ComponentPropsWithoutRef, HTMLAttributes, ReactNode } from 'react';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { PencilLine } from '../PencilLine.js';

function classes(base: string, extra?: string) { return [base, extra].filter(Boolean).join(' '); }
function copy(value: ReactNode) { return typeof value === 'string' ? <PencilText>{value}</PencilText> : value; }

export type CommandRootProps = Omit<ComponentPropsWithoutRef<typeof Primitive>, 'asChild'>;
const Root = forwardRef<HTMLDivElement, CommandRootProps>(function Root({
  className, children, loop = true, onKeyDown, onCompositionStartCapture, onCompositionEndCapture, ...props
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
    <PencilSurface variant="paper" radius={8} className="inkra-command__paper">{children}</PencilSurface>
  </Primitive>;
});

export type CommandInputProps = Omit<ComponentPropsWithoutRef<typeof Primitive.Input>, 'asChild'>;
const Input = forwardRef<HTMLInputElement, CommandInputProps>(function Input({ className, ...props }, ref) {
  return <div className="inkra-command__input-wrap"><Primitive.Input {...props} ref={ref} className={classes('inkra-command__input', className)} /><PencilLine className="inkra-command__input-line" /></div>;
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
