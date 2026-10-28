/**
 * Varias monedas en un grupo (v0.4.0): un gasto pagado en yenes en un viaje en euros.
 *
 * El grupo conserva su moneda. Un gasto en otra moneda guarda el importe tal cual se pagó (`original.amount`, en la
 * unidad mínima de esa moneda) y el **tipo de cambio que escribió la persona**, y su `amount` es el equivalente en la
 * moneda del grupo, calculado una sola vez con aritmética entera y redondeo determinista. Saldos, repartos, resumen y
 * fusión siguen trabajando solo con `amount`, como siempre.
 *
 * El tipo de cambio es un entero en **millonésimas** (`RATE_SCALE`) del número que se escribió, en la dirección en que se
 * escribió:
 * - sin `inverse`: 1 [moneda del grupo] = rate / 1e6 [moneda original]  («1 EUR = 161,5 JPY», como cotizan los bancos);
 * - con `inverse`: 1 [moneda original] = rate / 1e6 [moneda del grupo]  («1 USD = 0,92 EUR»; «1 USD = 17,2 MXN» en un
 *   grupo en pesos).
 * Así lo que se escribió se guarda exacto (sin pasar por decimales flotantes ni perder cifras al invertir) y vale tanto
 * para monedas fuertes como débiles.
 */
import { decimals } from './money';
import { LIMITS, type Cents, type Currency, type Group, type Original } from './types';

/** El tipo de cambio se guarda en millonésimas: 161,5 → 161 500 000. */
export const RATE_SCALE = 1_000_000;
/** 0,000001: por debajo, casi seguro un error o un dato manipulado. */
export const RATE_MIN = 1;
/** 1 000 000 de una moneda por 1 de la otra: cubre de sobra cualquier par de la lista (hoy el mayor ronda los 5 000). */
export const RATE_MAX = 1_000_000 * RATE_SCALE;

const SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Pasa `amount` (unidad mínima de `from`) a la unidad mínima de `to` con el tipo `rate`. Entera (BigInt) y con redondeo
 * a la unidad más cercana (las mitades hacia arriba): el mismo dato da el mismo importe en cualquier móvil.
 * Devuelve `Infinity` si el resultado no cabe en un entero seguro (nunca pasaría la validación).
 */
export function convert(amount: Cents, rate: number, inverse: boolean, from: Currency, to: Currency): Cents {
  const scale = BigInt(RATE_SCALE);
  const r = BigInt(rate);
  const num = BigInt(amount) * (inverse ? r : scale) * 10n ** BigInt(decimals(to));
  const den = (inverse ? scale : r) * 10n ** BigInt(decimals(from));
  const out = (2n * num + den) / (2n * den);
  return out > SAFE ? Infinity : Number(out);
}

/** Equivalente en la moneda del grupo de un importe en otra moneda (el `amount` que corresponde a `original`). */
export const baseAmount = (o: Original, base: Currency): Cents => convert(o.amount, o.rate, o.inverse === true, o.currency, base);

export type FxProblem = 'same' | 'rate' | 'small' | 'big';

/**
 * Construye el par (`amount`, `original`) de un gasto escrito en otra moneda, o el motivo por el que no vale:
 * misma moneda que el grupo, tipo de cambio fuera de límites, o un equivalente de menos de una unidad o por encima del
 * tope de importes.
 */
export function foreignAmount(
  typed: Cents,
  currency: Currency,
  rate: number,
  inverse: boolean,
  base: Currency,
): { amount: Cents; original: Original } | { problem: FxProblem } {
  if (currency === base) return { problem: 'same' };
  if (!Number.isSafeInteger(rate) || rate < RATE_MIN || rate > RATE_MAX) return { problem: 'rate' };
  const original: Original = { currency, amount: typed, rate, ...(inverse && { inverse: true as const }) };
  const amount = baseAmount(original, base);
  if (amount < 1) return { problem: 'small' };
  if (amount > LIMITS.amount) return { problem: 'big' };
  return { amount, original };
}

/**
 * Lee un tipo de cambio escrito a mano: «161,5», «0.0062», «1.234,5», «4,512.37», «17» → millonésimas.
 *
 * A diferencia de los importes, un separador que aparece **una sola vez** es siempre decimal (los cambios llevan a menudo
 * tres o más decimales: «0,856», «1.085»). Si aparecen los dos, el último es el decimal y el otro agrupa miles de tres en
 * tres; si uno se repite, agrupa miles. Como mucho 6 decimales. `null` si no se entiende o se sale de los límites.
 */
export function parseRate(input: string): number | null {
  const raw = input.replace(/\s/g, ''); // \s incluye el espacio duro
  if (!/^\d[\d.,]*$/.test(raw) || /[.,]{2}/.test(raw) || /[.,]$/.test(raw)) return null;
  const count = (ch: string) => raw.split(ch).length - 1;
  const commas = count(',');
  const dots = count('.');
  let intPart = raw;
  let frac = '';
  let group: string | null = null;
  if (commas > 0 && dots > 0) {
    const dec = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? ',' : '.';
    if (count(dec) !== 1) return null;
    [intPart, frac] = raw.split(dec) as [string, string];
    group = dec === ',' ? '.' : ',';
  } else if (commas + dots === 1) {
    [intPart, frac] = raw.split(commas ? ',' : '.') as [string, string];
  } else if (commas + dots > 1) {
    group = commas ? ',' : '.';
  }
  if (group !== null && intPart.includes(group)) {
    // Miles de tres en tres: «1.234.567», no «1.23.4».
    if (!new RegExp(`^\\d{1,3}(\\${group}\\d{3})+$`).test(intPart)) return null;
    intPart = intPart.split(group).join('');
  }
  if (!/^\d+$/.test(intPart) || !/^\d*$/.test(frac) || frac.length > 6 || intPart.replace(/^0+/, '').length > 7) return null;
  const micro = Number(intPart) * RATE_SCALE + Number(frac.padEnd(6, '0'));
  return micro >= RATE_MIN && micro <= RATE_MAX ? micro : null;
}

/** Millonésimas → texto para un campo o una etiqueta, sin agrupar miles y sin ceros de sobra («161,5»). */
export function rateToInput(rate: number, locale = 'es-ES'): string {
  const sep = new Intl.NumberFormat(locale).format(1.5).includes(',') ? ',' : '.';
  const int = Math.floor(rate / RATE_SCALE);
  const frac = String(rate % RATE_SCALE).padStart(6, '0').replace(/0+$/, '');
  return frac ? `${int}${sep}${frac}` : String(int);
}

/** El mismo cambio en la otra dirección (161,5 → 0,006192), redondeado a millonésimas. `null` si se sale de los límites. */
export function invertRate(rate: number): number | null {
  if (!Number.isSafeInteger(rate) || rate < RATE_MIN || rate > RATE_MAX) return null;
  const s = BigInt(RATE_SCALE) * BigInt(RATE_SCALE);
  const out = Number((2n * s + BigInt(rate)) / (2n * BigInt(rate)));
  return out >= RATE_MIN && out <= RATE_MAX ? out : null;
}

/** «1 EUR = 161,5 JPY»: el cambio tal como se escribió, con los códigos de moneda (sin ambigüedad entre pesos y dólares). */
export function formatRate(o: Pick<Original, 'currency' | 'rate' | 'inverse'>, base: Currency, locale = 'es-ES'): string {
  const [from, to] = o.inverse ? [o.currency, base] : [base, o.currency];
  return `1 ${from} = ${rateToInput(o.rate, locale)} ${to}`;
}

/**
 * Último cambio usado en el grupo para `currency` (gastos y gastos fijos vivos; gana la edición más reciente), para
 * proponerlo al apuntar otro gasto en esa moneda. `null` si no se ha usado nunca.
 */
export function lastRate(group: Group, currency: Currency): Pick<Original, 'rate' | 'inverse'> | null {
  let best: { at: number; id: string; o: Original } | null = null;
  for (const x of [...group.expenses, ...group.recurring]) {
    const o = x.original;
    if (x.deleted || !o || o.currency !== currency) continue;
    if (!best || x.updatedAt > best.at || (x.updatedAt === best.at && x.id > best.id)) best = { at: x.updatedAt, id: x.id, o };
  }
  return best ? { rate: best.o.rate, ...(best.o.inverse && { inverse: true as const }) } : null;
}

/** ¿Hay gastos o gastos fijos vivos en otra moneda? Sus cambios son respecto a la moneda del grupo, que entonces no se puede cambiar. */
export const hasForeign = (group: Group): boolean => [...group.expenses, ...group.recurring].some((x) => !x.deleted && x.original !== undefined);
