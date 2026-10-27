/** Crear y editar entidades con ids y marcas de tiempo correctas (lo que necesita la fusión). */
import { decimals } from './money';
import { cleanText } from './validate';
import { LIMITS, type Category, type Cents, type Currency, type Expense, type Group, type Id, type IsoDate, type Member, type Recurring, type Split, type Template } from './types';

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
}

export function addExpense(group: Group, input: ExpenseInput, now = Date.now()): Group {
  const e: Expense = { id: uuid(), kind: input.kind ?? 'expense', ...input, title: cleanText(input.title) || 'Gasto', createdAt: now, updatedAt: now };
  return { ...group, expenses: [...group.expenses, e] };
}

export function updateExpense(group: Group, id: Id, input: ExpenseInput, now = Date.now()): Group {
  return {
    ...group,
    expenses: group.expenses.map((e) => (e.id === id ? { ...e, ...input, title: cleanText(input.title) || e.title, updatedAt: bump(e.updatedAt, now) } : e)),
  };
}

/** Borrar = lápida, para que el borrado también llegue a los demás al fusionar. */
export function deleteExpense(group: Group, id: Id, now = Date.now()): Group {
  return { ...group, expenses: group.expenses.map((e) => (e.id === id ? { ...e, deleted: true, updatedAt: bump(e.updatedAt, now) } : e)) };
}

/** Registrar que `from` le ha pagado `amount` a `to` (Bizum, transferencia, efectivo). */
export function addPayment(group: Group, from: Id, to: Id, amount: Cents, date: IsoDate, now = Date.now()): Group {
  return addExpense(group, { kind: 'transfer', title: 'Pago', amount, paidBy: from, split: { mode: 'exact', amounts: { [to]: amount } }, category: 'otros', date }, now);
}

export type RecurringInput = Omit<Recurring, 'id' | 'updatedAt' | 'deleted'>;

export function addRecurring(group: Group, input: RecurringInput, now = Date.now()): Group {
  const r: Recurring = { ...input, id: uuid(), title: cleanText(input.title) || 'Gasto fijo', day: Math.min(28, Math.max(1, Math.round(input.day))), updatedAt: now };
  return { ...group, recurring: [...group.recurring, r] };
}

export function updateRecurring(group: Group, id: Id, patch: Partial<RecurringInput> & { deleted?: boolean }, now = Date.now()): Group {
  return { ...group, recurring: group.recurring.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: bump(r.updatedAt, now) } : r)) };
}

export function renameGroup(group: Group, patch: Partial<Pick<Group, 'name' | 'emoji' | 'currency'>>, now = Date.now()): Group {
  // Los importes van en la unidad mínima: pasar de EUR (2 decimales) a JPY (0) multiplicaría todo por 100.
  if (patch.currency && decimals(patch.currency) !== decimals(group.currency) && group.expenses.some((e) => !e.deleted)) {
    throw new Error('No se puede cambiar a una moneda con distintos decimales si el grupo ya tiene gastos');
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
 * y la identidad: el gasto nuevo tendrá su propio id.
 */
export function repeatInput(src: TemplateInput, date: IsoDate = today()): Omit<ExpenseInput, 'amount'> & { amount?: Cents } {
  return { kind: 'expense', title: src.title, ...(src.amount !== undefined && { amount: src.amount }), paidBy: src.paidBy, split: src.split, category: src.category, date };
}
