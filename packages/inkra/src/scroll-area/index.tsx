import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import type {
  ScrollAreaContentProps as PrimitiveContentProps,
  ScrollAreaContentState as PrimitiveContentState,
  ScrollAreaCornerProps as PrimitiveCornerProps,
  ScrollAreaCornerState as PrimitiveCornerState,
  ScrollAreaRootProps as PrimitiveRootProps,
  ScrollAreaScrollbarProps as PrimitiveScrollbarProps,
  ScrollAreaScrollbarState as PrimitiveScrollbarState,
  ScrollAreaThumbProps as PrimitiveThumbProps,
  ScrollAreaThumbState as PrimitiveThumbState,
  ScrollAreaViewportProps as PrimitiveViewportProps,
  ScrollAreaViewportState as PrimitiveViewportState,
} from '@base-ui/react/scroll-area';
import { forwardRef, useId, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

import { PencilSurface } from '../PencilSurface.js';

export type ScrollAreaVisibility = 'auto' | 'always';

export interface ScrollAreaProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children?: ReactNode;
  /** Keep custom scrollbars visible, or reveal them while scrolling/hovering. */
  type?: ScrollAreaVisibility;
  /** The distance in pixels before overflow edge attributes become active. */
  overflowEdgeThreshold?: PrimitiveRootProps['overflowEdgeThreshold'];
  /** Stable seed used by the pencil scrollbar surfaces. */
  seed?: string | number;
  /** Localized accessible name for the scrollable viewport. */
  viewportLabel?: string;
  viewportProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role'>;
}

export type ScrollAreaRootProps = PrimitiveRootProps;
export type ScrollAreaViewportProps = PrimitiveViewportProps;
export type ScrollAreaScrollbarProps = PrimitiveScrollbarProps;
export type ScrollAreaThumbProps = PrimitiveThumbProps;
export type ScrollAreaContentProps = PrimitiveContentProps;
export type ScrollAreaCornerProps = PrimitiveCornerProps;

function classes(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

function withClassName<State>(base: string, value?: string | ((state: State) => string | undefined)) {
  return typeof value === 'function'
    ? (state: State) => classes(base, value(state))
    : classes(base, value);
}

const ScrollAreaRoot = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollAreaRoot(
  {
    'aria-label': ariaLabel,
    children,
    className,
    overflowEdgeThreshold,
    seed,
    style,
    type = 'auto',
    viewportLabel,
    viewportProps,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const resolvedSeed = seed ?? `inkra-scroll-area-${generatedId}`;
  const viewportClassName = classes('inkra-scroll-area__viewport', viewportProps?.className);
  const viewportStyle = viewportProps?.style as CSSProperties | undefined;
  const viewportLabelValue = viewportProps?.['aria-label'] ?? viewportLabel ?? ariaLabel;

  return <ScrollAreaPrimitive.Root
    {...props}
    {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
    className={classes('inkra-scroll-area', className)}
    data-type={type}
    overflowEdgeThreshold={overflowEdgeThreshold}
    ref={ref}
    style={style}
  >
    <ScrollAreaPrimitive.Viewport
      {...viewportProps}
      aria-label={viewportLabelValue}
      className={viewportClassName}
      style={viewportStyle}
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollAreaPrimitive.Scrollbar className="inkra-scroll-area__scrollbar" orientation="vertical">
      <PencilSurface aria-hidden="true" as="span" className="inkra-scroll-area__track" radius={3} seed={`${resolvedSeed}-vertical-track`} variant="quiet" />
      <ScrollAreaPrimitive.Thumb className="inkra-scroll-area__thumb">
        <PencilSurface aria-hidden="true" as="span" className="inkra-scroll-area__thumb-surface" radius={3} seed={`${resolvedSeed}-vertical-thumb`} variant="outline" />
      </ScrollAreaPrimitive.Thumb>
    </ScrollAreaPrimitive.Scrollbar>
    <ScrollAreaPrimitive.Scrollbar className="inkra-scroll-area__scrollbar" orientation="horizontal">
      <PencilSurface aria-hidden="true" as="span" className="inkra-scroll-area__track" radius={3} seed={`${resolvedSeed}-horizontal-track`} variant="quiet" />
      <ScrollAreaPrimitive.Thumb className="inkra-scroll-area__thumb">
        <PencilSurface aria-hidden="true" as="span" className="inkra-scroll-area__thumb-surface" radius={3} seed={`${resolvedSeed}-horizontal-thumb`} variant="outline" />
      </ScrollAreaPrimitive.Thumb>
    </ScrollAreaPrimitive.Scrollbar>
    <ScrollAreaPrimitive.Corner className="inkra-scroll-area__corner" />
  </ScrollAreaPrimitive.Root>;
});

const Viewport = forwardRef<HTMLDivElement, ScrollAreaViewportProps>(function Viewport({ className, ...props }, ref) {
  return <ScrollAreaPrimitive.Viewport {...props} className={withClassName<PrimitiveViewportState>('inkra-scroll-area__viewport', className)} ref={ref} />;
});

const Content = forwardRef<HTMLDivElement, ScrollAreaContentProps>(function Content({ className, ...props }, ref) {
  return <ScrollAreaPrimitive.Content {...props} className={withClassName<PrimitiveContentState>('inkra-scroll-area__content', className)} ref={ref} />;
});

const Scrollbar = forwardRef<HTMLDivElement, ScrollAreaScrollbarProps>(function Scrollbar({ className, ...props }, ref) {
  return <ScrollAreaPrimitive.Scrollbar {...props} className={withClassName<PrimitiveScrollbarState>('inkra-scroll-area__scrollbar', className)} ref={ref} />;
});

const Thumb = forwardRef<HTMLDivElement, ScrollAreaThumbProps>(function Thumb({ className, ...props }, ref) {
  return <ScrollAreaPrimitive.Thumb {...props} className={withClassName<PrimitiveThumbState>('inkra-scroll-area__thumb', className)} ref={ref} />;
});

const Corner = forwardRef<HTMLDivElement, ScrollAreaCornerProps>(function Corner({ className, ...props }, ref) {
  return <ScrollAreaPrimitive.Corner {...props} className={withClassName<PrimitiveCornerState>('inkra-scroll-area__corner', className)} ref={ref} />;
});

export const ScrollArea = Object.assign(ScrollAreaRoot, {
  Root: ScrollAreaRoot,
  Viewport,
  Content,
  Scrollbar,
  Thumb,
  Corner,
});

export { ScrollAreaRoot, Viewport as ScrollAreaViewport, Content as ScrollAreaContent, Scrollbar as ScrollAreaScrollbar, Thumb as ScrollAreaThumb, Corner as ScrollAreaCorner };
