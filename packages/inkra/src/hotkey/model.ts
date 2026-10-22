export type HotkeyPlatform = 'auto' | 'mac' | 'windows';
export type ResolvedHotkeyPlatform = Exclude<HotkeyPlatform, 'auto'>;
export type HotkeyModifier = 'control' | 'alt' | 'shift' | 'meta';

export interface HotkeyValue {
  key: string;
  code?: string;
  modifiers?: readonly HotkeyModifier[];
}

export interface HotkeyKeyboardEventLike {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
}

const modifierKeys = new Set([
  'Alt', 'AltGraph', 'Control', 'Fn', 'FnLock', 'Hyper', 'Meta', 'OS', 'Shift', 'Super', 'Symbol', 'SymbolLock',
]);
const ignoredKeys = new Set(['Dead', 'Process', 'Unidentified']);
const modifierOrder: readonly HotkeyModifier[] = ['control', 'alt', 'shift', 'meta'];

const keyLabels: Record<string, string> = {
  ' ': 'Space',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  Backspace: 'Backspace',
  CapsLock: 'Caps Lock',
  Delete: 'Delete',
  End: 'End',
  Enter: 'Enter',
  Escape: 'Esc',
  Home: 'Home',
  PageDown: 'Page Down',
  PageUp: 'Page Up',
  Tab: 'Tab',
};

const macKeyLabels: Record<string, string> = {
  Backspace: '⌫',
  CapsLock: '⇪',
  Delete: '⌦',
  End: '↘',
  Enter: '↩',
  Escape: 'Esc',
  Home: '↖',
  PageDown: '⇟',
  PageUp: '⇞',
  Tab: '⇥',
};

const modifierLabels: Record<ResolvedHotkeyPlatform, Record<HotkeyModifier, string>> = {
  mac: { control: '⌃', alt: '⌥', shift: '⇧', meta: '⌘' },
  windows: { control: 'Ctrl', alt: 'Alt', shift: 'Shift', meta: 'Win' },
};

export function detectHotkeyPlatform(platform?: string): ResolvedHotkeyPlatform {
  return /mac|iphone|ipad|ipod/i.test(platform ?? '') ? 'mac' : 'windows';
}

export function normalizeHotkey(value: HotkeyValue): HotkeyValue {
  const modifiers = modifierOrder.filter(modifier => value.modifiers?.includes(modifier));
  return {
    key: normalizeHotkeyKey(value.key),
    ...(value.code ? { code: value.code } : {}),
    ...(modifiers.length ? { modifiers } : {}),
  };
}

export function normalizeHotkeyKey(key: string): string {
  if (key === 'Spacebar') return ' ';
  if (key === 'Esc') return 'Escape';
  if (key.length === 1 && /[a-z]/i.test(key)) return key.toUpperCase();
  return key;
}

export function hotkeyFromKeyboardEvent(event: HotkeyKeyboardEventLike): HotkeyValue | null {
  if (event.isComposing || event.keyCode === 229 || modifierKeys.has(event.key) || ignoredKeys.has(event.key)) return null;
  const modifiers = modifierOrder.filter(modifier => {
    if (modifier === 'control') return Boolean(event.ctrlKey);
    if (modifier === 'alt') return Boolean(event.altKey);
    if (modifier === 'shift') return Boolean(event.shiftKey);
    return Boolean(event.metaKey);
  });
  return normalizeHotkey({ key: event.key, code: event.code, modifiers });
}

export function hotkeySignature(value: HotkeyValue | null | undefined): string {
  if (!value) return '';
  const normalized = normalizeHotkey(value);
  return `${normalized.modifiers?.join('+') ?? ''}|${normalized.code ?? ''}|${normalized.key}`;
}

export function getHotkeyTokens(value: HotkeyValue, platform: ResolvedHotkeyPlatform): string[] {
  const normalized = normalizeHotkey(value);
  const modifiers = normalized.modifiers?.map(modifier => modifierLabels[platform][modifier]) ?? [];
  const key = (platform === 'mac' ? macKeyLabels[normalized.key] : undefined)
    ?? keyLabels[normalized.key]
    ?? normalized.key;
  return [...modifiers, key];
}

export function formatHotkey(value: HotkeyValue, platform: ResolvedHotkeyPlatform): string {
  const tokens = getHotkeyTokens(value, platform);
  return platform === 'mac' ? tokens.join('') : tokens.join(' + ');
}

export function isHotkeyEscape(event: HotkeyKeyboardEventLike): boolean {
  return !event.isComposing && event.keyCode !== 229 && normalizeHotkeyKey(event.key) === 'Escape';
}

export function isHotkeyClear(event: HotkeyKeyboardEventLike): boolean {
  return !event.isComposing && event.keyCode !== 229 && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey
    && (event.key === 'Backspace' || event.key === 'Delete');
}
