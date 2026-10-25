import { forwardRef, useSyncExternalStore } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';

export type InkraTheme = 'light' | 'dark' | 'auto';
export type InkraThemeTokens = Partial<Record<`--inkra-${string}`, string | number>>;

export interface ThemeProviderProps extends HTMLAttributes<HTMLDivElement> {
  /** Omit to inherit the surrounding theme. auto follows the system through CSS. */
  theme?: InkraTheme;
  /** Scoped CSS variables. Lengths must include units, for example "1.5px". */
  tokens?: InkraThemeTokens;
}

const forcedColorsQuery = '(forced-colors: active)';
function forcedColorsSnapshot() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia(forcedColorsQuery).matches;
}
function subscribeForcedColors(update: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(forcedColorsQuery);
  query.addEventListener('change', update);
  return () => query.removeEventListener('change', update);
}
const serverSnapshot = () => false;

/** A CSS scope: never modifies document attributes, storage or sibling themes. */
export const ThemeProvider = forwardRef<HTMLDivElement, ThemeProviderProps>(function ThemeProvider({
  theme, tokens, style, className, children, ...props
}, ref) {
  const forcedColors = useSyncExternalStore(subscribeForcedColors, forcedColorsSnapshot, serverSnapshot);
  const variables = Object.fromEntries(Object.entries(tokens ?? {}).filter(([key, value]) =>
    key.startsWith('--inkra-') && (typeof value === 'string' || typeof value === 'number' && Number.isFinite(value)),
  ));
  // Let the existing system-color tokens win over user pigments in high contrast.
  const scopedStyle = Object.fromEntries(Object.entries({ ...variables, ...style }).filter(([key]) =>
    !forcedColors || !key.startsWith('--inkra-'),
  ));
  return <div {...props} ref={ref} className={['inkra-theme-provider', className].filter(Boolean).join(' ')}
    data-theme={theme} data-inkra-theme={theme}
    style={{ color: 'var(--inkra-ink)', fontFamily: 'var(--inkra-font-body)', ...scopedStyle } as CSSProperties}>
    {children}
  </div>;
});
