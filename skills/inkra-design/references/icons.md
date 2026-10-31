# Pencil icons

Use familiar, simple geometry and the actual `PencilIcon` renderer. Reuse an existing coherent icon family's paths where available and permitted by its license; retain attribution when redistributing that geometry. Custom geometry should add a recognizable symbol the product needs.

## Geometry and variants

- Choose a consistent source coordinate system, commonly 24×24, and set `sourceSize={24}` explicitly. In version 0.12.0, `size` is the CSS canvas box, not the visible glyph extent: paths are drawn in a 40-unit frame with scale `size / 40` and centering offset `(40 - sourceSize) / 2`. Thus a source point maps to `(point + offset) * size / 40`; `sourceSize` does not scale 24-unit paths to fill the canvas. Leave room for pencil overshoot.
- Keep one recognizable silhouette and one useful distinguishing feature. Inspect the actual painted bounds: a 24-unit design in a 32px canvas occupies at most 19.2px before its internal margins. Choose the canvas box for the desired visible glyph; for a closer fit, author or normalize the path coordinates in a 40-unit frame and set `sourceSize={40}`. Do not invent a transform prop. Typical visible button glyphs are 14/16/20/24px; a gallery may need a larger canvas. The 44px control target remains a separate size.
- Supply both `outline` and `filled` appearances for a new icon. Their box, meaning and proportions should match. Filled geometry may need authored `filledPaths`; changing only CSS `fill` is insufficient.
- In `PencilIconPath`, `mode: 'stroke'` retains a line, `'fill'` forms a dense silhouette, `'wash'` adds paper-revealing pigment and `'cutout'` removes ink to expose the real background. Omitted mode lets the renderer infer closed shapes. Use explicit modes when the intent is ambiguous.
- Open arrows, plus signs and ticks stay open strokes in both variants. Do not let implicit closure create triangles or polygons. Overlapping solids should read as one body; only genuinely enclosed negative regions become holes.
- A hole is transparent, never a white patch. Test it on dark and colored backgrounds. A folded page or occluded surface may require separate filled geometry rather than filling the outline path.
- Contour `color` and body `fillColor` are independent. Both can use semantic CSS variables; `fillColor` defaults to currentColor. For icons that need color, use a few meaningful `wash` regions with overridable colors, not random colors per SVG path. Common choices are `--inkra-blue`, `--inkra-warning-pigment` and `--inkra-coral`.
- Use a stable semantic seed. Let callers choose outline/filled, color and size without changing the icon's accessible name. Never use a random seed to simulate drawing anew.

## Complete custom icon example

This original location marker demonstrates authored fill geometry, a true cutout and a separate action target. It needs no documentation-site helper or additional icon package. With 24 source units and a 32px canvas, the marker body is approximately 13×17px before pencil overshoot. The enclosing icon button retains a 44px target; the canvas and visible glyph intentionally have different bounds.

```tsx
import { useState } from 'react';
import { Button, PencilIcon, type PencilIconPath } from '@inkra/react';
import '@inkra/react/styles.css';

const outline: readonly PencilIconPath[] = [
  { d: 'M12 22C10 19 4 13 4 9A8 8 0 0 1 20 9C20 13 14 19 12 22Z' },
  { d: 'M15 9A3 3 0 1 1 9 9A3 3 0 1 1 15 9Z' },
];
const filled: readonly PencilIconPath[] = [
  { d: outline[0].d, mode: 'fill' },
  { d: outline[1].d, mode: 'cutout' },
];

export function PlaceToggle() {
  const [marked, setMarked] = useState(false);
  return (
    <Button
      size="icon"
      variant="outline"
      aria-label="Mark this place"
      aria-pressed={marked}
      title="Mark this place"
      onClick={() => setMarked(value => !value)}
    >
      <PencilIcon
        paths={outline}
        filledPaths={filled}
        variant={marked ? 'filled' : 'outline'}
        sourceSize={24}
        size={32}
        seed="place-marker"
        fillColor="var(--inkra-blue)"
        decorative
      />
    </Button>
  );
}
```

The button owns the name and pressed state; its icon is decorative. Keep the name stable while toggling and localize it in the consumer. `title` is a basic hover hint; use the consumer's accessible Tooltip composition when a keyboard-visible explanation is needed. A standalone meaningful `PencilIcon` can instead use `decorative={false}` and `aria-label`; do not nest a second interactive target inside a button.

## Review the icon

Review only the variants and states relevant to the change, including:

- Side-by-side outline and filled at the actual small glyph size, plus a 32px inspection view when useful. A 44px button must remain clickable without overlapping its neighbors.
- Open contours, transparent holes, overlapping bodies and edge padding on both light and dark paper. The marker hole above should reveal each background.
- Default and custom pigment colors: the contour remains distinct and the symbol remains recognizable without color alone.
- Keyboard focus, accessible name, pressed/disabled state and pointer hit region on the enclosing control.
- Repeated rendering, scrolling and hover preserve the same shape and texture; switching variant does not resize the box.

