/** A caller-owned point marker. Coordinates follow places: latitude, longitude. */
export interface JourneyMarker { id: string; label: string; latitude: number; longitude: number }
export interface JourneyMarkerRenderState { selected: boolean }
export type JourneyMarkerPresentation = 'pencil' | 'avatar-stack';
/** Opt-in alpha feather for avatar-stack portrait pixels, in CSS pixels. */
export interface JourneyMarkerAvatarFeather {
  /** Inward edge width, 0..12 CSS px; defaults to 4 when opted in. */
  width?: number;
  /** Alpha reduction at the circle edge, 0..1; defaults to 1. */
  strength?: number;
}
export type JourneyMarkerClustering = boolean | { /** CSS pixel distance; at least the 44px hit target. */ radius?: number };
export interface JourneyMarkerLabels { cluster?: (count: number) => string; more?: (count: number) => string; collapse?: string; list?: string }
/** Explicit undefined is valid for optional label props and must not erase defaults. */
export function resolveJourneyMarkerLabels(labels: JourneyMarkerLabels | undefined, defaults: Required<JourneyMarkerLabels>): Required<JourneyMarkerLabels> {
  return { cluster: labels?.cluster ?? defaults.cluster, more: labels?.more ?? defaults.more, collapse: labels?.collapse ?? defaults.collapse, list: labels?.list ?? defaults.list };
}
export interface JourneyMarkerCluster { id: string; markers: JourneyMarker[]; x: number; y: number }

export function normalizeAvatarFeather(feather?: JourneyMarkerAvatarFeather): { width: number; strength: number } | null {
  if (!feather) return null;
  const width = typeof feather.width === 'number' && Number.isFinite(feather.width) ? Math.max(0, Math.min(12, feather.width)) : 4;
  const strength = typeof feather.strength === 'number' && Number.isFinite(feather.strength) ? Math.max(0, Math.min(1, feather.strength)) : 1;
  return width > 0 && strength > 0 ? { width, strength } : null;
}

export function validJourneyMarkers(markers: readonly JourneyMarker[]): JourneyMarker[] {
  const ids = new Set<string>();
  return markers.filter(marker => {
    if (!marker || typeof marker.id !== 'string' || !marker.id.trim() || typeof marker.label !== 'string' || !marker.label.trim()) return false;
    if (ids.has(marker.id) || !Number.isFinite(marker.latitude) || !Number.isFinite(marker.longitude) || Math.abs(marker.latitude) > 85 || Math.abs(marker.longitude) > 180) return false;
    ids.add(marker.id);
    return true;
  });
}

/** Screen-space connected components. The grid bounds candidate comparisons. */
export function avatarStackLayout(total: number) {
  const visible = Math.min(3, Math.max(0, Math.floor(total)));
  return { visible, width: visible ? 44 + (visible - 1) * 20 : 0, height: 44, size: 40, step: 20, count: total > 3 ? String(total) : null };
}

function avatarClusters(markers: readonly JourneyMarker[], project: (marker: JourneyMarker) => { x: number; y: number }, clustering: JourneyMarkerClustering): JourneyMarkerCluster[] {
  const points = validJourneyMarkers(markers).map(marker => ({ marker, ...project(marker) })).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)).sort((a, b) => a.marker.id < b.marker.id ? -1 : a.marker.id > b.marker.id ? 1 : 0);
  const locations = new Map<string, typeof points>();
  for (const point of points) {
    // Geographic equality is explicit: distinct coordinates rounded to the same
    // screen pixel are not the same location when proximity merging is disabled.
    const key = JSON.stringify([point.marker.latitude, point.marker.longitude]);
    const group = locations.get(key) ?? []; group.push(point); locations.set(key, group);
  }
  let groups = [...locations.values()];
  const requested = typeof clustering === 'object' ? clustering.radius : 44;
  const radius = typeof requested === 'number' && Number.isFinite(requested) && requested > 0 ? Math.max(44, Math.min(256, requested)) : 44;
  const summarize = (group: typeof points): JourneyMarkerCluster => ({
    id: JSON.stringify(group.map(point => point.marker.id)), markers: group.map(point => point.marker),
    x: group.reduce((sum, point) => sum + point.x, 0) / group.length,
    y: group.reduce((sum, point) => sum + point.y, 0) / group.length,
  });
  if (clustering) while (groups.length > 1) {
    const summaries = groups.map(summarize);
    const parents = groups.map((_, index) => index);
    const find = (index: number): number => { while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; } return index; };
    const cells = new Map<string, number[]>(), cellSize = Math.max(84, radius);
    summaries.forEach((point, index) => {
      const col = Math.floor(point.x / cellSize), row = Math.floor(point.y / cellSize);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const other of cells.get(`${col + dx}:${row + dy}`) ?? []) {
        const previous = summaries[other];
        const overlaps = Math.abs(point.x - previous.x) <= (avatarStackLayout(point.markers.length).width + avatarStackLayout(previous.markers.length).width) / 2 && Math.abs(point.y - previous.y) <= 44;
        if (overlaps || Math.hypot(point.x - previous.x, point.y - previous.y) <= radius) parents[find(index)] = find(other);
      }
      const key = `${col}:${row}`, cell = cells.get(key) ?? []; cell.push(index); cells.set(key, cell);
    });
    const combined = new Map<number, typeof points>();
    groups.forEach((group, index) => { const key = find(index), joined = combined.get(key) ?? []; for (const point of group) joined.push(point); combined.set(key, joined); });
    if (combined.size === groups.length) break;
    groups = [...combined.values()].map(group => group.sort((a, b) => a.marker.id < b.marker.id ? -1 : a.marker.id > b.marker.id ? 1 : 0));
  }
  return groups.map(summarize).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function clusterJourneyMarkers(markers: readonly JourneyMarker[], project: (marker: JourneyMarker) => { x: number; y: number }, clustering: JourneyMarkerClustering = false, presentation: JourneyMarkerPresentation = 'pencil'): JourneyMarkerCluster[] {
  if (presentation === 'avatar-stack') return avatarClusters(markers, project, clustering);
  const points = validJourneyMarkers(markers).map(marker => ({ marker, ...project(marker) })).filter(point => Number.isFinite(point.x) && Number.isFinite(point.y)).sort((a, b) => a.marker.id < b.marker.id ? -1 : a.marker.id > b.marker.id ? 1 : 0);
  const requested = typeof clustering === 'object' ? clustering.radius : 44;
  const radius = typeof requested === 'number' && Number.isFinite(requested) && requested > 0 ? Math.max(44, Math.min(256, requested)) : 44;
  const parents = points.map((_, index) => index);
  const find = (index: number): number => { while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; } return index; };
  if (clustering) {
    const cells = new Map<string, number[]>();
    points.forEach((point, index) => {
      const col = Math.floor(point.x / radius), row = Math.floor(point.y / radius);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const other of cells.get(`${col + dx}:${row + dy}`) ?? []) {
          if (Math.hypot(point.x - points[other].x, point.y - points[other].y) <= radius) parents[find(index)] = find(other);
        }
      }
      const key = `${col}:${row}`;
      const cell = cells.get(key) ?? [];
      cell.push(index); cells.set(key, cell);
    });
  }
  const groups = new Map<number, typeof points>();
  points.forEach((point, index) => { const key = find(index); const group = groups.get(key) ?? []; group.push(point); groups.set(key, group); });
  return [...groups.values()].map(group => ({ id: JSON.stringify(group.map(point => point.marker.id)), markers: group.map(point => point.marker), x: group.reduce((sum, point) => sum + point.x, 0) / group.length, y: group.reduce((sum, point) => sum + point.y, 0) / group.length }));
}
