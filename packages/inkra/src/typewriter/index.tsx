import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ComponentPropsWithoutRef } from 'react';

import { PencilText } from '../PencilText.js';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';
import { splitTypewriterGraphemes, typewriterDelayAfter } from './model.js';

export interface TypewriterHandle {
  pause: () => void;
  resume: () => void;
  complete: () => void;
  restart: () => void;
}

export interface TypewriterProps extends Omit<ComponentPropsWithoutRef<'span'>, 'children'> {
  children: string;
  speed?: number;
  punctuationDelay?: number;
  startDelay?: number;
  paused?: boolean;
  defaultPaused?: boolean;
  locale?: string | string[];
  onPausedChange?: (paused: boolean) => void;
  onComplete?: () => void;
}

interface SequenceState {
  text: string;
  revealed: number;
  cycle: number;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useBrowserLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

function safeDuration(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

const TypewriterGrapheme = memo(function TypewriterGrapheme({ grapheme, index, revealed: isRevealed }: {
  grapheme: string;
  index: number;
  revealed: boolean;
}) {
  if (grapheme === '\n') return <br />;
  if (/^\s+$/u.test(grapheme)) {
    return <span className="inkra-typewriter__space" data-revealed={isRevealed}>{grapheme}</span>;
  }
  return <PencilText
    className="inkra-typewriter__grapheme"
    data-revealed={isRevealed}
    seed={`typewriter-${index}-${grapheme}`}
  >{grapheme}</PencilText>;
});

export const Typewriter = forwardRef<TypewriterHandle, TypewriterProps>(function Typewriter(
  {
    children,
    className,
    defaultPaused = false,
    locale,
    onComplete,
    onPausedChange,
    paused,
    punctuationDelay = 240,
    speed = 48,
    startDelay = 0,
    ...props
  },
  forwardedRef,
) {
  const graphemes = useMemo(() => splitTypewriterGraphemes(children, locale), [children, locale]);
  const [internalPaused, setInternalPaused] = useState(defaultPaused);
  const [sequence, setSequence] = useState<SequenceState>({ text: children, revealed: 0, cycle: 0 });
  const completedCycleRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  const reducedMotion = usePrefersReducedMotion();
  const isPaused = paused ?? internalPaused;
  const activeSequence = sequence.text === children
    ? sequence
    : { text: children, revealed: 0, cycle: sequence.cycle + 1 };
  const revealed = Math.min(activeSequence.revealed, graphemes.length);
  const complete = revealed >= graphemes.length;

  onCompleteRef.current = onComplete;

  const requestPaused = (nextPaused: boolean) => {
    if (paused === undefined) setInternalPaused(nextPaused);
    if (nextPaused !== isPaused) onPausedChange?.(nextPaused);
  };

  const revealAll = () => {
    setSequence(current => ({
      text: children,
      revealed: graphemes.length,
      cycle: current.text === children ? current.cycle : current.cycle + 1,
    }));
  };

  const restart = () => {
    completedCycleRef.current = null;
    setSequence(current => ({ text: children, revealed: 0, cycle: current.cycle + 1 }));
  };

  useImperativeHandle(forwardedRef, () => ({
    pause: () => requestPaused(true),
    resume: () => requestPaused(false),
    complete: revealAll,
    restart,
  }));

  useBrowserLayoutEffect(() => {
    if (sequence.text === children) return;
    completedCycleRef.current = null;
    setSequence(current => ({ text: children, revealed: 0, cycle: current.cycle + 1 }));
  }, [children, sequence.text]);

  useBrowserLayoutEffect(() => {
    if (!reducedMotion || complete) return;
    revealAll();
  }, [complete, reducedMotion, graphemes.length, children]);

  useEffect(() => {
    if (!complete || completedCycleRef.current === activeSequence.cycle) return;
    completedCycleRef.current = activeSequence.cycle;
    onCompleteRef.current?.();
  }, [activeSequence.cycle, complete]);

  useEffect(() => {
    if (complete || isPaused || reducedMotion) return undefined;
    const delay = revealed === 0
      ? safeDuration(startDelay)
      : typewriterDelayAfter(graphemes[revealed - 1], { speed, punctuationDelay });
    const timer = window.setTimeout(() => {
      setSequence(current => current.text === children
        ? { ...current, revealed: Math.min(graphemes.length, current.revealed + 1) }
        : { text: children, revealed: 1, cycle: current.cycle + 1 });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [children, complete, graphemes, isPaused, punctuationDelay, reducedMotion, revealed, speed, startDelay]);

  const classes = ['inkra-typewriter', className].filter(Boolean).join(' ');
  const state = complete ? 'complete' : isPaused ? 'paused' : 'typing';

  return <span
    {...props}
    className={classes}
    data-state={state}
    data-revealed={revealed}
    data-total={graphemes.length}
  >
    <span aria-hidden="true" className="inkra-typewriter__visual">
      {graphemes.map((grapheme, index) => <TypewriterGrapheme
        grapheme={grapheme}
        index={index}
        revealed={index < revealed}
        key={`${index}-${grapheme}`}
      />)}
    </span>
    <span className="inkra-typewriter__accessible">{children}</span>
  </span>;
});

export {
  isTypewriterPunctuation,
  splitTypewriterGraphemes,
  typewriterDelayAfter,
} from './model.js';
export type { TypewriterDelayOptions } from './model.js';
