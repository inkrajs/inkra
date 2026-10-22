import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Toggle as BaseToggle } from '@base-ui/react/toggle';
import { ToggleGroup as BaseToggleGroup } from '@base-ui/react/toggle-group';
import { createContext, forwardRef, useContext } from 'react';
import type { ReactElement, ReactNode, RefAttributes } from 'react';

import { PencilLine } from '../PencilLine.js';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';

function classes<State>(base: string, className?: string | ((state: State) => string | undefined)) {
  if (typeof className === 'function') {
    return (state: State) => [base, className(state)].filter(Boolean).join(' ');
  }
  return [base, className].filter(Boolean).join(' ');
}

export interface ToggleGroupRootProps<Value extends string = string>
  extends BaseToggleGroup.Props<Value> {
  size?: 'sm' | 'md' | 'lg';
}

const OrientationContext = createContext<'horizontal' | 'vertical'>('horizontal');

type RootComponent = <Value extends string = string>(
  props: ToggleGroupRootProps<Value> & RefAttributes<HTMLDivElement>,
) => ReactElement;

const RootImplementation = forwardRef<HTMLDivElement, ToggleGroupRootProps<string>>(
  function ToggleGroupRoot({ children, className, dir, orientation = 'horizontal', size = 'md', ...props }, ref) {
    const direction = dir === 'rtl' ? 'rtl' : 'ltr';
    return (
      <DirectionProvider direction={direction}>
        <OrientationContext.Provider value={orientation}>
          <BaseToggleGroup
            {...props}
            className={classes<BaseToggleGroup.State>('inkra-toggle-group', className)}
            data-size={size}
            dir={dir}
            orientation={orientation}
            ref={ref}
          >
            <PencilSurface
              aria-hidden="true"
              as="span"
              className="inkra-toggle-group__outline"
              seed="toggle-group-outline"
              variant="outline"
            />
            {children}
          </BaseToggleGroup>
        </OrientationContext.Provider>
      </DirectionProvider>
    );
  },
);

export interface ToggleGroupItemProps<Value extends string = string>
  extends BaseToggle.Props<Value> {
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

type ItemComponent = <Value extends string = string>(
  props: ToggleGroupItemProps<Value> & RefAttributes<HTMLButtonElement>,
) => ReactElement;

const ItemImplementation = forwardRef<HTMLButtonElement, ToggleGroupItemProps<string>>(
  function ToggleGroupItem({ children, className, endIcon, startIcon, value, ...props }, ref) {
    const orientation = useContext(OrientationContext);
    return (
      <BaseToggle {...props} className={classes<BaseToggle.State>('inkra-toggle-group__item', className)} ref={ref} value={value}>
        <PencilLine
          className="inkra-toggle-group__divider"
          orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
          seed={`toggle-${value ?? 'item'}-divider`}
        />
        <PencilSurface aria-hidden="true" as="span" className="inkra-toggle-group__selection" seed={`toggle-${value ?? 'item'}`} variant="selection" />
        <PencilSurface aria-hidden="true" as="span" className="inkra-toggle-group__focus" seed={`toggle-${value ?? 'item'}-focus`} variant="outline" />
        {startIcon != null && <span aria-hidden="true" className="inkra-toggle-group__icon">{startIcon}</span>}
        <span className="inkra-toggle-group__label">
          {typeof children === 'string' ? <PencilText>{children}</PencilText> : children}
        </span>
        {endIcon != null && <span aria-hidden="true" className="inkra-toggle-group__icon">{endIcon}</span>}
      </BaseToggle>
    );
  },
);

const Root = RootImplementation as RootComponent;
const Item = ItemImplementation as ItemComponent;

export const ToggleGroup = { Root, Item };
