/** Grupo de ejemplo: un piso de tres personas con dos meses de gastos y el alquiler como gasto fijo. */
import { addExpense, addPayment, addRecurring, materializeRecurring, newGroup, today, type Category, type Group } from '../core';
import type { Lang } from '../i18n';
import { addMonths } from './util';

interface Row {
  es: string;
  en: string;
  cents: number;
  who: 0 | 1 | 2;
  cat: Category;
  /** 0 = mes pasado, 1 = este mes. */
  month: 0 | 1;
  day: number;
  /** Para quién (por defecto, los tres). */
  for?: (0 | 1 | 2)[];
}

const ROWS: Row[] = [
  { es: 'Compra en el súper', en: 'Supermarket shop', cents: 6420, who: 1, cat: 'compra', month: 0, day: 4 },
  { es: 'Internet y fibra', en: 'Broadband', cents: 3990, who: 0, cat: 'facturas', month: 0, day: 6 },
  { es: 'Luz', en: 'Electricity', cents: 7815, who: 2, cat: 'facturas', month: 0, day: 12 },
  { es: 'Cena de bienvenida', en: 'Welcome dinner', cents: 8650, who: 0, cat: 'restaurante', month: 0, day: 15 },
  { es: 'Productos de limpieza', en: 'Cleaning supplies', cents: 1875, who: 2, cat: 'casa', month: 0, day: 20 },
  { es: 'Cine', en: 'Cinema', cents: 2280, who: 1, cat: 'ocio', month: 0, day: 26, for: [1, 2] },
  { es: 'Compra semanal', en: 'Weekly groceries', cents: 5290, who: 0, cat: 'compra', month: 1, day: 2 },
  { es: 'Internet y fibra', en: 'Broadband', cents: 3990, who: 0, cat: 'facturas', month: 1, day: 6 },
  { es: 'Bombillas y enchufes', en: 'Bulbs and plugs', cents: 2460, who: 1, cat: 'casa', month: 1, day: 9 },
  { es: 'Pizzas del viernes', en: 'Friday pizzas', cents: 3600, who: 2, cat: 'restaurante', month: 1, day: 11 },
];

export function buildDemo(lang: Lang): { group: Group; meId: string } {
  const names = ['Alex', 'Marta', 'Leo'];
  let g = newGroup(lang === 'es' ? 'Piso de ejemplo' : 'Sample flat', names, 'EUR', '🏠');
  const ids = g.members.map((m) => m.id) as [string, string, string];
  const now = today();
  const thisMonth = now.slice(0, 7);
  const lastMonth = addMonths(thisMonth, -1);
  const todayDay = Number(now.slice(8, 10));
  for (const r of ROWS) {
    const ym = r.month === 0 ? lastMonth : thisMonth;
    const day = r.month === 1 ? Math.min(r.day, todayDay) : r.day;
    g = addExpense(g, {
      title: r[lang],
      amount: r.cents,
      paidBy: ids[r.who],
      split: { mode: 'equal', among: (r.for ?? [0, 1, 2]).map((i) => ids[i]) },
      category: r.cat,
      date: `${ym}-${String(day).padStart(2, '0')}`,
    });
  }
  // Leo ya le devolvió una parte a Marta.
  g = addPayment(g, ids[2], ids[1], 2000, `${lastMonth}-28`);
  g = addRecurring(g, {
    title: lang === 'es' ? 'Alquiler' : 'Rent',
    amount: 120000,
    paidBy: ids[0],
    split: { mode: 'equal', among: [...ids] },
    category: 'casa',
    day: 1,
    startMonth: lastMonth,
  });
  return { group: materializeRecurring(g, now).group, meId: ids[0] };
}
