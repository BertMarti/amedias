import type { Cents, Expense, Group, Id, Split, Transfer } from './types';

/**
 * Reparte `amount` según los pesos, con el método del mayor resto: el total cuadra siempre al céntimo
 * y los céntimos sobrantes van a quien más «se acercaba», desempatando por id (determinista: el mismo
 * gasto da el mismo reparto en todos los móviles).
 */
function byWeights(amount: Cents, weights: Record<Id, number>): Record<Id, Cents> {
  const ids = Object.keys(weights).filter((id) => weights[id]! > 0).sort();
  const total = ids.reduce((s, id) => s + weights[id]!, 0);
  if (total <= 0 || ids.length === 0) return {};
  const out: Record<Id, Cents> = {};
  const rest: { id: Id; frac: number }[] = [];
  let assigned = 0;
  for (const id of ids) {
    const exact = (amount * weights[id]!) / total;
    out[id] = Math.floor(exact);
    assigned += out[id]!;
    rest.push({ id, frac: exact - out[id]! });
  }
  rest.sort((a, b) => b.frac - a.frac || (a.id < b.id ? -1 : 1));
  for (let i = 0; i < amount - assigned; i++) out[rest[i % rest.length]!.id]! += 1;
  return out;
}

/** Cuánto le corresponde a cada persona de un gasto. Siempre suma exactamente `amount` (o `{}` si no es válido). */
export function shareOf(amount: Cents, split: Split): Record<Id, Cents> {
  switch (split.mode) {
    case 'equal':
      return byWeights(amount, Object.fromEntries([...new Set(split.among)].map((id) => [id, 1])));
    case 'shares':
      return byWeights(amount, split.shares);
    case 'percent':
      return byWeights(amount, split.basisPoints);
    case 'exact': {
      const sum = Object.values(split.amounts).reduce((s, v) => s + v, 0);
      return sum === amount ? Object.fromEntries(Object.entries(split.amounts).filter(([, v]) => v > 0)) : {};
    }
  }
}

export type SplitProblem = 'pick' | 'unknown' | 'amounts' | 'sum' | 'shares' | 'sharesZero' | 'percent' | 'percentSum';

/** Código del motivo por el que un reparto no es válido para el grupo (la interfaz lo traduce), o `null`. */
export function splitProblem(amount: Cents, split: Split, memberIds: ReadonlySet<Id>): SplitProblem | null {
  const ids =
    split.mode === 'equal'
      ? split.among
      : Object.keys(split.mode === 'exact' ? split.amounts : split.mode === 'shares' ? split.shares : split.basisPoints);
  if (ids.length === 0) return 'pick';
  if (ids.some((id) => !memberIds.has(id))) return 'unknown';
  if (split.mode === 'exact') {
    const values = Object.values(split.amounts);
    if (values.some((v) => !Number.isSafeInteger(v) || v < 0)) return 'amounts';
    if (values.reduce((s, v) => s + v, 0) !== amount) return 'sum';
  }
  if (split.mode === 'shares') {
    const values = Object.values(split.shares);
    if (values.some((v) => !Number.isInteger(v) || v < 0 || v > 1000)) return 'shares';
    if (!values.some((v) => v > 0)) return 'sharesZero';
  }
  if (split.mode === 'percent') {
    const values = Object.values(split.basisPoints);
    if (values.some((v) => !Number.isInteger(v) || v < 0)) return 'percent';
    if (values.reduce((s, v) => s + v, 0) !== 10_000) return 'percentSum';
  }
  return null;
}

/** Gastos que cuentan: los no borrados. */
export const liveExpenses = (group: Group): Expense[] => group.expenses.filter((e) => !e.deleted);

/**
 * Saldo de cada persona en céntimos: positivo = le deben; negativo = debe.
 * La suma de todos los saldos es siempre 0.
 */
export function balances(group: Group): Record<Id, Cents> {
  const out: Record<Id, Cents> = {};
  for (const m of group.members) out[m.id] = 0;
  for (const e of liveExpenses(group)) {
    const shares = shareOf(e.amount, e.split);
    if (Object.keys(shares).length === 0) continue; // reparto roto (dato antiguo o manipulado): no cuenta
    out[e.paidBy] = (out[e.paidBy] ?? 0) + e.amount;
    for (const [id, v] of Object.entries(shares)) out[id] = (out[id] ?? 0) - v;
  }
  return out;
}

/**
 * Transferencias para quedar a cero, con como mucho n-1 pagos: el que más debe paga al que más le
 * deben, y así hasta cuadrar. Deterministas (desempate por id).
 */
export function settle(bal: Record<Id, Cents>): Transfer[] {
  const creditors = Object.entries(bal).filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
  const debtors = Object.entries(bal).filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
  const order = (a: { id: Id; v: number }, b: { id: Id; v: number }) => b.v - a.v || (a.id < b.id ? -1 : 1);
  const out: Transfer[] = [];
  creditors.sort(order);
  debtors.sort(order);
  while (creditors.length && debtors.length) {
    const c = creditors[0]!;
    const d = debtors[0]!;
    const amount = Math.min(c.v, d.v);
    out.push({ from: d.id, to: c.id, amount });
    c.v -= amount;
    d.v -= amount;
    if (c.v === 0) creditors.shift();
    if (d.v === 0) debtors.shift();
    creditors.sort(order);
    debtors.sort(order);
  }
  return out;
}

/** Lo que ha gastado de verdad cada persona (su parte de los gastos, sin contar pagos entre personas). */
export function spentBy(group: Group): Record<Id, Cents> {
  const out: Record<Id, Cents> = {};
  for (const e of liveExpenses(group)) {
    if (e.kind !== 'expense') continue;
    for (const [id, v] of Object.entries(shareOf(e.amount, e.split))) out[id] = (out[id] ?? 0) + v;
  }
  return out;
}
