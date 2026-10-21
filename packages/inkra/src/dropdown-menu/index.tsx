import * as Primitive from '@radix-ui/react-dropdown-menu';
import { forwardRef, useId, type ReactNode } from 'react';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilLine } from '../PencilLine.js';
import { PortalThemeBridge, PortalThemeProvider, usePortalTriggerRef } from '../overlay/themeBridge.js';

const classes = (...values: (string | undefined)[]) => values.filter(Boolean).join(' ');
const copy = (children: ReactNode) => typeof children === 'string' ? <PencilText>{children}</PencilText> : children;
export type DropdownMenuProps = Primitive.DropdownMenuProps;
function Root(props: DropdownMenuProps) { return <PortalThemeProvider><Primitive.Root {...props} /></PortalThemeProvider>; }
export type DropdownMenuTriggerProps = Primitive.DropdownMenuTriggerProps;
const Trigger = forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(function Trigger(props, ref) {
  return <Primitive.Trigger {...props} ref={usePortalTriggerRef(ref)} />;
});
export type DropdownMenuPortalProps = Primitive.DropdownMenuPortalProps;
function Portal({ children, ...props }: DropdownMenuPortalProps) { return <Primitive.Portal {...props}><PortalThemeBridge>{children}</PortalThemeBridge></Primitive.Portal>; }
export interface DropdownMenuContentProps extends Omit<Primitive.DropdownMenuContentProps, 'asChild'> {
  seed?: string | number;
}
const Content = forwardRef<HTMLDivElement, DropdownMenuContentProps>(function Content({ className, children, seed, sideOffset = 6, collisionPadding = 8, ...props }, ref) {
  const id = useId();
  return <Primitive.Content {...props} ref={ref} sideOffset={sideOffset} collisionPadding={collisionPadding} className={classes('inkra-menu', className)}>
    <PencilSurface variant="paper" radius={8} seed={seed ?? `menu-${id}`} className="inkra-menu__paper">{children}</PencilSurface>
  </Primitive.Content>;
});
export interface DropdownMenuItemProps extends Omit<Primitive.DropdownMenuItemProps, 'asChild'> {
  destructive?: boolean;
  icon?: ReactNode;
}
function ItemBody({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return <><PencilSurface as="span" aria-hidden="true" variant="selection" className="inkra-menu__highlight" /><span className="inkra-menu__icon" aria-hidden="true">{icon}</span><span className="inkra-menu__label">{copy(children)}</span></>;
}
const Item = forwardRef<HTMLDivElement, DropdownMenuItemProps>(function Item({ className, children, destructive = false, icon, ...props }, ref) {
  return <Primitive.Item {...props} ref={ref} data-destructive={destructive || undefined} className={classes('inkra-menu__item', className)}><ItemBody icon={icon}>{children}</ItemBody></Primitive.Item>;
});
export type DropdownMenuCheckboxItemProps = Omit<Primitive.DropdownMenuCheckboxItemProps, 'asChild'>;
const CheckboxItem = forwardRef<HTMLDivElement, DropdownMenuCheckboxItemProps>(function CheckboxItem({ className, children, checked, ...props }, ref) {
  const indicator = <Primitive.ItemIndicator><PencilIcon size={16} sourceSize={24} paths={[{ d: checked === 'indeterminate' ? 'M5 12h14' : 'M5 12.5L10 17L19 7' }]} /></Primitive.ItemIndicator>;
  return <Primitive.CheckboxItem {...props} checked={checked} ref={ref} className={classes('inkra-menu__item', className)}><ItemBody icon={indicator}>{children}</ItemBody></Primitive.CheckboxItem>;
});
export type DropdownMenuRadioItemProps = Omit<Primitive.DropdownMenuRadioItemProps, 'asChild'>;
const RadioItem = forwardRef<HTMLDivElement, DropdownMenuRadioItemProps>(function RadioItem({ className, children, ...props }, ref) {
  const indicator = <Primitive.ItemIndicator><PencilIcon size={16} sourceSize={24} paths={[{ d: 'M5 12.5L10 17L19 7' }]} /></Primitive.ItemIndicator>;
  return <Primitive.RadioItem {...props} ref={ref} className={classes('inkra-menu__item', className)}><ItemBody icon={indicator}>{children}</ItemBody></Primitive.RadioItem>;
});
export type DropdownMenuLabelProps = Omit<Primitive.DropdownMenuLabelProps, 'asChild'>;
const Label = forwardRef<HTMLDivElement, DropdownMenuLabelProps>(function Label({ className, children, ...props }, ref) {
  return <Primitive.Label {...props} ref={ref} className={classes('inkra-menu__group-label', className)}>{copy(children)}</Primitive.Label>;
});
export type DropdownMenuSeparatorProps = Omit<Primitive.DropdownMenuSeparatorProps, 'asChild' | 'children'>;
const Separator = forwardRef<HTMLDivElement, DropdownMenuSeparatorProps>(function Separator({ className, ...props }, ref) {
  return <Primitive.Separator {...props} ref={ref} className={classes('inkra-menu__separator', className)}><PencilLine /></Primitive.Separator>;
});
export type DropdownMenuGroupProps = Primitive.DropdownMenuGroupProps;
export type DropdownMenuRadioGroupProps = Primitive.DropdownMenuRadioGroupProps;
export const DropdownMenu = { Root, Trigger, Portal, Content, Item, CheckboxItem, RadioItem, Label, Separator, Group: Primitive.Group, RadioGroup: Primitive.RadioGroup };
