import { useEffect, useRef, useState } from 'react';
import type { Map } from 'leaflet';
import { PencilText } from '../PencilText.js';
import { PencilIcon } from '../PencilIcon.js';
import { pencilStroke } from '../internal/stroke.js';

// AdventureMapScale's pencil bar and north marker, with Leaflet distance projection.
export function MapScale({ map }: { map: Map | null }) {
  const bar = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState('');
  useEffect(() => {
    if (!map || !bar.current) return;
    const draw = () => {
      const canvas = bar.current;
      if (!canvas) return;
      const size = map.getSize();
      if (!size.x || !size.y) return;
      const maxWidth = Math.min(112, Math.max(58, size.x * .22));
      const y = size.y - 24, x = size.x - 64 - maxWidth;
      const meters = map.distance(map.containerPointToLatLng([x, y]), map.containerPointToLatLng([x + maxWidth, y]));
      if (!Number.isFinite(meters) || meters <= 0) return;
      const magnitude = 10 ** Math.floor(Math.log10(meters));
      const distance = [5, 2, 1].map(value => value * magnitude).find(value => value <= meters) ?? magnitude;
      const width = maxWidth * distance / meters;
      setLabel(distance >= 1000 ? `${distance / 1000} km` : `${Number(distance.toPrecision(3))} m`);
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.ceil((width + 4) * dpr); canvas.height = 12 * dpr;
      canvas.style.width = `${width + 4}px`;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(dpr, dpr);
      const ink = getComputedStyle(canvas).color;
      const options = { variation: .52, breaks: .18, grain: .45, gain: 2.2, step: .4, taperLength: .5 };
      pencilStroke(context, [[2, 8], [width + 2, 8]], ink, 1.15, 4411, .16, 3, false, options);
      pencilStroke(context, [[2, 3], [2, 10]], ink, 1.05, 4423, .14, 2, false, options);
      pencilStroke(context, [[width + 2, 3], [width + 2, 10]], ink, 1.05, 4439, .14, 2, false, options);
    };
    draw();
    map.on('moveend zoomend resize', draw);
    const observer = new MutationObserver(draw);
    for (let element: HTMLElement | null = bar.current; element; element = element.parentElement) {
      observer.observe(element, { attributes: true, attributeFilter: ['data-theme', 'data-inkra-theme'] });
    }
    const scheme = matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', draw);
    return () => { map.off('moveend zoomend resize', draw); observer.disconnect(); scheme.removeEventListener('change', draw); };
  }, [map]);
  return <div className="inkra-journey-map__orientation" aria-hidden="true">
    <div className="inkra-journey-map__scale"><PencilText>{label}</PencilText><canvas ref={bar} /></div>
    <div className="inkra-journey-map__compass"><PencilText>N</PencilText><PencilIcon sourceSize={32} size={30} paths={[{ d: 'M16 4 9.5 24 16 20.5 22.5 24 16 4Z' }, { d: 'M16 7v13.5' }]} /></div>
  </div>;
}
