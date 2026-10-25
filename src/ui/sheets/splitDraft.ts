/** Estado editable de un reparto (lo que se escribe) y su conversión a `Split` del dominio. */
import { type SplitProblem, amountToInput, parseAmount, type Cents, type Currency, type Id, type Member, type Split } from '../../core';
import type { Key } from '../../i18n';

export type SplitMode = Split['mode'];

export interface SplitDraft {
  mode: SplitMode;
  among: Id[];
  exact: Record<Id, string>;
  shares: Record<Id, number>;
  percent: Record<Id, string>;
}

export function draftFrom(split: Split | undefined, members: Member[], currency: Currency, locale: string): SplitDraft {
  const ids = members.map((m) => m.id);
  const d: SplitDraft = {
    mode: split?.mode ?? 'equal',
    among: split?.mode === 'equal' ? split.among.filter((id) => ids.includes(id)) : ids,
    exact: {},
    shares: Object.fromEntries(ids.map((id) => [id, 1])),
    percent: {},
  };
  if (split?.mode === 'exact') for (const [id, c] of Object.entries(split.amounts)) d.exact[id] = c > 0 ? amountToInput(c, currency, locale) : '';
  if (split?.mode === 'shares') d.shares = Object.fromEntries(ids.map((id) => [id, split.shares[id] ?? 0]));
  if (split?.mode === 'percent') {
    const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false });
    for (const [id, bp] of Object.entries(split.basisPoints)) d.percent[id] = bp > 0 ? nf.format(bp / 100) : '';
  }
  return d;
}

/** Importe escrito en un campo del reparto: vacío o 0 cuentan como 0; `null` si no se entiende. */
export function exactCents(text: string | undefined, currency: Currency): Cents | null {
  const t = (text ?? '').trim();
  if (t === '' || /^0+([.,]0*)?$/.test(t)) return 0;
  return parseAmount(t, currency);
}

export function percentBp(text: string | undefined): number | null {
  const t = (text ?? '').trim();
  if (t === '') return 0;
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(t)) return null;
  const bp = Math.round(Number(t.replace(',', '.')) * 100);
  return bp <= 10_000 ? bp : null;
}

export function draftToSplit(d: SplitDraft, members: Member[], currency: Currency): { split: Split; inputError: boolean } {
  const ids = members.map((m) => m.id);
  let inputError = false;
  switch (d.mode) {
    case 'equal':
      return { split: { mode: 'equal', among: ids.filter((id) => d.among.includes(id)) }, inputError };
    case 'exact': {
      const amounts: Record<Id, Cents> = {};
      for (const id of ids) {
        const c = exactCents(d.exact[id], currency);
        if (c === null) inputError = true;
        else if (c > 0) amounts[id] = c;
      }
      return { split: { mode: 'exact', amounts }, inputError };
    }
    case 'shares': {
      const shares: Record<Id, number> = {};
      for (const id of ids) if ((d.shares[id] ?? 0) > 0) shares[id] = d.shares[id]!;
      return { split: { mode: 'shares', shares }, inputError };
    }
    case 'percent': {
      const basisPoints: Record<Id, number> = {};
      for (const id of ids) {
        const bp = percentBp(d.percent[id]);
        if (bp === null) inputError = true;
        else if (bp > 0) basisPoints[id] = bp;
      }
      return { split: { mode: 'percent', basisPoints }, inputError };
    }
  }
}

/** Clave de traducción del código que devuelve `splitProblem`. */
export function problemKey(code: SplitProblem | null): Key | null {
  return code ? (`split.err.${code}` as Key) : null;
}
