import { createContext, forwardRef, useContext, useId } from 'react';
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
} from 'react';

import { PencilSurface } from './PencilSurface.js';
import { PencilText } from './PencilText.js';
import { PencilLine } from './PencilLine.js';
import { InputActionContext } from './internal/InputActionContext.js';
import type { PencilSurfaceVariant } from './PencilSurface.js';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon-xs' | 'icon-sm' | 'icon' | 'icon-lg';
export type ButtonGroupOrientation = 'horizontal' | 'vertical';
export type ButtonAlign = 'start' | 'center' | 'end';
export type ButtonLoadingPosition = 'start' | 'center' | 'end';

const ButtonGroupContext = createContext<{
  orientation: ButtonGroupOrientation;
  size?: ButtonSize;
  variant?: ButtonVariant;
  disabled: boolean;
} | null>(null);

interface ButtonVisualProps {
  children?: ReactNode;
  endIcon?: ReactNode;
  loading: boolean;
  loadingPosition: ButtonLoadingPosition;
  loadingIndicator?: ReactNode;
  seed: string | number;
  startIcon?: ReactNode;
  variant: ButtonVariant;
}

interface SharedButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  seed?: string | number;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  fullWidth?: boolean;
  align?: ButtonAlign;
  loadingPosition?: ButtonLoadingPosition;
  loadingIndicator?: ReactNode;
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, SharedButtonProps {}

export interface ButtonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'>,
    SharedButtonProps {
  children?: ReactNode;
  disabled?: boolean;
}

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: ButtonGroupOrientation;
  size?: ButtonSize;
  variant?: ButtonVariant;
  disabled?: boolean;
  fullWidth?: boolean;
  equalWidth?: boolean;
}

function surfaceVariant(variant: ButtonVariant): PencilSurfaceVariant {
  if (variant === 'primary') return 'action';
  if (variant === 'secondary' || variant === 'ghost') return 'quiet';
  if (variant === 'outline') return 'outline';
  if (variant === 'destructive') return 'danger';
  return 'ghost';
}

function classNames(className?: string): string {
  return ['inkra-button', className].filter(Boolean).join(' ');
}

function accessibleLabel(ariaLabel: string | undefined, loading: boolean, children?: ReactNode) {
  return ariaLabel ?? (loading && typeof children === 'string' ? children : undefined);
}

function ButtonVisual({ children, endIcon, loading, loadingPosition, loadingIndicator, seed, startIcon, variant }: ButtonVisualProps) {
  const group = useContext(ButtonGroupContext);
  const inputAction = useContext(InputActionContext);
  const sharedOutline = group !== null || inputAction;
  const indicator = <span aria-hidden="true" className="inkra-button__loading-indicator">{loadingIndicator ?? <span className="inkra-button__spinner" />}</span>;
  const iconSlot = (side: 'start' | 'end', icon: ReactNode) => {
    const reserved = loadingPosition === side;
    if (icon == null && !reserved) return null;
    return <span aria-hidden="true" className={`inkra-button__icon inkra-button__icon--${side}`} data-loading-slot={reserved || undefined}>
      <span className="inkra-button__icon-content">{icon}</span>
      {reserved && loading ? indicator : null}
    </span>;
  };
  const label = typeof children === 'string'
    ? <PencilText seed={`${seed}-label`}>{children}</PencilText>
    : children == null ? null : <span>{children}</span>;

  return (
    <><PencilSurface<'span'>
      as="span"
      className="inkra-button__surface"
      clipContent={sharedOutline}
      radius={sharedOutline ? 0 : undefined}
      seed={seed}
      variant={inputAction ? 'ghost' : surfaceVariant(variant)}
    >
      <span className="inkra-button__content">
        {loading && loadingPosition === 'center' ? indicator : null}
        {iconSlot('start', startIcon)}
        {label == null ? null : <span className="inkra-button__label">{label}{variant === 'link' ? <PencilLine className="inkra-button__underline" seed={`${seed}-underline`} weight={0.9} /> : null}</span>}
        {iconSlot('end', endIcon)}
      </span>
    </PencilSurface>
    <PencilSurface<'span'>
      as="span"
      aria-hidden="true"
      className="inkra-button__focus-ring"
      variant="outline"
      seed={`${seed}-focus`}
    />
    {group === null ? null : <PencilLine
      className="inkra-button-group__divider"
      orientation={group.orientation === 'horizontal' ? 'vertical' : 'horizontal'}
      seed={`${seed}-group-divider`}
    />}</>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    'aria-label': ariaLabel,
    className,
    disabled = false,
    endIcon,
    loading = false,
    loadingPosition = 'center',
    loadingIndicator,
    fullWidth = false,
    align = 'center',
    seed,
    size: sizeProp,
    startIcon,
    type = 'button',
    variant: variantProp,
    ...props
  },
  ref,
) {
  const id = useId();
  const group = useContext(ButtonGroupContext);
  const size = sizeProp ?? group?.size ?? 'md';
  const variant = variantProp ?? group?.variant ?? 'primary';
  const position = size.startsWith('icon') ? 'center' : loadingPosition;
  const resolvedSeed = seed ?? `inkra-button-${id}`;

  return (
    <button
      {...props}
      aria-label={accessibleLabel(ariaLabel, loading, children)}
      aria-busy={loading || undefined}
      className={classNames(className)}
      data-loading={loading || undefined}
      data-loading-position={position}
      data-full-width={fullWidth && !size.startsWith('icon') || undefined}
      data-align={align}
      data-size={size}
      data-variant={variant}
      disabled={disabled || loading || group?.disabled}
      ref={ref}
      type={type}
    >
      <ButtonVisual
        endIcon={endIcon}
        loading={loading}
        loadingPosition={position}
        loadingIndicator={loadingIndicator}
        seed={resolvedSeed}
        startIcon={startIcon}
        variant={variant}
      >
        {children}
      </ButtonVisual>
    </button>
  );
});

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  {
    children,
    'aria-label': ariaLabel,
    className,
    disabled = false,
    endIcon,
    href,
    loading = false,
    loadingPosition = 'center',
    loadingIndicator,
    fullWidth = false,
    align = 'center',
    onAuxClick,
    onClick,
    onKeyDown,
    seed,
    size: sizeProp,
    startIcon,
    tabIndex,
    variant: variantProp,
    ...props
  },
  ref,
) {
  const id = useId();
  const group = useContext(ButtonGroupContext);
  const size = sizeProp ?? group?.size ?? 'md';
  const variant = variantProp ?? group?.variant ?? 'primary';
  const position = size.startsWith('icon') ? 'center' : loadingPosition;
  const resolvedSeed = seed ?? `inkra-button-link-${id}`;
  const interactionDisabled = disabled || loading || group?.disabled;

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (interactionDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  };

  const handleAuxClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (interactionDisabled) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onAuxClick?.(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (interactionDisabled) {
      if (event.key === 'Enter' || event.key === ' ') event.preventDefault();
      event.stopPropagation();
      return;
    }
    onKeyDown?.(event);
  };

  return (
    <a
      {...props}
      aria-label={accessibleLabel(ariaLabel, loading, children)}
      aria-busy={loading || undefined}
      aria-disabled={interactionDisabled || undefined}
      className={classNames(className)}
      data-disabled={interactionDisabled || undefined}
      data-loading={loading || undefined}
      data-loading-position={position}
      data-full-width={fullWidth && !size.startsWith('icon') || undefined}
      data-align={align}
      data-size={size}
      data-variant={variant}
      href={interactionDisabled ? undefined : href}
      onAuxClick={handleAuxClick}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      ref={ref}
      tabIndex={interactionDisabled ? -1 : tabIndex}
    >
      <ButtonVisual
        endIcon={endIcon}
        loading={loading}
        loadingPosition={position}
        loadingIndicator={loadingIndicator}
        seed={resolvedSeed}
        startIcon={startIcon}
        variant={variant}
      >
        {children}
      </ButtonVisual>
    </a>
  );
});

export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(function ButtonGroup(
  { children, className, orientation = 'horizontal', size, variant, disabled = false, fullWidth = false, equalWidth = false, ...props },
  ref,
) {
  const classes = ['inkra-button-group', className].filter(Boolean).join(' ');
  const id = useId();

  return (
    <ButtonGroupContext.Provider value={{ orientation, size, variant, disabled }}><PencilSurface
      {...props}
      className={classes}
      data-orientation={orientation}
      data-full-width={fullWidth || undefined}
      data-equal-width={equalWidth || undefined}
      aria-disabled={disabled || undefined}
      radius={8}
      ref={ref}
      role="group"
      seed={`inkra-button-group-${id}`}
      variant="outline"
    >{children}</PencilSurface></ButtonGroupContext.Provider>
  );
});
