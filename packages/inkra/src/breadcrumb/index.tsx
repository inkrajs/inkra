import { useInkraLocale } from '../i18n/index.js';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  type ReactNode,
} from 'react';
import {
  Button,
  ButtonLink,
  type ButtonLinkProps,
  type ButtonProps,
} from '../Button.js';
import {
  ContextMenu,
  type ContextMenuTriggerProps,
} from '../context-menu/index.js';
import { DropdownMenu } from '../dropdown-menu/index.js';
import { PencilText } from '../PencilText.js';

const classes = (...values: (string | undefined)[]) => values.filter(Boolean).join(' ');
const copy = (children: ReactNode) => typeof children === 'string' ? <PencilText>{children}</PencilText> : children;

export type BreadcrumbProps = ComponentPropsWithoutRef<'nav'>;
const Root = forwardRef<HTMLElement, BreadcrumbProps>(function BreadcrumbRoot(inkraProps, ref) {
  const { t } = useInkraLocale();
  const { className, 'aria-label': label = t('breadcrumb.label'), ...props } = inkraProps;
  return <nav {...props} ref={ref} aria-label={label} className={classes('inkra-breadcrumb', className)} />;
});
export type BreadcrumbListProps = ComponentPropsWithoutRef<'ol'>;
const List = forwardRef<HTMLOListElement, BreadcrumbListProps>(function BreadcrumbList({ className, ...props }, ref) {
  return <ol {...props} ref={ref} className={classes('inkra-breadcrumb__list', className)} />;
});
export type BreadcrumbItemProps = ComponentPropsWithoutRef<'li'>;
const Item = forwardRef<HTMLLIElement, BreadcrumbItemProps>(function BreadcrumbItem({ className, ...props }, ref) {
  return <li {...props} ref={ref} className={classes('inkra-breadcrumb__item', className)} />;
});
export type BreadcrumbLinkProps = ButtonLinkProps;
const Link = forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(function BreadcrumbLink({ className, variant = 'link', ...props }, ref) {
  return <ButtonLink {...props} ref={ref} variant={variant} className={classes('inkra-breadcrumb__link', className)} />;
});
export type BreadcrumbMenuTriggerProps = ButtonProps;
const MenuTrigger = forwardRef<HTMLButtonElement, BreadcrumbMenuTriggerProps>(function BreadcrumbMenuTrigger({ className, disabled = false, loading = false, variant = 'link', ...props }, ref) {
  return <DropdownMenu.Trigger asChild disabled={disabled || loading}>
    <Button {...props} ref={ref} disabled={disabled} loading={loading} variant={variant} className={classes('inkra-breadcrumb__trigger', className)} />
  </DropdownMenu.Trigger>;
});

type ContextLinkAnchorProps = BreadcrumbLinkProps & { 'aria-disabled'?: boolean | 'true' | 'false' };
const ContextLinkAnchor = forwardRef<HTMLAnchorElement, ContextLinkAnchorProps>(function BreadcrumbContextLinkAnchor({ 'aria-disabled': ariaDisabled, disabled = false, ...props }, ref) {
  const contextDisabled = ariaDisabled === true || ariaDisabled === 'true';
  return <Link {...props} ref={ref} aria-disabled={contextDisabled || disabled || undefined} disabled={contextDisabled || disabled} />;
});

export interface BreadcrumbContextLinkProps extends BreadcrumbLinkProps {
  exclude?: ContextMenuTriggerProps['exclude'];
  longPress?: ContextMenuTriggerProps['longPress'];
  nativeContextMenu?: ContextMenuTriggerProps['nativeContextMenu'];
}
const ContextLink = forwardRef<HTMLAnchorElement, BreadcrumbContextLinkProps>(function BreadcrumbContextLink({ className, disabled = false, exclude, longPress, nativeContextMenu, ...props }, ref) {
  return <ContextMenu.Trigger
    {...(props as ContextMenuTriggerProps)}
    as={ContextLinkAnchor}
    className={classes('inkra-breadcrumb__context-link', className)}
    disabled={disabled || props.loading}
    exclude={exclude}
    longPress={longPress}
    nativeContextMenu={nativeContextMenu}
    ref={ref as ForwardedRef<HTMLElement>}
  />;
});
export interface BreadcrumbPageProps extends ComponentPropsWithoutRef<'span'> {
  endIcon?: ReactNode;
  startIcon?: ReactNode;
}
const Page = forwardRef<HTMLSpanElement, BreadcrumbPageProps>(function BreadcrumbPage({ className, children, endIcon, startIcon, ...props }, ref) {
  const icon = (side: 'start' | 'end', value: ReactNode) => value == null ? null : <span aria-hidden="true" className={`inkra-breadcrumb__icon inkra-breadcrumb__icon--${side}`}>{value}</span>;
  return <span {...props} ref={ref} aria-current="page" className={classes('inkra-breadcrumb__page', className)}>
    {icon('start', startIcon)}
    <span className="inkra-breadcrumb__label">{copy(children)}</span>
    {icon('end', endIcon)}
  </span>;
});
export type BreadcrumbSeparatorProps = ComponentPropsWithoutRef<'li'>;
const Separator = forwardRef<HTMLLIElement, BreadcrumbSeparatorProps>(function BreadcrumbSeparator({ className, children = '/', ...props }, ref) {
  return <li {...props} ref={ref} role="presentation" aria-hidden="true" className={classes('inkra-breadcrumb__separator', className)}>{copy(children)}</li>;
});

export const Breadcrumb = { Root, List, Item, Link, MenuTrigger, ContextLink, Page, Separator };
