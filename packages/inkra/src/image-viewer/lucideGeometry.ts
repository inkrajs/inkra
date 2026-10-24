import type { PencilIconPath } from '../PencilIcon.js';

export type LucideIconNode = readonly [string, Record<string, string>];

function number(attributes: Record<string, string>, name: string): number {
  const value = Number(attributes[name]);
  return Number.isFinite(value) ? value : 0;
}

export function lucideNodesToPencilPaths(nodes: readonly LucideIconNode[]): readonly PencilIconPath[] {
  return nodes.flatMap(([tag, attributes]) => {
    if (tag === 'path' && attributes.d) return [{ d: attributes.d }];
    if (tag === 'line') return [{ d: `M${number(attributes, 'x1')} ${number(attributes, 'y1')}L${number(attributes, 'x2')} ${number(attributes, 'y2')}` }];
    if (tag === 'circle') {
      const cx = number(attributes, 'cx');
      const cy = number(attributes, 'cy');
      const radius = number(attributes, 'r');
      return [{ d: `M${cx - radius} ${cy}A${radius} ${radius} 0 1 0 ${cx + radius} ${cy}A${radius} ${radius} 0 1 0 ${cx - radius} ${cy}` }];
    }
    return [];
  });
}
