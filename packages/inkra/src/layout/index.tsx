import { createElement, forwardRef } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import { PencilLine } from '../PencilLine.js';

export type LayoutSpace = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;
export type LayoutElement = 'div' | 'section' | 'article' | 'nav' | 'header' | 'footer' | 'main' | 'aside' | 'ul' | 'ol' | 'li';
export type LayoutAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type LayoutJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
interface LayoutElementProps extends HTMLAttributes<HTMLElement> {
  as?: LayoutElement;
}
const Box = forwardRef<HTMLElement, LayoutElementProps>(function Box({ as = 'div', ...props }, ref) {
  return createElement(as, { ...props, ref });
});
type LayoutStyle = CSSProperties & Record<`--inkra-${string}`, string | number | undefined>;
const classes = (...values: Array<string | undefined>) => values.filter(Boolean).join(' ');
const space = (value: LayoutSpace) => `var(--inkra-space-${value}, ${value * 4}px)`;
const justifyValues = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between', around: 'space-around', evenly: 'space-evenly' } as const;
const alignValues = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', baseline: 'baseline' } as const;

export interface FlexProps extends LayoutElementProps {
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  gap?: LayoutSpace;
  align?: LayoutAlign;
  justify?: LayoutJustify;
  wrap?: boolean;
  inline?: boolean;
}

export const Flex = forwardRef<HTMLElement, FlexProps>(function Flex({
  as: Element = 'div', direction = 'row', gap = 3, align = 'stretch',
  justify = 'start', wrap = false, inline = false, className, style, ...props
}, ref) {
  return <Box as={Element} {...props} ref={ref} className={classes('inkra-flex', className)}
    style={{ display: inline ? 'inline-flex' : 'flex', flexDirection: direction,
      gap: space(gap), alignItems: alignValues[align], justifyContent: justifyValues[justify],
      flexWrap: wrap ? 'wrap' : 'nowrap', ...style }} />;
});

export type StackProps = FlexProps;
export const Stack = forwardRef<HTMLElement, StackProps>(function Stack({ direction = 'column', className, ...props }, ref) {
  return <Flex {...props} ref={ref} direction={direction} className={classes('inkra-stack', className)} />;
});

export interface GridColumns {
  base?: number;
  sm?: number;
  md?: number;
  lg?: number;
}
export interface GridProps extends LayoutElementProps {
  columns?: number | GridColumns;
  gap?: LayoutSpace;
  rowGap?: LayoutSpace;
  columnGap?: LayoutSpace;
  align?: LayoutAlign;
}
const columnCount = (value: number | undefined, fallback: number) =>
  value === undefined || !Number.isFinite(value) ? fallback : Math.min(12, Math.max(1, Math.trunc(value)));

export const Grid = forwardRef<HTMLElement, GridProps>(function Grid({
  as: Element = 'div', columns = 1, gap = 3, rowGap = gap, columnGap = gap,
  align = 'stretch', className, style, ...props
}, ref) {
  const responsive = typeof columns === 'number' ? { base: columns } : columns;
  const base = columnCount(responsive.base, 1);
  const sm = columnCount(responsive.sm, base);
  const md = columnCount(responsive.md, sm);
  const lg = columnCount(responsive.lg, md);
  const resolvedStyle: LayoutStyle = {
    '--inkra-grid-base': base, '--inkra-grid-sm': sm, '--inkra-grid-md': md, '--inkra-grid-lg': lg,
    rowGap: space(rowGap), columnGap: space(columnGap), alignItems: alignValues[align], ...style,
  };
  return <Box as={Element} {...props} ref={ref} className={classes('inkra-grid', className)} style={resolvedStyle} />;
});

export interface ContainerProps extends LayoutElementProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: LayoutSpace;
  centered?: boolean;
}
const containerWidths = { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', full: 'none' };
export const Container = forwardRef<HTMLElement, ContainerProps>(function Container({
  as: Element = 'div', size = 'lg', padding = 5, centered = true, className, style, ...props
}, ref) {
  return <Box as={Element} {...props} ref={ref} className={classes('inkra-container', className)}
    style={{ maxWidth: containerWidths[size], paddingInline: space(padding),
      marginInline: centered ? 'auto' : 0, ...style }} />;
});

export interface LayoutProps extends LayoutElementProps {
  gap?: LayoutSpace;
  collapseAt?: 'sm' | 'md' | 'never';
}
const LayoutRoot = forwardRef<HTMLElement, LayoutProps>(function LayoutRoot({
  as: Element = 'div', gap = 0, collapseAt = 'sm', className, style, ...props
}, ref) {
  return <Box as={Element} {...props} ref={ref} className={classes('inkra-layout', className)}
    data-collapse-at={collapseAt} style={{ gap: space(gap), ...style }} />;
});

export interface LayoutBodyProps extends LayoutElementProps { gap?: LayoutSpace }
const LayoutBody = forwardRef<HTMLElement, LayoutBodyProps>(function LayoutBody({
  as: Element = 'div', gap = 0, className, style, ...props
}, ref) {
  return <Box as={Element} {...props} ref={ref} className={classes('inkra-layout__body', className)} style={{ gap: space(gap), ...style }} />;
});

export interface LayoutRegionProps extends LayoutElementProps {
  padding?: LayoutSpace;
  divided?: boolean;
}
export interface LayoutSidebarProps extends LayoutRegionProps {
  width?: CSSProperties['width'];
}
const LayoutHeader = forwardRef<HTMLElement, LayoutRegionProps>(function LayoutHeader({
  as: Element = 'header', padding = 5, divided = false, className, style, children, ...props
}, ref) {
  return <Box as={Element} {...props} ref={ref} className={classes('inkra-layout__header', className)}
    style={{ padding: space(padding), ...style }}>
    {children}{divided && <PencilLine className="inkra-layout__divider" />}
  </Box>;
});
const LayoutFooter = forwardRef<HTMLElement, LayoutRegionProps>(function LayoutFooter({
  as: Element = 'footer', padding = 5, divided = false, className, style, children, ...props
}, ref) {
  return <Box as={Element} {...props} ref={ref} className={classes('inkra-layout__footer', className)}
    style={{ padding: space(padding), ...style }}>
    {divided && <PencilLine className="inkra-layout__divider" />}{children}
  </Box>;
});
const LayoutSidebar = forwardRef<HTMLElement, LayoutSidebarProps>(function LayoutSidebar({
  as: Element = 'aside', width = 240, padding = 5, divided = false, className, style, children, ...props
}, ref) {
  const resolvedStyle: LayoutStyle = {
    '--inkra-layout-sidebar-width': typeof width === 'number' ? `${width}px` : width,
    padding: space(padding), ...style,
  };
  return <Box as={Element} {...props} ref={ref} className={classes('inkra-layout__sidebar', className)} style={resolvedStyle}>
    {children}{divided && <>
      <PencilLine className="inkra-layout__sidebar-divider" orientation="vertical" />
      <PencilLine className="inkra-layout__sidebar-divider-mobile" />
    </>}
  </Box>;
});
export type LayoutContentProps = Omit<LayoutRegionProps, 'divided'>;
const LayoutContent = forwardRef<HTMLElement, LayoutContentProps>(function LayoutContent({
  as: Element = 'div', padding = 5, className, style, ...props
}, ref) {
  return <Box as={Element} {...props} ref={ref} className={classes('inkra-layout__content', className)}
    style={{ padding: space(padding), ...style }} />;
});
export const Layout = /* @__PURE__ */ Object.freeze({
  Root: LayoutRoot, Header: LayoutHeader, Body: LayoutBody,
  Sidebar: LayoutSidebar, Content: LayoutContent, Footer: LayoutFooter,
});
