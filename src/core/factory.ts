/** Crear y editar entidades con ids y marcas de tiempo correctas (lo que necesita la fusión). */
import { hasForeign } from './fx';
import { decimals } from './money';
import { cleanText } from './validate';
import { LIMITS, type Category, type Cents, type Currency, type Expense, type Group, type Id, type IsoDate, type Member, type Original, type Recurring, type Split, type Template } from './types';

export const uuid = (): Id => crypto.randomUUID();

/**
 * Marca de una edición: nunca por debajo de la anterior + 1. Así una edición tuya siempre gana a la versión
 * que tenías, aunque esa versión trajera una fecha adelantada (reloj mal puesto o datos manipulados).
 */
const bump = (prev: number, now: number): number => Math.max(now, prev + 1);

/** Fecha local de hoy, `AAAA-MM-DD`. */
export function today(d = new Date()): IsoDate {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function newGroup(name: string, memberNames: string[], currency: Currency = 'EUR', emoji = '🏠', now = Date.now()): Group {
  const members: Member[] = [...new Set(memberNames.map((n) => cleanText(n, LIMITS.name)).filter(Boolean))]
    .slice(0, LIMITS.members)
    .map((n) => ({ id: uuid(), name: n, updatedAt: now }));
  return { v: 1, id: uuid(), name: cleanText(name, LIMITS.name) || 'Grupo', emoji, currency, members, expenses: [], recurring: [], templates: [], createdAt: now, updatedAt: now };
}

export function addMember(group: Group, name: string, now = Date.now()): Group {
  const n = cleanText(name, LIMITS.name);
  if (!n || group.members.filter((m) => !m.deleted).length >= LIMITS.members) return group;
  return { ...group, members: [...group.members, { id: uuid(), name: n, updatedAt: now }] };
}

export function updateMember(group: Group, id: Id, patch: Partial<Pick<Member, 'name' | 'deleted'>>, now = Date.now()): Group {
  return {
    ...group,
    members: group.members.map((m) =>
      m.id === id ? { ...m, ...(patch.name !== undefined && { name: cleanText(patch.name, LIMITS.name) || m.name }), ...(patch.deleted && { deleted: true }), updatedAt: bump(m.updatedAt, now) } : m,
    ),
  };
}

export interface ExpenseInput {
  kind?: 'expense' | 'transfer';
  title: string;
  amount: Cents;
  paidBy: Id;
  split: Split;
  category: Category;
  date: IsoDate;
  /** Si se pagó en otra moneda (v0.4.0): `amount` tiene que ser su equivalente (ver `foreignAmount`). */
  original?: Original;
}

/** Quita `original` de un objeto (también si viene como `undefined`) y lo vuelve a poner solo si hay uno. */
function setOriginal<T extends { original?: Original }>(x: T, original: Original | undefined): T {
  const { original: _old, ...rest } = x;
  return (original ? { ...rest, original } : rest) as T;
}

export function addExpense(group: Group, input: ExpenseInput, now = Date.now()): Group {
  const e: Expense = setOriginal({ id: uuid(), kind: input.kind ?? 'expense', ...input, title: cleanText(input.title) || 'Gasto', createdAt: now, updatedAt: now }, input.original);
  return { ...group, expenses: [...group.expenses, e] };
}

/** `input` es el gasto entero: si no trae `original` (se volvió a la moneda del grupo), el gasto deja de tenerlo. */
export function updateExpense(group: Group, id: Id, input: ExpenseInput, now = Date.now()): Group {
  return {
    ...group,
    expenses: group.expenses.map((e) => (e.id === id ? setOriginal({ ...e, ...input, title: cleanText(input.title) || e.title, updatedAt: bump(e.updatedAt, now) }, input.original) : e)),
  };
}

/** Borrar = lápida, para que el borrado también llegue a los demás al fusionar. La lápida no guarda `original`. */
export function deleteExpense(group: Group, id: Id, now = Date.now()): Group {
  return { ...group, expenses: group.expenses.map((e) => (e.id === id ? setOriginal({ ...e, deleted: true as const, updatedAt: bump(e.updatedAt, now) }, undefined) : e)) };
}

/** Registrar que `from` le ha pagado `amount` a `to` (Bizum, transferencia, efectivo), si acaso en otra moneda. */
export function addPayment(group: Group, from: Id, to: Id, amount: Cents, date: IsoDate, now = Date.now(), original?: Original): Group {
  return addExpense(group, { kind: 'transfer', title: 'Pago', amount, paidBy: from, split: { mode: 'exact', amounts: { [to]: amount } }, category: 'otros', date, ...(original && { original }) }, now);
}

export type RecurringInput = Omit<Recurring, 'id' | 'updatedAt' | 'deleted'>;

export function addRecurring(group: Group, input: RecurringInput, now = Date.now()): Group {
  const r: Recurring = setOriginal({ ...input, id: uuid(), title: cleanText(input.title) || 'Gasto fijo', day: Math.min(28, Math.max(1, Math.round(input.day))), updatedAt: now }, input.original);
  return { ...group, recurring: [...group.recurring, r] };
}

/**
 * Cambia parte de un gasto fijo. `original: undefined` en `patch` quita el importe en otra moneda; si `patch` no lo
 * menciona, se queda como estaba. Al borrarlo, la lápida no guarda `original`.
 */
export function updateRecurring(group: Group, id: Id, patch: Partial<RecurringInput> & { deleted?: boolean }, now = Date.now()): Group {
  return {
    ...group,
    recurring: group.recurring.map((r) => {
      if (r.id !== id) return r;
      const next = { ...r, ...patch, updatedAt: bump(r.updatedAt, now) } as Recurring;
      return 'original' in patch || patch.deleted ? setOriginal(next, patch.deleted ? undefined : patch.original) : next;
    }),
  };
}

export function renameGroup(group: Group, patch: Partial<Pick<Group, 'name' | 'emoji' | 'currency'>>, now = Date.now()): Group {
  // Los importes van en la unidad mínima: pasar de EUR (2 decimales) a JPY (0) multiplicaría todo por 100.
  if (patch.currency && decimals(patch.currency) !== decimals(group.currency) && group.expenses.some((e) => !e.deleted)) {
    throw new Error('No se puede cambiar a una moneda con distintos decimales si el grupo ya tiene gastos');
  }
  // Los gastos en otras monedas guardan su cambio respecto a la moneda del grupo: con otra, dejarían de cuadrar.
  if (patch.currency && patch.currency !== group.currency && hasForeign(group)) {
    throw new Error('No se puede cambiar la moneda del grupo si hay gastos en otras monedas');
  }
  return { ...group, ...patch, name: patch.name !== undefined ? cleanText(patch.name, LIMITS.name) || group.name : group.name, updatedAt: bump(group.updatedAt, now) };
}

/** Lo que se guarda de un gasto como plantilla (o lo que trae una plantilla al usarla). */
export type TemplateInput = Pick<Template, 'title' | 'paidBy' | 'split' | 'category'> & { amount?: Cents };

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Guarda una plantilla. Si ya hay una con el mismo nombre (sin contar mayúsculas ni tildes), la actualiza: guardar
 * otra vez «Súper» con otro importe no crea dos «Súper».
 */
export function saveTemplate(group: Group, input: TemplateInput, now = Date.now()): Group {
  const title = cleanText(input.title) || 'Plantilla';
  const data = { title, ...(input.amount !== undefined && { amount: input.amount }), paidBy: input.paidBy, split: input.split, category: input.category };
  const same = group.templates.find((t) => !t.deleted && fold(t.title) === fold(title));
  if (same) {
    return { ...group, templates: group.templates.map((t) => (t === same ? { id: t.id, ...data, updatedAt: bump(t.updatedAt, now) } : t)) };
  }
  return { ...group, templates: [...group.templates, { id: uuid(), ...data, updatedAt: now }] };
}

/** Borrar = lápida, como los gastos. */
export function deleteTemplate(group: Group, id: Id, now = Date.now()): Group {
  return { ...group, templates: group.templates.map((t) => (t.id === id ? { ...t, deleted: true, updatedAt: bump(t.updatedAt, now) } : t)) };
}

/** Plantillas vivas, por orden alfabético. */
export function liveTemplates(group: Group, locale = 'es'): Template[] {
  return group.templates.filter((t) => !t.deleted).sort((a, b) => a.title.localeCompare(b.title, locale));
}

/**
 * «Repetir»: lo que se copia de un gasto (o de una plantilla) a uno nuevo. Todo menos la fecha, que es la de hoy,
 * y la identidad: el gasto nuevo tendrá su propio id. Un gasto en otra moneda se repite en esa moneda y con su cambio.
 * Las plantillas no guardan otra moneda: llevan el importe en la del grupo.
 */
export function repeatInput(src: TemplateInput & { original?: Original }, date: IsoDate = today()): Omit<ExpenseInput, 'amount'> & { amount?: Cents } {
  return {
    kind: 'expense',
    title: src.title,
    ...(src.amount !== undefined && { amount: src.amount }),
    ...(src.original && { original: src.original }),
    paidBy: src.paidBy,
    split: src.split,
    category: src.category,
    date,
  };
}
