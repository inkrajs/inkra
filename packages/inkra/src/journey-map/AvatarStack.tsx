import { useEffect, useRef, type ReactNode } from 'react';
import { normalizeAvatarFeather, type JourneyMarker, type JourneyMarkerAvatarFeather } from './markers.js';

/** A graphic fallback, not a name, count, circle fill or backing plate. */
export function AvatarPlaceholder() {
  return <span className="inkra-journey-map__avatar-placeholder" data-avatar-fallback="true"><span /><span /></span>;
}

function AvatarCount({ total }: { total: number }) {
  const text = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = text.current;
    if (!node) return;
    let active = true;
    const fit = () => {
      if (!active || !node.parentElement) return;
      const available = node.parentElement.clientWidth - 4;
      node.style.transform = `scaleX(${node.scrollWidth > 0 ? Math.min(1, available / node.scrollWidth) : 1})`;
    };
    fit();
    const observer = new ResizeObserver(fit); observer.observe(node); observer.observe(node.parentElement!);
    void document.fonts?.ready.then(fit);
    return () => { active = false; observer.disconnect(); };
  }, [total]);
  return <span className="inkra-journey-map__avatar-count" data-avatar-count={String(total)}><span ref={text}>{String(total)}</span></span>;
}

export function AvatarSlot({ marker, index = 0, selected, groupSelected = false, total, inList = false, inButton = false, feather, children }: {
  marker: JourneyMarker; index?: number; selected: boolean; groupSelected?: boolean; total?: number; inList?: boolean; inButton?: boolean; feather?: JourneyMarkerAvatarFeather; children: ReactNode;
}) {
  const edge = normalizeAvatarFeather(feather);
  // Mask only source pixels. The total, focus/selection rings and hit target are
  // siblings, so their opacity and geometry remain independent of the feather.
  const mask = edge ? `radial-gradient(circle closest-side, #000 calc(100% - ${edge.width}px), rgba(0, 0, 0, ${1 - edge.strength}) 100%)` : undefined;
  return <span className="inkra-journey-map__avatar-slot" data-avatar-slot={index} data-avatar-id={marker.id} data-selected={selected} data-group-selected={groupSelected} style={{ left: inList ? 6 : inButton ? 2 : 2 + index * 20, zIndex: index + 1 }} aria-hidden="true">
    <span ref={node => { node?.setAttribute('inert', ''); }} className="inkra-journey-map__avatar-image" style={mask ? { maskImage: mask, WebkitMaskImage: mask, maskMode: 'alpha' } : undefined}>{children}</span>
    {total !== undefined && total > 3 && <AvatarCount total={total} />}
  </span>;
}
