import { useRef, type RefObject } from 'react';
import { useBrowserLayoutEffect } from './useBrowserLayoutEffect.js';
import { PENCIL_SELECTION_WASH } from './surfaceRenderer.js';
import { readRenderToken } from './renderTokens.js';

// Reveal the cached pigment in alternating diagonal strokes, without repainting it.
function drawingFrames(width: number, height: number, degrees: number): Keyframe[] {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const u = (Math.abs(cos) * width + Math.abs(sin) * height) / 2 + 2;
  const v = (Math.abs(sin) * width + Math.abs(cos) * height) / 2 + 2;
  const point = (x: number, y: number) => `${width / 2 + cos * x - sin * y}px ${height / 2 + sin * x + cos * y}px`;
  const frames: Keyframe[] = [];
  const strokes = 8;
  for (let index = 0; index < strokes; index++) {
    const top = -v + index * 2 * v / strokes;
    const bottom = -v + (index + 1) * 2 * v / strokes;
    // Limit travel to the visible section of this stripe, not its rotated bounds.
    const middle = (top + bottom) / 2;
    let left = -u;
    let right = u;
    for (const [direction, offset, halfExtent] of [[cos, -sin * middle, width / 2], [sin, cos * middle, height / 2]]) {
      if (Math.abs(direction) < 1e-8) continue;
      const a = (-halfExtent - offset) / direction;
      const b = (halfExtent - offset) / direction;
      left = Math.max(left, Math.min(a, b));
      right = Math.min(right, Math.max(a, b));
    }
    for (const progress of [0, 0.5, 1]) {
      const x = progress === 0 ? (index % 2 ? u : -u) : progress === 1 ? (index % 2 ? -u : u) : (left + right) / 2;
      const outline = index % 2
        ? [[-u, -v], [u, -v], [u, bottom], [x, bottom], [x, top], [-u, top]]
        : [[-u, -v], [u, -v], [u, top], [x, top], [x, bottom], [-u, bottom]];
      frames.push({ clipPath: `polygon(${outline.map(([a, b]) => point(a, b)).join(',')})`, offset: (index + progress * 0.85) / strokes, easing: progress === 1 ? 'steps(1, end)' : 'linear' });
    }
  }
  frames.push({ ...frames[frames.length - 1], offset: 1 });
  return frames;
}

export function useSelectionDrawing(ref: RefObject<HTMLElement | null>, selected: boolean, animated = true): void {
  const previous = useRef(selected);
  const progress = useRef(selected ? 1 : 0);
  useBrowserLayoutEffect(() => {
    const changed = selected !== previous.current;
    previous.current = selected;
    const node = ref.current;
    const target = selected ? 1 : 0;
    if (!animated || !changed || !node || typeof node.animate !== 'function') {
      progress.current = target;
      return;
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const forced = matchMedia('(forced-colors: active)');
    if (reduced.matches || forced.matches || node.clientWidth < 6 || node.clientHeight < 6) {
      progress.current = target;
      return;
    }
    const duration = selected ? 480 : 320;
    const angle = readRenderToken(getComputedStyle(node), '--inkra-wash-angle', PENCIL_SELECTION_WASH.angle, -85, 85);
    const animation = node.animate(
      drawingFrames(node.clientWidth, node.clientHeight, angle).map(frame => ({ ...frame, opacity: 1 })),
      { duration, direction: selected ? 'normal' : 'reverse', easing: 'linear' },
    );
    animation.currentTime = (selected ? progress.current : 1 - progress.current) * duration;
    let settled = false;
    const finish = () => {
      settled = true;
      progress.current = target;
      animation.cancel();
    };
    animation.onfinish = finish;
    const width = node.clientWidth;
    const height = node.clientHeight;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (node.clientWidth !== width || node.clientHeight !== height) finish();
    });
    observer?.observe(node);
    reduced.addEventListener('change', finish);
    forced.addEventListener('change', finish);
    return () => {
      // Reverse from the visible stroke when users change their mind mid-draw.
      if (!settled) progress.current = animation.effect?.getComputedTiming().progress ?? target;
      animation.onfinish = null;
      animation.cancel();
      observer?.disconnect();
      reduced.removeEventListener('change', finish);
      forced.removeEventListener('change', finish);
    };
  }, [ref, selected, animated]);
}
