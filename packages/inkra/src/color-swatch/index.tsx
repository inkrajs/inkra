import { forwardRef, useId } from 'react';
import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import { Button } from '../Button.js';
import { PencilSurface } from '../PencilSurface.js';

export interface ColorSwatchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'color' | 'aria-pressed'> {
  color: string;
  background?: CSSProperties['background'];
  label: string;
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  seed?: string | number;
}

export const ColorSwatch = forwardRef<HTMLButtonElement, ColorSwatchProps>(function ColorSwatch({
  color, background, label, selected = false, size = 'md', seed, className, ...props
}, ref) {
  const id = useId();
  const resolvedSeed = seed ?? `inkra-color-swatch-${id}`;
  return <Button
    title={label}
    {...props}
    aria-label={props['aria-label'] ?? label}
    aria-pressed={selected}
    className={['inkra-color-swatch', className].filter(Boolean).join(' ')}
    data-swatch-size={size}
    ref={ref}
    seed={resolvedSeed}
    size={size === 'lg' ? 'icon-lg' : 'icon'}
    variant={selected ? 'outline' : 'ghost'}
  >
    <span className="inkra-color-swatch__pigment" style={{ color }} aria-hidden="true">
      {background ? <span className="inkra-color-swatch__background" style={{ background }}>
        <PencilSurface as="span" className="inkra-color-swatch__wash" variant="outline" seed={`${resolvedSeed}-wash`} />
      </span> : <PencilSurface as="span" className="inkra-color-swatch__wash" variant="wash"
        seed={`${resolvedSeed}-wash`} style={{ '--inkra-accent': 'currentColor' } as CSSProperties} />}
    </span>
  </Button>;
});
