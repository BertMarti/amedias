/**
 * Importe con su moneda (v0.4.0): la del grupo o, en un viaje, otra con su tipo de cambio escrito a mano. Enseña en vivo
 * el equivalente en la moneda del grupo, que es lo que cuenta para saldos y repartos.
 */
import { useId } from 'react';
import {
  amountToInput,
  CURRENCIES,
  decimals,
  foreignAmount,
  invertRate,
  lastRate,
  parseAmount,
  parseRate,
  rateToInput,
  type Cents,
  type Currency,
  type Group,
  type Original,
} from '../../core';
import { useI18n, type Key } from '../../i18n';
import { FieldNote } from '../bits';
import { Icon } from '../icons';

const SYMBOLS: Partial<Record<Currency, string>> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'CHF', MXN: '$', ARS: '$', COP: '$', CLP: '$', PEN: 'S/' };

/** Lo que se está escribiendo: importe en `currency` y, si no es la del grupo, el cambio y su dirección. */
export interface MoneyDraft {
  amount: string;
  currency: Currency;
  rate: string;
  /** Igual que en `Original`: `false` = «1 [grupo] = x [otra]»; `true` = «1 [otra] = x [grupo]». */
  inverse: boolean;
}

export function moneyDraftFrom(group: Group, src: { amount?: Cents; original?: Original } | undefined, locale: string): MoneyDraft {
  const o = src?.original;
  if (o && o.currency !== group.currency) {
    return { amount: amountToInput(o.amount, o.currency, locale), currency: o.currency, rate: rateToInput(o.rate, locale), inverse: o.inverse === true };
  }
  return { amount: src?.amount !== undefined ? amountToInput(src.amount, group.currency, locale) : '', currency: group.currency, rate: '', inverse: false };
}

export type MoneyProblem = 'amount' | 'needRate' | 'rate' | 'small' | 'big';

export interface MoneyValue {
  /** En la moneda del grupo: lo que se guarda como `amount`. */
  cents: Cents | null;
  /** Solo si es otra moneda y todo cuadra. */
  original?: Original;
  /** Lo escrito, en la unidad mínima de `currency`. */
  typed: Cents | null;
  foreign: boolean;
  problem: MoneyProblem | null;
}

export function readMoney(d: MoneyDraft, base: Currency): MoneyValue {
  const typed = parseAmount(d.amount, d.currency);
  if (d.currency === base) return { cents: typed, typed, foreign: false, problem: typed === null ? 'amount' : null };
  const fail = (problem: MoneyProblem): MoneyValue => ({ cents: null, typed, foreign: true, problem });
  if (typed === null) return fail('amount');
  if (d.rate.trim() === '') return fail('needRate');
  const rate = parseRate(d.rate);
  if (rate === null) return fail('rate');
  const r = foreignAmount(typed, d.currency, rate, d.inverse, base);
  if ('problem' in r) return fail(r.problem === 'small' || r.problem === 'big' ? r.problem : 'rate');
  return { cents: r.amount, original: r.original, typed, foreign: true, problem: null };
}

/** Texto del error de un importe (para quien lo enseña fuera del campo, p. ej. al guardar una plantilla). */
export function moneyProblemKey(p: MoneyProblem): Key {
  const keys: Record<MoneyProblem, Key> = { amount: 'expense.amountBad', needRate: 'fx.needRate', rate: 'fx.rateBad', small: 'fx.small', big: 'fx.big' };
  return keys[p];
}

interface Props {
  group: Group;
  value: MoneyDraft;
  onChange: (d: MoneyDraft) => void;
  touched: boolean;
  autoFocus?: boolean;
}

export function MoneyField({ group, value, onChange, touched, autoFocus = false }: Props) {
  const { t, money, locale } = useI18n();
  const id = useId();
  const base = group.currency;
  const v = readMoney(value, base);
  const typedBad = value.amount.trim() !== '' && v.typed === null;
  const [from, to] = value.inverse ? [value.currency, base] : [base, value.currency];

  const pickCurrency = (c: Currency) => {
    if (c === value.currency) return;
    if (c === base) return onChange({ ...value, currency: c });
    // Se propone el último cambio usado en el grupo para esa moneda (se puede cambiar).
    const last = lastRate(group, c);
    onChange({ ...value, currency: c, rate: last ? rateToInput(last.rate, locale) : '', inverse: last?.inverse === true });
  };

  const flip = () => {
    const r = parseRate(value.rate);
    const inv = r === null ? null : invertRate(r);
    onChange({ ...value, inverse: !value.inverse, rate: inv === null ? value.rate : rateToInput(inv, locale) });
  };

  let rateNote: { tone: 'ok' | 'error' | 'muted'; text: string };
  if (v.cents !== null) rateNote = { tone: 'ok', text: t('fx.equiv', { amount: money(v.cents, base) }) };
  else if (v.problem === 'rate' || v.problem === 'small' || v.problem === 'big') rateNote = { tone: 'error', text: t(moneyProblemKey(v.problem)) };
  else if (v.problem === 'needRate' && touched) rateNote = { tone: 'error', text: t('fx.needRate') };
  else rateNote = { tone: 'muted', text: t('fx.hint', { from, to }) };

  return (
    <div className="field amount-field">
      <label htmlFor={id} className="field-label">
        {t('expense.amount')}
      </label>
      <div className={`amount-input${typedBad ? ' amount-input--bad' : ''}`}>
        <span className="amount-symbol" aria-hidden="true">
          {SYMBOLS[value.currency] ?? value.currency}
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder={decimals(value.currency) ? '0,00' : '0'}
          value={value.amount}
          onChange={(e) => onChange({ ...value, amount: e.target.value })}
          aria-invalid={typedBad || (touched && v.typed === null)}
          aria-describedby={`${id}-note`}
          {...(autoFocus ? { 'data-autofocus': true } : {})}
        />
        <select className="amount-currency" aria-label={t('fx.currency')} value={value.currency} onChange={(e) => pickCurrency(e.target.value as Currency)}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <FieldNote id={`${id}-note`} tone={v.typed !== null ? 'ok' : typedBad || touched ? 'error' : 'muted'}>
        {v.typed !== null ? money(v.typed, value.currency) : typedBad || touched ? t('expense.amountBad') : t('expense.amountHint')}
      </FieldNote>

      {v.foreign && (
        <div className="fx">
          <div className="fx-head">
            <span className="field-label" id={`${id}-rate-label`}>
              {t('fx.rate')}
            </span>
            <button type="button" className="btn btn--ghost btn--sm fx-flip" onClick={flip} aria-label={t('fx.flipLabel', { from: to, to: from })}>
              <Icon name="swap" size={16} />
              {t('fx.flip')}
            </button>
          </div>
          <div className={`fx-input${v.problem === 'rate' ? ' fx-input--bad' : ''}`}>
            <span className="fx-affix" aria-hidden="true">
              1 {from} =
            </span>
            <input
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={value.rate}
              onChange={(e) => onChange({ ...value, rate: e.target.value })}
              aria-label={t('fx.rateOf', { from, to })}
              aria-invalid={v.problem === 'rate' || (touched && v.problem === 'needRate')}
              aria-describedby={`${id}-rate-note`}
            />
            <span className="fx-affix" aria-hidden="true">
              {to}
            </span>
          </div>
          <FieldNote id={`${id}-rate-note`} tone={rateNote.tone}>
            <span aria-live="polite">{rateNote.text}</span>
          </FieldNote>
        </div>
      )}
    </div>
  );
}
