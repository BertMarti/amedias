import { LIMITS, type Cents, type Currency } from './types';

/** Monedas sin decimales (el yen no tiene céntimos; el peso chileno, en la práctica, tampoco). */
const ZERO_DECIMALS: ReadonlySet<Currency> = new Set(['JPY', 'CLP']);

export const decimals = (currency: Currency): number => (ZERO_DECIMALS.has(currency) ? 0 : 2);

/**
 * Convierte lo que escribe una persona en céntimos: «12,5», «12.50», «1.234,56», «1,234.56», «€ 7».
 * Devuelve `null` si no es un importe válido, negativo, cero o fuera de límites.
 */
export function parseAmount(input: string, currency: Currency = 'EUR'): Cents | null {
  const raw = input.replace(/[\s\u00a0€$£¥]|CHF|MXN|ARS|COP|CLP|PEN/gi, '');
  if (!/^\d[\d.,]*$/.test(raw)) return null;
  if (/[.,]{2}/.test(raw)) return null; // «12..5», «1,,0»: mal escrito, mejor no adivinar
  let normalized: string;
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  const dec = Math.max(lastComma, lastDot);
  const fractional = dec === -1 ? '' : raw.slice(dec + 1);
  // El último separador es decimal solo si le siguen 1 o 2 cifras; si no, es de miles.
  if (dec !== -1 && fractional.length >= 1 && fractional.length <= 2 && !(decimals(currency) === 0)) {
    normalized = raw.slice(0, dec).replace(/[.,]/g, '') + '.' + fractional;
  } else {
    if (dec !== -1 && fractional.length !== 3) return null; // «12.3456» o «12,»: ambiguo
    normalized = raw.replace(/[.,]/g, '');
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 10 ** decimals(currency));
  if (cents <= 0 || cents > LIMITS.amount) return null;
  return cents;
}

/** Céntimos → texto con la moneda y el idioma, p. ej. «12,50 €». */
export function formatMoney(cents: Cents, currency: Currency, locale = 'es-ES'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals(currency),
    maximumFractionDigits: decimals(currency),
  }).format(cents / 10 ** decimals(currency));
}

/** Céntimos → número para un campo de texto, sin símbolo («12,50»). */
export function amountToInput(cents: Cents, currency: Currency, locale = 'es-ES'): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals(currency),
    maximumFractionDigits: decimals(currency),
    useGrouping: false,
  }).format(cents / 10 ** decimals(currency));
}
