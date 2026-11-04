/** Whole-feature bounds with no renderer or camera dependencies.
 * Bounds are conservative rejection hints, never replacement geometry. Inputs
 * (including nested coordinates) must remain immutable for their lifetime. */
export interface JourneyFeatureBounds {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
}

export interface JourneyFeatureViewportPose {
  readonly zoom: number;
  /** Saved world-to-raster CSS translation, matching JourneyPaintPose. */
  readonly offset: readonly [x: number, y: number];
}

export interface JourneyFeatureViewportRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The supported port must return unwrapped longitude, like Leaflet's public
 * EPSG:3857 unproject. A caller with a wrapped/custom CRS must pass false below. */
export interface JourneyFeatureUnprojectPort {
  unproject(point: [x: number, y: number], zoom: number): { lat: number; lng: number };
}

type MutableBounds = { -readonly [Key in keyof JourneyFeatureBounds]: JourneyFeatureBounds[Key] };
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Root metadata gate only: non-null legacy CRS declarations are not interpreted.
 * A collection's gate must be applied before querying its child features; child
 * and geometry CRS checks still apply separately. This does not prove validity
 * or replace the caller's explicit supported/unwrapped projection contract. */
export function journeyFeatureRootAllowsBounds(data: unknown): boolean {
  try {
    if (!object(data) || data.crs != null) return false;
    return data.type === 'FeatureCollection' || data.type === 'Feature'
      || data.type === 'Polygon' || data.type === 'MultiPolygon'
      || data.type === 'LineString' || data.type === 'MultiLineString';
  } catch { return false; }
}

function knownBounds(value: JourneyFeatureBounds | undefined): value is JourneyFeatureBounds {
  if (!value) return false;
  try {
    return finite(value.west) && finite(value.south) && finite(value.east) && finite(value.north)
      && value.west >= -180 && value.east <= 180 && value.south >= -85 && value.north <= 85
      && value.west <= value.east && value.south <= value.north && value.east - value.west <= 180;
  } catch { return false; }
}

function scanBounds(value: unknown, route: boolean): JourneyFeatureBounds | undefined {
  const bounds: MutableBounds = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  const sequence = (values: unknown, minimum: number, closed = false): boolean => {
    if (!Array.isArray(values) || values.length < minimum) return false;
    let firstLongitude = 0, firstLatitude = 0, previousLongitude = 0, lastLatitude = 0;
    for (let index = 0; index < values.length; index++) {
      const position: unknown = values[index];
      if (!Array.isArray(position) || position.length < 2) return false;
      // Extra position dimensions cannot make malformed data safe to reject.
      for (let dimension = 0; dimension < position.length; dimension++) if (!finite(position[dimension])) return false;
      const longitude = position[route ? 1 : 0] as number;
      const latitude = position[route ? 0 : 1] as number;
      if (longitude < -180 || longitude > 180 || latitude < -85 || latitude > 85) return false;
      if (index && Math.abs(longitude - previousLongitude) > 180) return false;
      if (!index) { firstLongitude = longitude; firstLatitude = latitude; }
      previousLongitude = longitude; lastLatitude = latitude;
      bounds.west = Math.min(bounds.west, longitude); bounds.east = Math.max(bounds.east, longitude);
      bounds.south = Math.min(bounds.south, latitude); bounds.north = Math.max(bounds.north, latitude);
    }
    return !closed || (firstLongitude === previousLongitude && firstLatitude === lastLatitude);
  };
  const polygon = (values: unknown): boolean => {
    if (!Array.isArray(values) || values.length === 0) return false;
    // Include every hole as supplied; a hole may widen but never shrink bounds.
    for (let index = 0; index < values.length; index++) if (!sequence(values[index], 4, true)) return false;
    return true;
  };
  try {
    let valid = false;
    if (route) {
      // One route point is still meaningful to the existing fit contract.
      valid = sequence(value, 1);
    } else if (object(value) && value.crs == null) {
      const coordinates = value.coordinates;
      switch (value.type) {
        case 'LineString': valid = sequence(coordinates, 2); break;
        case 'Polygon': valid = polygon(coordinates); break;
        case 'MultiLineString':
        case 'MultiPolygon': {
          valid = Array.isArray(coordinates) && coordinates.length > 0;
          if (valid) for (let index = 0; index < (coordinates as unknown[]).length; index++) {
            const part = (coordinates as unknown[])[index];
            if (!(value.type === 'MultiPolygon' ? polygon(part) : sequence(part, 2))) { valid = false; break; }
          }
          break;
        }
      }
    }
    return valid && knownBounds(bounds) ? Object.freeze(bounds) : undefined;
  } catch {
    // Unknown geometry (including throwing accessors) must remain eligible.
    return undefined;
  }
}

/** Per-owner weak caches, with separate lon/lat and lat/lon key spaces.
 * Unknown results are cached too; no externally supplied bbox is read/trusted.
 * A new feature wrapper can reuse its unchanged geometry's cached result.
 * An unsupported CRS on any enclosing collection must bypass rejection at the
 * eventual call site; this helper cannot discover unseen parent metadata. */
export function createJourneyFeatureBoundsCache() {
  const geometries = new WeakMap<object, JourneyFeatureBounds | undefined>();
  const routes = new WeakMap<object, JourneyFeatureBounds | undefined>();
  const geometry = (value: unknown): JourneyFeatureBounds | undefined => {
    try {
      if (!object(value)) return;
      if (geometries.has(value)) return geometries.get(value);
      const result = scanBounds(value, false); geometries.set(value, result); return result;
    } catch { return undefined; }
  };
  return {
    geometry,
    feature(value: unknown): JourneyFeatureBounds | undefined {
      try {
        if (!object(value) || value.type !== 'Feature' || value.crs != null) return;
        return geometry(value.geometry);
      } catch { return undefined; }
    },
    route(coordinates: unknown): JourneyFeatureBounds | undefined {
      try {
        if (!Array.isArray(coordinates)) return;
        if (routes.has(coordinates)) return routes.get(coordinates);
        const result = scanBounds(coordinates, true); routes.set(coordinates, result); return result;
      } catch { return undefined; }
    },
  };
}

/** An absent/invalid hint means keep. Touching edges are always retained. */
export function journeyFeatureBoundsIntersect(bounds: JourneyFeatureBounds | undefined, viewport: JourneyFeatureBounds | undefined): boolean {
  if (!knownBounds(bounds) || !knownBounds(viewport)) return true;
  try {
    return !(bounds.east < viewport.west || bounds.west > viewport.east
      || bounds.north < viewport.south || bounds.south > viewport.north);
  } catch { return true; }
}

/** Convert a saved raster CSS rectangle to an unwrapped geographic hint.
 * Supported means known north-up, monotonic, unwrapped projection semantics;
 * it is not inferred from a CRS name or from the returned corner values.
 * All four corners are sampled and margin + 1 CSS px covers paint-pose rounding.
 * Invalid, dateline/world-copy or wide views return undefined (= keep all).
 * This does not read/change the live camera and never projects source vertices. */
export function journeyFeatureViewportBounds(
  map: JourneyFeatureUnprojectPort,
  pose: JourneyFeatureViewportPose | undefined,
  rect: JourneyFeatureViewportRect,
  margin: number,
  supportedProjection: boolean,
): JourneyFeatureBounds | undefined {
  try {
    if (supportedProjection !== true || !pose || !finite(pose.zoom)
      || !Array.isArray(pose.offset) || pose.offset.length !== 2 || !pose.offset.every(finite)
      || !rect || ![rect.x, rect.y, rect.width, rect.height, margin].every(finite)
      || rect.width <= 0 || rect.height <= 0 || margin < 0) return;
    const expansion = margin + 1;
    const left = rect.x - expansion - pose.offset[0], right = rect.x + rect.width + expansion - pose.offset[0];
    const top = rect.y - expansion - pose.offset[1], bottom = rect.y + rect.height + expansion - pose.offset[1];
    if (![left, right, top, bottom].every(finite) || !(left < right && top < bottom)) return;
    const corners = [[left, top], [right, top], [right, bottom], [left, bottom]] as [number, number][];
    const positions = corners.map(point => map.unproject(point, pose.zoom));
    if (positions.some(point => !point || !finite(point.lng) || !finite(point.lat)
      || point.lng < -180 || point.lng > 180 || point.lat < -85 || point.lat > 85)) return;
    const [northWest, northEast, southEast, southWest] = positions;
    if (!(northWest.lng < northEast.lng && southWest.lng < southEast.lng
      && northWest.lat > southWest.lat && northEast.lat > southEast.lat)) return;
    const result = {
      west: Math.min(...positions.map(point => point.lng)), east: Math.max(...positions.map(point => point.lng)),
      south: Math.min(...positions.map(point => point.lat)), north: Math.max(...positions.map(point => point.lat)),
    };
    return knownBounds(result) ? Object.freeze(result) : undefined;
  } catch { return undefined; }
}
