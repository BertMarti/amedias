import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { formatMoney, LOCALES, type Category, type Cents, type Currency, type Lang } from '../core';
import { ca } from './ca';
import { en } from './en';
import { es, type Dict } from './es';
import { gl } from './gl';
import { pt } from './pt';

export type { Lang } from '../core';
export type Key = keyof Dict;
export type PluralBase = { [K in Key]: K extends `${infer B}_one` ? B : never }[Key];
export type Vars = Record<string, string | number>;

export const dictionaries: Record<Lang, Dict> = { es, ca, gl, pt, en };

/** Nombre de cada idioma en ese mismo idioma, para el selector de Ajustes. */
export const LANG_NAMES: Record<Lang, string> = { es: 'Español', ca: 'Català', gl: 'Galego', pt: 'Português', en: 'English' };

function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export interface I18n {
  lang: Lang;
  locale: string;
  t: (key: Key, vars?: Vars) => string;
  /** Plural: usa `<base>_one` o `<base>_other`, con `{n}` disponible. */
  tp: (base: PluralBase, n: number, vars?: Vars) => string;
  money: (cents: Cents, currency: Currency) => string;
  /** `AAAA-MM-DD` → texto local («12 oct»). */
  date: (iso: string, opts?: Intl.DateTimeFormatOptions) => string;
  /** `AAAA-MM` → «octubre de 2026» o «oct». */
  month: (ym: string, style?: 'long' | 'short') => string;
  cat: (c: Category) => string;
}

export function makeI18n(lang: Lang): I18n {
  const dict = dictionaries[lang];
  const locale = LOCALES[lang];
  const t = (key: Key, vars?: Vars) => fill(dict[key], vars);
  return {
    lang,
    locale,
    t,
    tp: (base, n, vars) => fill(dict[`${base}_${n === 1 ? 'one' : 'other'}` as Key], { n, ...vars }),
    money: (cents, currency) => formatMoney(cents, currency, locale),
    date: (iso, opts = { day: 'numeric', month: 'short' }) => {
      const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
      return new Date(y, m - 1, d).toLocaleDateString(locale, opts);
    },
    month: (ym, style = 'long') => {
      const [y, m] = ym.split('-').map(Number) as [number, number];
      const opts: Intl.DateTimeFormatOptions = style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short' };
      return new Date(y, m - 1, 1).toLocaleDateString(locale, opts).replace('.', '');
    },
    cat: (c) => t(`cat.${c}`),
  };
}

const Ctx = createContext<I18n>(makeI18n('es'));

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo(() => makeI18n(lang), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = (): I18n => useContext(Ctx);
