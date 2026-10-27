import { decimals } from './money';
import type { Expense, Group, Member, Recurring, Template } from './types';
import { FUTURE_SLACK_MS, latestEdit, revalidate } from './validate';

type Entity = Member | Expense | Recurring | Template;

/**
 * Gana la versión editada más tarde; si empatan, la mayor en orden de texto JSON (determinista: da
 * igual el orden en que se fusionen las copias, todas acaban iguales).
 */
function newer<T extends Entity>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

function unionById<T extends Entity>(a: readonly T[], b: readonly T[]): T[] {
  const map = new Map<string, T>();
  for (const x of [...a, ...b]) {
    const prev = map.get(x.id);
    map.set(x.id, prev ? newer(prev, x) : x);
  }
  return [...map.values()];
}

/**
 * Fusiona dos copias del MISMO grupo (mismo `id`). Conmutativa, asociativa e idempotente:
 * merge(a, b) = merge(b, a), y fusionar dos veces no cambia nada. Los borrados viajan como lápidas.
 */
export function mergeGroups(a: Group, b: Group): Group {
  if (a.id !== b.id) throw new Error('No son el mismo grupo');
  const cabecera = (g: Group) => JSON.stringify([g.name, g.emoji, g.currency]);
  const head =
    a.updatedAt !== b.updatedAt ? (a.updatedAt > b.updatedAt ? a : b) : cabecera(a) >= cabecera(b) ? a : b;
  return {
    v: 1,
    id: a.id,
    name: head.name,
    emoji: head.emoji,
    currency: head.currency,
    createdAt: Math.min(a.createdAt, b.createdAt),
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    members: unionById(a.members, b.members).sort((x, y) => (x.id < y.id ? -1 : 1)),
    expenses: unionById(a.expenses, b.expenses).sort((x, y) => (x.id < y.id ? -1 : 1)),
    recurring: unionById(a.recurring, b.recurring).sort((x, y) => (x.id < y.id ? -1 : 1)),
    templates: unionById(a.templates, b.templates).sort((x, y) => (x.id < y.id ? -1 : 1)),
  };
}

/** Qué cambiaría en `local` al fusionar `incoming`. Se enseña antes de aceptar, sin esconder nada. */
export interface MergeSummary {
  /** Fusionar no cambiaría nada. */
  upToDate: boolean;
  newExpenses: number;
  changed: number;
  /** Gastos que quedarían borrados (incluidas lápidas de gastos que aquí no existían). */
  removed: number;
  newMembers: number;
  renamedMembers: number;
  removedMembers: number;
  /** Gastos fijos nuevos, cambiados o borrados. */
  recurring: number;
  /** Plantillas nuevas, cambiadas o borradas. */
  templates: number;
  /** Cambia el nombre o el icono del grupo. */
  header: boolean;
  /** Cambia la moneda del grupo. */
  currency: boolean;
}

/** Cuenta, por id, las entidades de `incoming` que ganarían a las de `local` y en qué sentido. */
function diff<T extends Entity>(local: readonly T[], incoming: readonly T[]) {
  const known = new Map(local.map((x) => [x.id, x]));
  const out = { added: 0, changed: 0, removed: 0 };
  for (const x of incoming) {
    const mine = known.get(x.id);
    if (!mine) {
      if (x.deleted) out.removed++;
      else out.added++;
    } else if (newer(mine, x) === x && JSON.stringify(mine) !== JSON.stringify(x)) {
      if (x.deleted && !mine.deleted) out.removed++;
      else out.changed++;
    }
  }
  return out;
}

export function mergePreview(local: Group, incoming: Group): MergeSummary {
  const merged = mergeGroups(local, incoming);
  const e = diff(local.expenses, incoming.expenses);
  const m = diff(local.members, incoming.members);
  const r = diff(local.recurring, incoming.recurring);
  const tp = diff(local.templates, incoming.templates);
  return {
    // Se compara con `local` normalizado (la fusión ordena por id), no con el original.
    upToDate: JSON.stringify(merged) === JSON.stringify(mergeGroups(local, local)),
    newExpenses: e.added,
    changed: e.changed,
    removed: e.removed,
    newMembers: m.added,
    renamedMembers: m.changed,
    removedMembers: m.removed,
    recurring: r.added + r.changed + r.removed,
    templates: tp.added + tp.changed + tp.removed,
    header: merged.name !== local.name || merged.emoji !== local.emoji,
    currency: merged.currency !== local.currency,
  };
}

export type IncomingProblem = 'future' | 'currency' | 'limits';

/**
 * Motivo para NO aceptar un grupo que llega de fuera, o `null`:
 * - `future`: trae ediciones fechadas en el futuro (ganarían a las tuyas durante meses);
 * - `currency`: cambia a una moneda con otros decimales y ya hay gastos (todo se multiplicaría o dividiría por 100);
 * - `limits`: el resultado superaría los límites y al volver a abrir la app se rechazaría.
 */
export function incomingProblem(local: Group | undefined, incoming: Group, now = Date.now()): IncomingProblem | null {
  if (latestEdit(incoming) > now + FUTURE_SLACK_MS) return 'future';
  if (local && decimals(local.currency) !== decimals(incoming.currency) && [...local.expenses, ...incoming.expenses].some((e) => !e.deleted)) {
    return 'currency';
  }
  try {
    revalidate(local ? mergeGroups(local, incoming) : incoming);
  } catch {
    return 'limits';
  }
  return null;
}
