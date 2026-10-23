import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { createContext, useContext, forwardRef, useId, useState, type HTMLAttributes, type ComponentPropsWithoutRef, type ReactNode, type CSSProperties } from 'react';
import { Button } from '../Button.js';
import { PencilIcon } from '../PencilIcon.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { PencilLine } from '../PencilLine.js';

const classes = (...values: (string | undefined)[]) => values.filter(Boolean).join(' ');
const copy = (children: ReactNode) => typeof children === 'string' ? <PencilText>{children}</PencilText> : children;
const CardDividers = createContext(true);
export type ContentSize = 'sm' | 'md' | 'lg';
export type CardPadding = 'inherit' | 'none' | ContentSize;

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'paper' | 'quiet' | 'outline';
  radius?: number;
  seed?: string | number;
  size?: ContentSize;
  divided?: boolean;
}
const CardRoot = forwardRef<HTMLDivElement, CardProps>(function CardRoot({ className, variant = 'paper', radius = 8, seed, size = 'md', divided = true, ...props }, ref) {
  const id = useId();
  return <CardDividers.Provider value={divided}><PencilSurface {...props} ref={ref} data-size={size} className={classes('inkra-card', className)} variant={variant} radius={radius} seed={seed ?? `card-${id}`} /></CardDividers.Provider>;
});
export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> { action?: ReactNode; divided?: boolean; padding?: CardPadding; align?: 'start' | 'center' | 'end' }
const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(function CardHeader({ className, children, action, divided, padding = 'inherit', align = 'start', ...props }, ref) {
  const inherited = useContext(CardDividers);
  return <div {...props} ref={ref} data-padding={padding} data-align={align} className={classes('inkra-card__header', className)}><div className="inkra-card__heading">{children}</div>{action != null && <div className="inkra-card__action">{action}</div>}{(divided ?? inherited) && <PencilLine className="inkra-card__divider" />}</div>;
});
export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> { as?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6' }
const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(function CardTitle({ className, children, as: Heading = 'h3', ...props }, ref) {
  return <Heading {...props} ref={ref} className={classes('inkra-card__title', className)}>{copy(children)}</Heading>;
});
const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(function CardDescription({ className, children, ...props }, ref) {
  return <p {...props} ref={ref} className={classes('inkra-card__description', className)}>{copy(children)}</p>;
});
export interface CardContentProps extends HTMLAttributes<HTMLDivElement> { padding?: CardPadding }
const CardContent = forwardRef<HTMLDivElement, CardContentProps>(function CardContent({ className, padding = 'inherit', ...props }, ref) {
  return <div {...props} ref={ref} data-padding={padding} className={classes('inkra-card__content', className)} />;
});
export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> { divided?: boolean; justify?: 'start' | 'center' | 'end' | 'between'; padding?: CardPadding; orientation?: 'horizontal' | 'vertical' }
const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(function CardFooter({ className, children, divided, justify = 'start', padding = 'inherit', orientation = 'horizontal', ...props }, ref) {
  const inherited = useContext(CardDividers);
  return <div {...props} ref={ref} data-justify={justify} data-padding={padding} data-orientation={orientation} className={classes('inkra-card__footer', className)}>{(divided ?? inherited) && <PencilLine className="inkra-card__divider" />}{children}</div>;
});
export const Card = { Root: CardRoot, Header: CardHeader, Title: CardTitle, Description: CardDescription, Content: CardContent, Footer: CardFooter };

export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';
export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  icon?: ReactNode;
  seed?: string | number;
  size?: ContentSize;
  appearance?: 'soft' | 'outline';
  actions?: ReactNode;
  closable?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeLabel?: string;
}
const AlertRoot = forwardRef<HTMLDivElement, AlertProps>(function AlertRoot({ className, variant = 'info', icon, seed, style, children, role = 'status', size = 'md', appearance = 'soft', actions, closable = false, open, defaultOpen = true, onOpenChange, closeLabel = 'Dismiss notification', ...props }, ref) {
  const id = useId();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  if (!(open ?? internalOpen)) return null;
  const tokens = {
    color: `var(--inkra-${variant}-foreground)`,
    '--inkra-paper': `var(--inkra-${variant}-surface)`,
    '--inkra-accent': `var(--inkra-${variant}-pigment)`,
    '--inkra-accent-strong': `var(--inkra-${variant}-foreground)`,
    '--inkra-border-strong': `var(--inkra-${variant}-foreground)`,
    '--inkra-border': `var(--inkra-${variant}-foreground)`,
    ...style,
  } as CSSProperties;
  return <PencilSurface {...props} ref={ref} role={role} className={classes('inkra-alert', className)} data-variant={variant} data-size={size} data-appearance={appearance} variant={appearance === 'outline' ? 'outline' : 'action'} radius={8} style={tokens} seed={seed ?? `alert-${id}`}>
    {icon && <span className="inkra-alert__icon" aria-hidden="true">{icon}</span>}
    <div className="inkra-alert__body">{children}{actions != null && <div className="inkra-alert__actions">{actions}</div>}</div>
    {closable && <Button className="inkra-alert__close" variant="ghost" size="icon" aria-label={closeLabel} title={closeLabel} onClick={() => {
      if (open === undefined) setInternalOpen(false);
      onOpenChange?.(false);
    }}><PencilIcon paths={[{ d: 'M18 6 6 18M6 6l12 12' }]} sourceSize={24} size={20} /></Button>}
  </PencilSurface>;
});
const AlertTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(function AlertTitle({ className, children, ...props }, ref) {
  return <p {...props} ref={ref} className={classes('inkra-alert__title', className)}>{copy(children)}</p>;
});
const AlertDescription = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function AlertDescription({ className, children, ...props }, ref) {
  return <div {...props} ref={ref} className={classes('inkra-alert__description', className)}>{copy(children)}</div>;
});
export const Alert = { Root: AlertRoot, Title: AlertTitle, Description: AlertDescription };

export interface AvatarProps extends Omit<AvatarPrimitive.AvatarProps, 'asChild'> {
  size?: 'sm' | 'md' | 'lg';
  radius?: number;
  bordered?: boolean;
}
const AvatarRoot = forwardRef<HTMLSpanElement, AvatarProps>(function AvatarRoot({ className, size = 'md', radius = 8, bordered = true, style, children, ...props }, ref) {
  const corner = Number.isFinite(radius) ? Math.max(0, Math.min(8, radius)) : 8;
  return <AvatarPrimitive.Root {...props} ref={ref} data-size={size} data-bordered={bordered} className={classes('inkra-avatar', className)} style={{ '--inkra-avatar-radius': `${corner}px`, ...style } as CSSProperties}>
    {children}{bordered && <PencilSurface as="span" aria-hidden="true" className="inkra-avatar__outline" variant="outline" radius={corner} />}
  </AvatarPrimitive.Root>;
});
export type AvatarImageProps = Omit<AvatarPrimitive.AvatarImageProps, 'asChild' | 'alt'> & { alt: string; fit?: 'cover' | 'contain' };
const AvatarImage = forwardRef<HTMLImageElement, AvatarImageProps>(function AvatarImage({ className, fit = 'cover', ...props }, ref) {
  return <AvatarPrimitive.Image {...props} ref={ref} data-fit={fit} className={classes('inkra-avatar__image', className)} />;
});
export type AvatarFallbackProps = Omit<AvatarPrimitive.AvatarFallbackProps, 'asChild'>;
const AvatarFallback = forwardRef<HTMLSpanElement, AvatarFallbackProps>(function AvatarFallback({ className, children, ...props }, ref) {
  return <AvatarPrimitive.Fallback {...props} ref={ref} className={classes('inkra-avatar__fallback', className)}>{copy(children)}</AvatarPrimitive.Fallback>;
});
export const Avatar = { Root: AvatarRoot, Image: AvatarImage, Fallback: AvatarFallback };

export interface TableProps extends ComponentPropsWithoutRef<'table'> {
  density?: 'compact' | 'comfortable';
  striped?: boolean;
  hoverable?: boolean;
  stickyHeader?: boolean;
  captionSide?: 'top' | 'bottom';
  layout?: 'auto' | 'fixed';
}
const TableRoot = forwardRef<HTMLTableElement, TableProps>(function TableRoot({ className, density = 'comfortable', striped = false, hoverable = false, stickyHeader = false, captionSide = 'top', layout = 'auto', ...props }, ref) {
  return <table {...props} ref={ref} data-layout={layout} data-density={density} data-striped={striped || undefined} data-hoverable={hoverable || undefined} data-sticky-header={stickyHeader || undefined} data-caption-side={captionSide} className={classes('inkra-table', className)} />;
});
const TableContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function TableContainer({ className, ...props }, ref) {
  return <div tabIndex={0} {...props} ref={ref} className={classes('inkra-table-container', className)} />;
});
const TableHeader = forwardRef<HTMLTableSectionElement, ComponentPropsWithoutRef<'thead'>>(function TableHeader(props, ref) { return <thead {...props} ref={ref} />; });
const TableBody = forwardRef<HTMLTableSectionElement, ComponentPropsWithoutRef<'tbody'>>(function TableBody(props, ref) { return <tbody {...props} ref={ref} />; });
const TableFooter = forwardRef<HTMLTableSectionElement, ComponentPropsWithoutRef<'tfoot'>>(function TableFooter(props, ref) { return <tfoot {...props} ref={ref} />; });
export interface TableRowProps extends ComponentPropsWithoutRef<'tr'> { selected?: boolean }
const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(function TableRow({ selected = false, ...props }, ref) { return <tr {...props} ref={ref} data-selected={selected || undefined} />; });
interface TableCellLayout { verticalAlign?: 'top' | 'middle' | 'bottom'; wrap?: boolean }
export type TableHeadProps = Omit<ComponentPropsWithoutRef<'th'>, 'align'> & TableCellLayout & { align?: ComponentPropsWithoutRef<'th'>['align'] | 'start' | 'end' };
export type TableCellProps = Omit<ComponentPropsWithoutRef<'td'>, 'align'> & TableCellLayout & { align?: ComponentPropsWithoutRef<'td'>['align'] | 'start' | 'end' };
const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(function TableHead({ children, align = 'start', verticalAlign = 'middle', wrap = true, ...props }, ref) {
  return <th scope="col" {...props} ref={ref} data-align={align} data-vertical-align={verticalAlign} data-wrap={wrap}>{wrap ? copy(children) : <div className="inkra-table__nowrap" tabIndex={0}>{copy(children)}</div>}<PencilLine className="inkra-table__divider" /></th>;
});
const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(function TableCell({ children, align = 'start', verticalAlign = 'middle', wrap = true, ...props }, ref) {
  return <td {...props} ref={ref} data-align={align} data-vertical-align={verticalAlign} data-wrap={wrap}>{wrap ? copy(children) : <div className="inkra-table__nowrap" tabIndex={0}>{copy(children)}</div>}<PencilLine className="inkra-table__divider" /></td>;
});
const TableCaption = forwardRef<HTMLTableCaptionElement, ComponentPropsWithoutRef<'caption'>>(function TableCaption({ children, ...props }, ref) { return <caption {...props} ref={ref}>{copy(children)}</caption>; });
export const Table = { Container: TableContainer, Root: TableRoot, Header: TableHeader, Body: TableBody, Footer: TableFooter, Row: TableRow, Head: TableHead, Cell: TableCell, Caption: TableCaption };
