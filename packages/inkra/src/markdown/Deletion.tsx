import { useRef, useState, type ComponentPropsWithoutRef } from 'react';
import { PencilLine } from '../PencilLine.js';
import { useBrowserLayoutEffect } from '../internal/useBrowserLayoutEffect.js';

interface StrikeLine { left: number; top: number; width: number }

export function Deletion({ children, className, ...props }: ComponentPropsWithoutRef<'del'>) {
  const ref = useRef<HTMLModElement>(null);
  const [lines, setLines] = useState<StrikeLine[]>([]);
  useBrowserLayoutEffect(() => {
    const node = ref.current;
    if (!node || !document.createElement('canvas').getContext('2d')) return;
    let disposed = false;
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (disposed) return;
      const box = node.getBoundingClientRect();
      const scaleX = node.offsetWidth ? box.width / node.offsetWidth : 1;
      const scaleY = node.offsetHeight ? box.height / node.offsetHeight : 1;
      const fragments: StrikeLine[] = [];
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      // Use native line fragments, not one line through the whole wrapped block.
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        if (!text.textContent?.trim() || text.parentElement?.closest('[aria-hidden="true"]')) continue;
        range.selectNodeContents(text);
        for (const rect of range.getClientRects()) {
          if (!rect.width || !rect.height) continue;
          const top = (rect.top - box.top + rect.height * 0.52) / (scaleY || 1) - 3;
          const left = (rect.left - box.left) / (scaleX || 1);
          const width = rect.width / (scaleX || 1);
          const line = fragments.find(item => Math.abs(item.top - top) < 3);
          if (line) {
            const end = Math.max(line.left + line.width, left + width);
            line.left = Math.min(line.left, left);
            line.width = end - line.left;
          } else fragments.push({ left, top, width });
        }
      }
      const next = fragments.map(line => ({
        left: Math.round(line.left * 2) / 2,
        top: Math.round(line.top * 2) / 2,
        width: Math.round(line.width * 2) / 2,
      }));
      setLines(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const schedule = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(measure);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(node);
    document.fonts?.addEventListener('loadingdone', schedule);
    document.fonts?.ready.then(schedule);
    measure();
    return () => {
      disposed = true;
      observer?.disconnect();
      document.fonts?.removeEventListener('loadingdone', schedule);
      cancelAnimationFrame(frame);
    };
  }, [children]);

  return <del {...props} className={['inkra-markdown__deleted', className].filter(Boolean).join(' ')} ref={ref} data-pencil-strike-ready={lines.length > 0 || undefined}>
    {children}
    {lines.map((line, index) => <PencilLine key={index} className="inkra-markdown__strike" seed={`markdown-strike-${index}`} weight={0.7} roughness={0.4} style={{ left: line.left, top: line.top, width: line.width }} />)}
  </del>;
}
