export interface DockablePanelPosition {
  x: number;
  y: number;
}

export interface DockablePanelSize {
  width: number;
  height: number;
}

export interface DockablePanelBounds extends DockablePanelSize {
  padding: number;
  titleBarHeight: number;
  titleBarVisibility: number;
}

export type DockablePanelSnapEdge = 'top' | 'right' | 'bottom' | 'left';

export interface DockablePanelPlacement {
  position: DockablePanelPosition;
  snappedEdges: DockablePanelSnapEdge[];
}

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function range(minimum: number, maximum: number, value: number) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function clampDockablePanelPosition(
  position: DockablePanelPosition,
  panel: DockablePanelSize,
  bounds: DockablePanelBounds,
): DockablePanelPosition {
  const padding = Math.max(0, finite(bounds.padding));
  const viewportWidth = Math.max(0, finite(bounds.width));
  const viewportHeight = Math.max(0, finite(bounds.height));
  const panelWidth = Math.max(0, finite(panel.width));
  const panelHeight = Math.max(0, finite(panel.height));
  const titleBarHeight = Math.max(1, finite(bounds.titleBarHeight, 44));
  const titleBarVisibility = Math.max(1, finite(bounds.titleBarVisibility, 56));
  const availableWidth = Math.max(0, viewportWidth - padding * 2);
  const availableHeight = Math.max(0, viewportHeight - padding * 2);
  const visibleTitleWidth = Math.min(panelWidth, titleBarVisibility);

  const minimumX = panelWidth <= availableWidth
    ? padding
    : padding + visibleTitleWidth - panelWidth;
  const maximumX = panelWidth <= availableWidth
    ? viewportWidth - padding - panelWidth
    : Math.max(minimumX, viewportWidth - padding - visibleTitleWidth);
  const minimumY = padding;
  const maximumY = panelHeight <= availableHeight
    ? viewportHeight - padding - panelHeight
    : Math.max(minimumY, viewportHeight - padding - Math.min(panelHeight, titleBarHeight));

  return {
    x: range(minimumX, maximumX, finite(position.x)),
    y: range(minimumY, maximumY, finite(position.y)),
  };
}

export function placeDockablePanel(
  position: DockablePanelPosition,
  panel: DockablePanelSize,
  bounds: DockablePanelBounds,
  snapThreshold = 12,
): DockablePanelPlacement {
  const clamped = clampDockablePanelPosition(position, panel, bounds);
  const padding = Math.max(0, finite(bounds.padding));
  const threshold = Math.max(0, finite(snapThreshold));
  const maximumX = Math.max(padding, bounds.width - padding - panel.width);
  const maximumY = Math.max(padding, bounds.height - padding - panel.height);
  const snappedEdges: DockablePanelSnapEdge[] = [];
  let { x, y } = clamped;

  if (Math.abs(x - padding) <= threshold) {
    x = padding;
    snappedEdges.push('left');
  } else if (panel.width <= bounds.width - padding * 2 && Math.abs(x - maximumX) <= threshold) {
    x = maximumX;
    snappedEdges.push('right');
  }
  if (Math.abs(y - padding) <= threshold) {
    y = padding;
    snappedEdges.push('top');
  } else if (panel.height <= bounds.height - padding * 2 && Math.abs(y - maximumY) <= threshold) {
    y = maximumY;
    snappedEdges.push('bottom');
  }

  return { position: { x, y }, snappedEdges };
}

export function promoteDockablePanel(order: readonly string[], id: string): string[] {
  return [...order.filter(value => value !== id), id];
}
