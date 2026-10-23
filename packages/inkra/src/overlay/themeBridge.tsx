import {
  Children,
  Fragment,
  createContext,
  forwardRef,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  CSSProperties,
  ForwardedRef,
  HTMLAttributes,
  ReactNode,
  Ref,
} from 'react';

type InkraStyle = CSSProperties & Record<`--inkra-${string}`, string>;

interface PortalThemeSnapshot {
  theme?: string;
  inkraTheme?: string;
  direction: 'ltr' | 'rtl';
  language?: string;
  style: InkraStyle;
}

interface PortalThemeContextValue {
  captureTrigger: (node: HTMLElement | null) => void;
  depth: number;
  snapshot: PortalThemeSnapshot;
}

const emptySnapshot: PortalThemeSnapshot = {
  direction: 'ltr',
  style: {},
};

const PortalThemeContext = createContext<PortalThemeContextValue | null>(null);
const PortalLayerDepthContext = createContext(-1);

function assignRef<Value>(ref: Ref<Value> | undefined, value: Value | null): void {
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  if (ref) ref.current = value;
}

function closestAttribute(node: HTMLElement, attribute: string): string | undefined {
  return node.closest<HTMLElement>(`[${attribute}]`)?.getAttribute(attribute) ?? undefined;
}

function isForcedColorsActive(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(forced-colors: active)').matches;
}

function readThemeSnapshot(
  node: HTMLElement | null,
  forcedColors = isForcedColorsActive(),
): PortalThemeSnapshot {
  if (!node || typeof window === 'undefined') return emptySnapshot;
  const computed = window.getComputedStyle(node);
  const style = {} as InkraStyle;

  if (!forcedColors) {
    for (let index = 0; index < computed.length; index += 1) {
      const property = computed.item(index);
      if (property.startsWith('--inkra-')) {
        style[property as `--inkra-${string}`] = computed.getPropertyValue(property).trim();
      }
    }
  }

  style.colorScheme = computed.colorScheme;
  style.fontFamily = computed.fontFamily;

  return {
    theme: closestAttribute(node, 'data-theme'),
    inkraTheme: closestAttribute(node, 'data-inkra-theme'),
    direction: computed.direction === 'rtl' ? 'rtl' : 'ltr',
    language: node.closest<HTMLElement>('[lang]')?.lang || undefined,
    style,
  };
}

export function PortalThemeProvider({ children }: { children: ReactNode }) {
  const parentDepth = useContext(PortalLayerDepthContext);
  const depth = parentDepth + 1;
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const [snapshot, setSnapshot] = useState<PortalThemeSnapshot>(emptySnapshot);
  const captureTrigger = useCallback((node: HTMLElement | null) => {
    setTrigger(node);
    setSnapshot(readThemeSnapshot(node));
  }, []);

  useEffect(() => {
    if (!trigger || typeof MutationObserver === 'undefined') return undefined;
    const refresh = () => setSnapshot(readThemeSnapshot(trigger));
    const observer = new MutationObserver(refresh);
    for (let target: HTMLElement | null = trigger; target; target = target.parentElement) {
      observer.observe(target, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'data-inkra-theme', 'dir', 'lang', 'style'],
      });
    }

    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const forcedColors = window.matchMedia('(forced-colors: active)');
    colorScheme.addEventListener('change', refresh);
    forcedColors.addEventListener('change', refresh);
    refresh();

    return () => {
      observer.disconnect();
      colorScheme.removeEventListener('change', refresh);
      forcedColors.removeEventListener('change', refresh);
    };
  }, [trigger]);

  const value = useMemo<PortalThemeContextValue>(
    () => ({ captureTrigger, depth, snapshot }),
    [captureTrigger, depth, snapshot],
  );

  return (
    <PortalLayerDepthContext.Provider value={depth}>
      <PortalThemeContext.Provider value={value}>{children}</PortalThemeContext.Provider>
    </PortalLayerDepthContext.Provider>
  );
}

export function usePortalTriggerRef<Element extends HTMLElement>(forwardedRef: ForwardedRef<Element>) {
  const captureTrigger = useContext(PortalThemeContext)?.captureTrigger;
  return useCallback((node: Element | null) => {
    assignRef(forwardedRef, node);
    captureTrigger?.(node);
  }, [captureTrigger, forwardedRef]);
}

// Presence must receive each animated DOM node, not a display:contents wrapper.
export function mapPortalChildren(children: ReactNode, render: (child: ReactNode) => ReactNode): ReactNode {
  return Children.map(children, child => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      return mapPortalChildren(child.props.children, render);
    }
    return child == null ? null : render(child);
  });
}

export function usePortalThemeProps<Props extends HTMLAttributes<HTMLElement>>(props: Props) {
  const context = useContext(PortalThemeContext);
  const depth = context?.depth ?? 0;
  const snapshot = context?.snapshot ?? emptySnapshot;
  return {
    'data-inkra-theme': snapshot.inkraTheme,
    'data-theme': snapshot.theme,
    dir: snapshot.direction,
    lang: snapshot.language,
    ...props,
    style: {
      ...snapshot.style,
      '--inkra-floating-layer-offset': `${depth * 20}`,
      ...props.style,
    } as InkraStyle,
  };
}

export const PortalThemeBridge = forwardRef<HTMLDivElement, { children: ReactNode }>(function PortalThemeBridge({ children }, ref) {
  const context = useContext(PortalThemeContext);
  const depth = context?.depth ?? 0;
  const snapshot = context?.snapshot ?? emptySnapshot;
  const style = useMemo<InkraStyle>(() => ({
    ...snapshot.style,
    '--inkra-floating-layer-offset': `${depth * 20}`,
  }), [depth, snapshot.style]);

  return (
    <div
      className="inkra-portal-theme-bridge"
      ref={ref}
      data-inkra-theme={snapshot.inkraTheme}
      data-theme={snapshot.theme}
      dir={snapshot.direction}
      lang={snapshot.language}
      style={style}
    >
      {children}
    </div>
  );
});
