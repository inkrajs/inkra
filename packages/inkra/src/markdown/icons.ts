import { __iconData as copy } from 'lucide-react/dist/esm/icons/copy.mjs';
import { __iconData as check } from 'lucide-react/dist/esm/icons/check.mjs';
import { __iconData as terminal } from 'lucide-react/dist/esm/icons/terminal.mjs';
import { __iconData as code } from 'lucide-react/dist/esm/icons/code-xml.mjs';

function paths(data: typeof copy) {
  return data.node.flatMap(([tag, attributes]) => {
    if (tag === 'path') return [{ d: attributes.d }];
    if (tag !== 'rect') return [];
    const { x = 0, y = 0, width = 0, height = 0, rx = 0 } = Object.fromEntries(
      Object.entries(attributes).map(([key, value]) => [key, Number(value)]),
    );
    const r = Math.min(rx, width / 2, height / 2);
    return [{ d: `M${x + r} ${y}H${x + width - r}Q${x + width} ${y} ${x + width} ${y + r}V${y + height - r}Q${x + width} ${y + height} ${x + width - r} ${y + height}H${x + r}Q${x} ${y + height} ${x} ${y + height - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z` }];
  });
}

export const codeIcons = { copy: paths(copy), check: paths(check), terminal: paths(terminal), code: paths(code) };
