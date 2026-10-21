import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { ButtonLink, type ButtonLinkProps } from '../Button.js';
import { PencilText } from '../PencilText.js';

const classes = (...values: (string | undefined)[]) => values.filter(Boolean).join(' ');
const copy = (children: ReactNode) => typeof children === 'string' ? <PencilText>{children}</PencilText> : children;

export type BreadcrumbProps = ComponentPropsWithoutRef<'nav'>;
const Root = forwardRef<HTMLElement, BreadcrumbProps>(function BreadcrumbRoot({ className, 'aria-label': label = 'Breadcrumb', ...props }, ref) {
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
const Link = forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(function BreadcrumbLink({ className, variant = 'ghost', ...props }, ref) {
  return <ButtonLink {...props} ref={ref} variant={variant} className={classes('inkra-breadcrumb__link', className)} />;
});
export type BreadcrumbPageProps = ComponentPropsWithoutRef<'span'>;
const Page = forwardRef<HTMLSpanElement, BreadcrumbPageProps>(function BreadcrumbPage({ className, children, ...props }, ref) {
  return <span {...props} ref={ref} aria-current="page" className={classes('inkra-breadcrumb__page', className)}>{copy(children)}</span>;
});
export type BreadcrumbSeparatorProps = ComponentPropsWithoutRef<'li'>;
const Separator = forwardRef<HTMLLIElement, BreadcrumbSeparatorProps>(function BreadcrumbSeparator({ className, children = '/', ...props }, ref) {
  return <li {...props} ref={ref} role="presentation" aria-hidden="true" className={classes('inkra-breadcrumb__separator', className)}>{copy(children)}</li>;
});

export const Breadcrumb = { Root, List, Item, Link, Page, Separator };
