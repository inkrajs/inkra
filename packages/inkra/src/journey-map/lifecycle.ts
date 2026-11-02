import type { Map, MapOptions, PanOptions, PointExpression } from 'leaflet';

/** A queued public pan (for example drag inertia) must not revive a removed map. */
export function createJourneyLeafletMap(MapClass: typeof Map, container: HTMLElement, options: MapOptions): Map {
  let removed = false;
  class JourneyLeafletMap extends MapClass {
    override panBy(offset: PointExpression, panOptions?: PanOptions): this {
      if (removed || !this.getPane('mapPane')) return this;
      return super.panBy(offset, panOptions);
    }
    override remove(): this {
      removed = true;
      return super.remove();
    }
  }
  return new JourneyLeafletMap(container, options);
}
