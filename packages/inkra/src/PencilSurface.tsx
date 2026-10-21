import { forwardRef, useImperativeHandle, useRef } from 'react';
import type {
  ComponentPropsWithoutRef,
  ComponentPropsWithRef,
  ElementType,
  ReactElement,
  ReactNode,
} from 'react';

import type { PencilSurfaceVariant } from './internal/surfaceRenderer.js';
import { usePencilSurface } from './internal/usePencilSurface.js';

interface PencilSurfaceBaseProps {
  variant?: PencilSurfaceVariant;
  seed?: string | number;
  clipContent?: boolean;
  radius?: number;
  className?: string;
  children?: ReactNode;
}

type PencilSurfaceOwnProps<Element extends ElementType> = PencilSurfaceBaseProps & { as?: Element };

export type PencilSurfaceProps<Element extends ElementType = 'div'> = PencilSurfaceOwnProps<Element>
  & Omit<ComponentPropsWithoutRef<Element>, keyof PencilSurfaceOwnProps<Element>>;

type PencilSurfaceComponent = <Element extends ElementType = 'div'>(
  props: PencilSurfaceProps<Element> & { ref?: ComponentPropsWithRef<Element>['ref'] },
) => ReactElement | null;

type PencilSurfaceImplementationProps = PencilSurfaceBaseProps & { as?: ElementType } & Record<string, any>;

const PencilSurfaceImplementation = forwardRef<HTMLElement, PencilSurfaceImplementationProps>(
  function PencilSurface(
    {
      as: Element = 'div',
      variant = 'paper',
      seed = 23,
      className = '',
      clipContent = false,
      radius,
      children,
      ...props
    },
    forwardedRef,
  ) {
    const rootRef = useRef<HTMLElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const borderRef = useRef<HTMLCanvasElement>(null);
    useImperativeHandle(forwardedRef, () => rootRef.current as HTMLElement);
    usePencilSurface(rootRef, canvasRef, borderRef, variant, seed, clipContent, radius);
    const classes = [
      'inkra-pencil-surface',
      `inkra-pencil-surface--${variant}`,
      clipContent && 'inkra-pencil-surface--clipped',
      className,
    ].filter(Boolean).join(' ');
    const nativeProps = Element === 'button' ? { type: 'button', ...props } : props;

    return (
      <Element {...nativeProps} className={classes} ref={rootRef}>
        <canvas aria-hidden="true" className="inkra-pencil-surface__ink" ref={canvasRef} />
        {clipContent ? (
          <>
            <span className="inkra-pencil-surface__content">{children}</span>
            <canvas aria-hidden="true" className="inkra-pencil-surface__border" ref={borderRef} />
          </>
        ) : children}
      </Element>
    );
  },
);

export const PencilSurface = PencilSurfaceImplementation as PencilSurfaceComponent;
export type { PencilSurfaceVariant };
