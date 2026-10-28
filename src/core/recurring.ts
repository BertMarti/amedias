import type { Expense, Group, IsoDate, Recurring } from './types';

/** `AAAA-MM` de una fecha local. */
export const monthOf = (date: IsoDate): string => date.slice(0, 7);

function nextMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/**
 * Id del gasto que genera un gasto fijo en un mes: **determinista**. Si dos móviles generan el alquiler
 * de marzo por su cuenta, sale el mismo id y al fusionar queda uno solo.
 */
export const recurringExpenseId = (r: Recurring, ym: string): string => `${r.id}~${ym}`;

/**
 * Añade los gastos de los gastos fijos hasta `today` (incluido el mes actual si ya pasó el día).
 * Nunca duplica: si el gasto de ese mes ya existe (aunque se borrara), no lo vuelve a crear.
 * Devuelve el grupo nuevo y cuántos gastos añadió.
 */
export function materializeRecurring(group: Group, today: IsoDate, now = Date.now()): { group: Group; added: number } {
  const existing = new Set(group.expenses.map((e) => e.id));
  const members = new Set(group.members.filter((m) => !m.deleted).map((m) => m.id));
  const nuevos: Expense[] = [];
  const thisMonth = monthOf(today);
  const todayDay = Number(today.slice(8, 10));
  for (const r of group.recurring) {
    if (r.deleted || !members.has(r.paidBy)) continue;
    let ym = r.startMonth;
    // Como mucho 36 meses de golpe: evita bucles largos con fechas absurdas.
    for (let i = 0; i < 36 && ym <= thisMonth && (!r.endMonth || ym <= r.endMonth); i++, ym = nextMonth(ym)) {
      if (ym === thisMonth && todayDay < r.day) break;
      const id = recurringExpenseId(r, ym);
      if (existing.has(id)) continue;
      existing.add(id);
      nuevos.push({
        id,
        kind: 'expense',
        title: r.title,
        amount: r.amount,
        ...(r.original && { original: r.original }),
        paidBy: r.paidBy,
        split: r.split,
        category: r.category,
        date: `${ym}-${String(r.day).padStart(2, '0')}`,
        recurringId: r.id,
        createdAt: now,
        // La marca del gasto fijo: si dos móviles generan el mismo mes con versiones distintas del fijo, gana
        // la más reciente; y cualquier edición manual posterior de ese gasto gana a ambas.
        updatedAt: r.updatedAt,
      });
    }
  }
  if (nuevos.length === 0) return { group, added: 0 };
  return { group: { ...group, expenses: [...group.expenses, ...nuevos] }, added: nuevos.length };
}
