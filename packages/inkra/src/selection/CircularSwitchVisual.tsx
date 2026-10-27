import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { PencilSurface } from '../PencilSurface.js';
import { PencilText } from '../PencilText.js';
import { ProgressRing } from '../display/ProgressRing.js';
import { useInkraLocale } from '../i18n/index.js';

/** Animate only the clipping percentage; ProgressRing retains its full pencil texture. */
function useSwitchArcProgress(checked: boolean): number {
  const target = checked ? 75 : 0;
  const [progress, setProgress] = useState(target);
  const progressRef = useRef(target);
  const targetRef = useRef(target);
  const frameRef = useRef<number | null>(null);
  const mediaRef = useRef<MediaQueryList | null>(null);
  targetRef.current = target;

  useEffect(() => {
    const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    mediaRef.current = media;
    const change = () => {
      if (!media?.matches) return;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      progressRef.current = targetRef.current;
      setProgress(targetRef.current);
    };
    media?.addEventListener('change', change);
    return () => {
      media?.removeEventListener('change', change);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (progressRef.current === target) return;
    if (mediaRef.current?.matches || typeof requestAnimationFrame !== 'function') {
      progressRef.current = target;
      setProgress(target);
      return;
    }
    const from = progressRef.current;
    let start: number | undefined;
    const tick = (time: number) => {
      frameRef.current = null;
      if (targetRef.current !== target) return;
      start ??= time;
      const fraction = Math.min(1, Math.max(0, (time - start) / 200));
      const eased = fraction * fraction * (3 - 2 * fraction);
      const next = from + (target - from) * eased;
      progressRef.current = next;
      setProgress(next);
      if (fraction < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [target]);
  return progress;
}

export function CircularSwitchVisual({ checked, diameter, centerIcon, centerContent, seed }: {
  checked: boolean;
  diameter: number;
  centerIcon?: ReactNode;
  centerContent?: ReactNode | ((checked: boolean) => ReactNode);
  seed: string | number;
}) {
  const { t } = useInkraLocale();
  const progress = useSwitchArcProgress(checked);
  const radius = diameter / 2 - 25;
  const content = centerContent === undefined ? t(checked ? 'switch.on' : 'switch.off') : typeof centerContent === 'function' ? centerContent(checked) : centerContent;
  const hasIcon = centerIcon != null && typeof centerIcon !== 'boolean';
  const hasContent = content != null && typeof content !== 'boolean';
  const height = (radius - 7) * 2;
  const combined = hasIcon && hasContent;
  const iconSize = combined ? Math.min(24, Math.max(12, 16 + (diameter - 104) / 4), height - 20) : 24;
  const lineHeight = Math.min(diameter <= 112 ? 18 : 24, height - iconSize - 6);
  return <span className="inkra-switch__circular" aria-hidden="true"
    style={{ '--inkra-circular-switch-diameter': `${diameter}px`, '--inkra-circular-switch-center-width': `${(radius - 9) * 2 + 10}px`, '--inkra-circular-switch-center-height': `${height + 6}px`, '--inkra-circular-switch-icon-size': `${iconSize}px`, '--inkra-circular-switch-value-size': combined ? lineHeight < 18 ? '12px' : lineHeight < 22 ? '14px' : 'var(--inkra-text-lg)' : 'var(--inkra-text-lg)', '--inkra-circular-switch-value-line': combined ? `${lineHeight}px` : 'var(--inkra-line-ui)' } as CSSProperties}>
    <span className="inkra-switch__circular-arc">
      <span className="inkra-switch__circular-track"><ProgressRing diameter={diameter - 32} thickness={5} percent={75} seed={`${seed}-track`} /></span>
      <span className="inkra-switch__circular-range"><ProgressRing diameter={diameter - 32} thickness={5} percent={progress} seed={`${seed}-range`} /></span>
    </span>
    {(hasIcon || hasContent) && <span className="inkra-switch__circular-center" inert>
      {hasIcon && <span className="inkra-switch__circular-icon">{centerIcon}</span>}
      {hasContent && <span className="inkra-switch__circular-content">{typeof content === 'string' || typeof content === 'number'
        ? <PencilText className="inkra-switch__circular-value" ellipsis={centerContent !== undefined}>{String(content)}</PencilText> : content}</span>}
    </span>}
    <PencilSurface as="span" className="inkra-switch__circular-focus" variant="outline" radius={diameter / 2} seed={`${seed}-focus`} />
  </span>;
}
