import { useCallback, useMemo, useRef, useState } from 'react';

/** Shared by markers, custom icons, routes and areas; visual content never owns selection. */
export function useJourneySelection<T extends { id: string }>(items: readonly T[], mode: 'single' | 'multiple', single: string | undefined,
  onSelect: ((item: T) => void) | undefined, selected: readonly string[] | undefined, onChange: ((ids: readonly string[]) => void) | undefined) {
  const [local, setLocal] = useState<readonly string[]>(single === undefined ? [] : [single]);
  const ids = useMemo(() => {
    const available = new Set(items.map(item => item.id));
    return new Set((mode === 'multiple' ? selected ?? local : single === undefined ? [] : [single]).filter(id => available.has(id)));
  }, [items, mode, single, selected, local]);
  const latest = useRef({ mode, ids, selected, onChange, onSelect });
  latest.current = { mode, ids, selected, onChange, onSelect };
  const select = useCallback((item: T) => {
    const current = latest.current;
    let active = true;
    if (current.mode === 'multiple') {
      const next = new Set(current.ids);
      active = !next.has(item.id);
      if (active) next.add(item.id); else next.delete(item.id);
      if (current.selected === undefined) { current.ids = next; setLocal([...next]); }
      current.onChange?.([...next]);
    }
    current.onSelect?.(item);
    return active;
  }, []);
  return { ids, select, enabled: mode === 'multiple' || Boolean(onSelect) };
}
