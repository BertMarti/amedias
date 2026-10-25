import { liveExpenses } from './split';
import { CATEGORIES, type Category, type Cents, type Group } from './types';

/** Gasto total por categoría (solo gastos, no pagos entre personas). `month` = `AAAA-MM` o todo. */
export function byCategory(group: Group, month?: string): Record<Category, Cents> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, Cents>;
  for (const e of liveExpenses(group)) {
    if (e.kind !== 'expense' || (month && !e.date.startsWith(month))) continue;
    out[e.category] += e.amount;
  }
  return out;
}

/** Gasto total por mes de los últimos `months` meses hasta `ref` (`AAAA-MM`), del más antiguo al actual. */
export function byMonth(group: Group, ref: string, months = 6): { month: string; total: Cents }[] {
  const list: string[] = [];
  let [y, m] = ref.split('-').map(Number) as [number, number];
  for (let i = 0; i < months; i++) {
    list.unshift(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  const totals = new Map(list.map((k) => [k, 0]));
  for (const e of liveExpenses(group)) {
    if (e.kind !== 'expense') continue;
    const k = e.date.slice(0, 7);
    if (totals.has(k)) totals.set(k, totals.get(k)! + e.amount);
  }
  return list.map((month) => ({ month, total: totals.get(month)! }));
}
