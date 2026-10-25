import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { I18nProvider } from 'react-aria-components/I18nProvider';
import { inkraLocales, type InkraLocale, type InkraMessageKey, type InkraMessages } from './catalog.js';

export { inkraLocales } from './catalog.js';
export type { InkraLocale, InkraMessageKey, InkraMessages } from './catalog.js';
export type InkraMessageValues = Readonly<Record<string, string | number | bigint>>;
export type InkraTranslate = (key: InkraMessageKey, values?: InkraMessageValues) => string;
export type InkraDictionary = Partial<InkraMessages>;

export function resolveInkraLocale(locale: string): InkraLocale {
  const language = canonicalLocale(locale).split('-')[0].toLowerCase();
  if (language === 'zh') return 'zh-CN';
  return language === 'ja' || language === 'ko' || language === 'fr' ? language : 'en';
}

function canonicalLocale(locale: string): string {
  try { return Intl.getCanonicalLocales(locale.trim().replace(/_/g, '-'))[0] ?? 'en-US'; }
  catch { return 'en-US'; }
}

function definedMessages(messages?: InkraDictionary): InkraDictionary {
  return Object.fromEntries(Object.entries(messages ?? {}).filter(([, value]) => typeof value === 'string'));
}

export function createInkraTranslator(locale: string = 'en', messages?: InkraDictionary): InkraTranslate {
  const defaults = inkraLocales[resolveInkraLocale(locale)];
  const overrides = definedMessages(messages);
  return (key, values) => {
    const template = (Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : undefined)
      ?? (Object.prototype.hasOwnProperty.call(defaults, key) ? defaults[key] : undefined) ?? key;
    // Replace once: user values, including braces and dollar signs, remain literal text.
    return template.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (match, name: string) =>
      values && Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match);
  };
}

interface LocaleContextValue {
  locale: string | undefined;
  messages: InkraDictionary;
  t: InkraTranslate;
}
const LocaleContext = createContext<LocaleContextValue>({ locale: undefined, messages: {}, t: createInkraTranslator() });

export interface InkraProviderProps {
  /** BCP 47 locale. Unknown languages use English copy while keeping valid Intl formatting. */
  locale?: string;
  /** Partial dictionary. Nested providers override individual keys without losing inherited entries. */
  messages?: InkraDictionary;
  children?: ReactNode;
}

export function InkraProvider({ locale, messages, children }: InkraProviderProps) {
  const parent = useContext(LocaleContext);
  const value = useMemo(() => {
    const resolved = locale === undefined ? parent.locale : canonicalLocale(locale);
    const merged = { ...parent.messages, ...definedMessages(messages) };
    return { locale: resolved, messages: merged, t: createInkraTranslator(resolved, merged) };
  }, [locale, messages, parent]);
  return <LocaleContext.Provider value={value}><I18nProvider locale={value.locale ?? 'en-US'}>{children}</I18nProvider></LocaleContext.Provider>;
}

/** An explicit component locale wins; defaultLocale only applies without a configured provider locale. */
export function useInkraLocale(locale?: string, defaultLocale = 'en-US') {
  const context = useContext(LocaleContext);
  return useMemo(() => {
    const resolved = canonicalLocale(locale ?? context.locale ?? defaultLocale);
    return { ...context, locale: resolved, t: resolved === context.locale ? context.t : createInkraTranslator(resolved, context.messages) };
  }, [context, locale, defaultLocale]);
}
