/**
 * Validación estricta de cualquier grupo que entra de fuera (enlace, archivo, almacenamiento local).
 *
 * No se confía en nada: se construye un objeto NUEVO campo a campo (lo desconocido se descarta), los
 * identificadores deben tener formato de UUID (así ninguna clave puede ser `__proto__` ni `constructor`),
 * los textos se recortan y limpian de caracteres de control y los números se acotan.
 */
import { splitProblem } from './split';
import { CATEGORIES, CURRENCIES, LIMITS, type Category, type Currency, type Expense, type Group, type Id, type Member, type Recurring, type Split } from './types';

export class InvalidGroupError extends Error {
  constructor(motivo: string) {
    super(`Datos no válidos: ${motivo}`);
    this.name = 'InvalidGroupError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EXPENSE_ID = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:~(\d{4}-(?:0[1-9]|1[0-2])))?$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
// Antes de 2000 o más de 2 años en el futuro: casi seguro un error o un dato manipulado.
const MIN_TS = Date.UTC(2000, 0, 1);
const maxTs = () => Date.now() + 2 * 365 * 24 * 3600 * 1000;
// Un gasto fijo solo genera gastos hasta el mes actual: más de dos meses por delante es manipulación.
const maxRecurringMonth = (d = new Date()) => {
  const m = d.getFullYear() * 12 + d.getMonth() + 2;
  return `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}`;
};

const fail = (m: string): never => {
  throw new InvalidGroupError(m);
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Texto limpio: sin controles ni marcas bidireccionales, espacios normalizados y longitud acotada. */
export function cleanText(v: unknown, max: number = LIMITS.text): string {
  if (typeof v !== 'string') return fail('texto');
  // \p{Cf}: caracteres de formato invisibles (marcas bidi, etiquetas U+E00xx, ZWJ…).
  // eslint-disable-next-line no-control-regex
  const s = v.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\p{Cf}]/gu, ' ');
  return s.replace(/\s+/g, ' ').trim().slice(0, max);
}

const id = (v: unknown, re = UUID): Id => (typeof v === 'string' && re.test(v) ? v : fail('identificador'));
const int = (v: unknown, min: number, max: number, what: string): number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max ? v : fail(what);
const ts = (v: unknown): number => int(v, 0, maxTs(), 'fecha interna');
const bool = (v: unknown): boolean | undefined => (v === true ? true : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[], what: string): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fail(what);

function record(v: unknown, min: number, max: number, members: ReadonlySet<Id>, what: string): Record<Id, number> {
  if (!isObj(v)) return fail(what);
  const entries = Object.entries(v);
  if (entries.length === 0 || entries.length > LIMITS.members) fail(what);
  return Object.fromEntries(entries.map(([k, n]) => [members.has(id(k)) ? k : fail(what), int(n, min, max, what)]));
}

function split(v: unknown, members: ReadonlySet<Id>): Split {
  if (!isObj(v)) return fail('reparto');
  switch (v.mode) {
    case 'equal': {
      if (!Array.isArray(v.among) || v.among.length === 0 || v.among.length > LIMITS.members) fail('reparto');
      const among = [...new Set((v.among as unknown[]).map((x) => id(x)))];
      if (among.some((x) => !members.has(x))) fail('reparto');
      return { mode: 'equal', among };
    }
    case 'exact':
      return { mode: 'exact', amounts: record(v.amounts, 0, LIMITS.amount, members, 'reparto') };
    case 'shares':
      return { mode: 'shares', shares: record(v.shares, 0, 1000, members, 'reparto') };
    case 'percent':
      return { mode: 'percent', basisPoints: record(v.basisPoints, 0, 10_000, members, 'reparto') };
    default:
      return fail('reparto');
  }
}

/** El reparto tiene que cuadrar con el importe: si no, los saldos lo ignorarían pero el resumen y el CSV no. */
function checkedSplit(v: unknown, amount: number, members: ReadonlySet<Id>): Split {
  const s = split(v, members);
  return splitProblem(amount, s, members) ? fail('reparto') : s;
}

function member(v: unknown): Member {
  if (!isObj(v)) return fail('persona');
  const name = cleanText(v.name, LIMITS.name);
  return { id: id(v.id), name: name || fail('nombre vacío'), updatedAt: ts(v.updatedAt), ...(bool(v.deleted) && { deleted: true }) };
}

/**
 * Los gastos de un gasto fijo tienen id `<id del fijo>~AAAA-MM`. Se exige que el fijo exista y que el mes no
 * esté en el futuro: si no, alguien podría colar lápidas de meses venideros y anular cobros que aún no existen.
 */
function expenseId(v: unknown, recurring: ReadonlySet<Id>, lastMonth: string): Id {
  const m = typeof v === 'string' ? EXPENSE_ID.exec(v) : null;
  if (!m) return fail('identificador');
  if (m[2] !== undefined && (!recurring.has(m[1]!) || m[2] > lastMonth)) fail('gasto fijo');
  return v as Id;
}

function expense(v: unknown, members: ReadonlySet<Id>, recurring: ReadonlySet<Id>, lastMonth: string): Expense {
  if (!isObj(v)) return fail('gasto');
  const date = typeof v.date === 'string' && DATE.test(v.date) ? v.date : fail('fecha');
  const amount = int(v.amount, 1, LIMITS.amount, 'importe');
  const e: Expense = {
    id: expenseId(v.id, recurring, lastMonth),
    kind: oneOf(v.kind, ['expense', 'transfer'] as const, 'tipo'),
    title: cleanText(v.title) || 'Sin título',
    amount,
    paidBy: members.has(id(v.paidBy)) ? (v.paidBy as Id) : fail('quién pagó'),
    split: checkedSplit(v.split, amount, members),
    category: oneOf<Category>(v.category, CATEGORIES, 'categoría'),
    date,
    createdAt: ts(v.createdAt),
    updatedAt: ts(v.updatedAt),
  };
  if (v.recurringId !== undefined) e.recurringId = id(v.recurringId);
  if (bool(v.deleted)) e.deleted = true;
  return e;
}

function recurringItem(v: unknown, members: ReadonlySet<Id>): Recurring {
  if (!isObj(v)) return fail('gasto fijo');
  const month = (x: unknown) => (typeof x === 'string' && MONTH.test(x) ? x : fail('mes'));
  const amount = int(v.amount, 1, LIMITS.amount, 'importe');
  const r: Recurring = {
    id: id(v.id),
    title: cleanText(v.title) || 'Gasto fijo',
    amount,
    paidBy: members.has(id(v.paidBy)) ? (v.paidBy as Id) : fail('quién paga'),
    split: checkedSplit(v.split, amount, members),
    category: oneOf<Category>(v.category, CATEGORIES, 'categoría'),
    day: int(v.day, 1, 28, 'día'),
    startMonth: month(v.startMonth),
    updatedAt: ts(v.updatedAt),
  };
  if (v.endMonth !== undefined) r.endMonth = month(v.endMonth);
  if (bool(v.deleted)) r.deleted = true;
  return r;
}

/** Valida y reconstruye un grupo. Lanza `InvalidGroupError` con un motivo genérico (sin eco de los datos). */
export function parseGroup(v: unknown): Group {
  if (!isObj(v) || v.v !== 1) return fail('formato');
  if (!Array.isArray(v.members) || v.members.length > LIMITS.members) fail('personas');
  if (!Array.isArray(v.expenses) || v.expenses.length > LIMITS.expenses) fail('gastos');
  if (!Array.isArray(v.recurring) || v.recurring.length > LIMITS.recurring) fail('gastos fijos');
  const members = (v.members as unknown[]).map(member);
  const ids = new Set(members.map((m) => m.id));
  if (ids.size !== members.length) fail('personas repetidas');
  const recurring = (v.recurring as unknown[]).map((r) => recurringItem(r, ids));
  if (new Set(recurring.map((r) => r.id)).size !== recurring.length) fail('gastos fijos repetidos');
  const lastMonth = maxRecurringMonth();
  const recIds = new Set(recurring.map((r) => r.id));
  const expenses = (v.expenses as unknown[]).map((e) => expense(e, ids, recIds, lastMonth));
  if (new Set(expenses.map((e) => e.id)).size !== expenses.length) fail('gastos repetidos');
  const createdAt = ts(v.createdAt);
  if (createdAt < MIN_TS) fail('fecha interna');
  return {
    v: 1,
    id: id(v.id),
    name: cleanText(v.name, LIMITS.name) || 'Grupo',
    // Solo un emoji (con modificadores y uniones): nada de texto libre en este campo.
    // eslint-disable-next-line no-misleading-character-class -- clase de emojis con uniones (ZWJ) a propósito
    emoji: typeof v.emoji === 'string' && /^[\p{Extended_Pictographic}\p{Regional_Indicator}][\p{Extended_Pictographic}\p{Emoji_Component}\u200d\ufe0f]{0,15}$/u.test(v.emoji)
      ? v.emoji
      : '💸',
    currency: oneOf<Currency>(v.currency, CURRENCIES, 'moneda'),
    members,
    expenses,
    recurring,
    createdAt,
    updatedAt: ts(v.updatedAt),
  };
}

/**
 * Vuelve a pasar un grupo ya construido por la validación completa (límites incluidos). Se usa antes de
 * guardar lo que sale de una fusión o de una importación: si no, se guardaría algo que al volver a abrir
 * la app se rechazaría, y el grupo desaparecería.
 */
export function revalidate(g: Group): Group {
  return parseGroup(JSON.parse(JSON.stringify(g)) as unknown);
}

/** Margen para relojes desajustados al aceptar datos de otra persona. */
export const FUTURE_SLACK_MS = 24 * 3600 * 1000;

/** Mayor marca de edición del grupo: si está en el futuro, sus cambios ganarían a los nuestros durante meses. */
export function latestEdit(g: Group): number {
  let max = g.updatedAt;
  for (const x of [...g.members, ...g.expenses, ...g.recurring]) if (x.updatedAt > max) max = x.updatedAt;
  return max;
}
