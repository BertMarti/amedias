/** Grupo de ejemplo: un piso de tres personas con dos meses de gastos, el alquiler como gasto fijo y dos plantillas. */
import { addExpense, addPayment, addRecurring, materializeRecurring, newGroup, saveTemplate, today, type Category, type Group } from '../core';
import type { Lang } from '../i18n';
import { addMonths } from './util';

interface Row {
  title: Record<Lang, string>;
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
  { title: { es: 'Compra en el súper', ca: 'Compra al súper', gl: 'Compra no súper', pt: 'Compras no supermercado', en: 'Supermarket shop' }, cents: 6420, who: 1, cat: 'compra', month: 0, day: 4 },
  { title: { es: 'Internet y fibra', ca: 'Internet i fibra', gl: 'Internet e fibra', pt: 'Internet e fibra', en: 'Broadband' }, cents: 3990, who: 0, cat: 'facturas', month: 0, day: 6 },
  { title: { es: 'Luz', ca: 'Llum', gl: 'Luz', pt: 'Luz', en: 'Electricity' }, cents: 7815, who: 2, cat: 'facturas', month: 0, day: 12 },
  { title: { es: 'Cena de bienvenida', ca: 'Sopar de benvinguda', gl: 'Cea de benvida', pt: 'Jantar de boas-vindas', en: 'Welcome dinner' }, cents: 8650, who: 0, cat: 'restaurante', month: 0, day: 15 },
  { title: { es: 'Productos de limpieza', ca: 'Productes de neteja', gl: 'Produtos de limpeza', pt: 'Produtos de limpeza', en: 'Cleaning supplies' }, cents: 1875, who: 2, cat: 'casa', month: 0, day: 20 },
  { title: { es: 'Cine', ca: 'Cinema', gl: 'Cine', pt: 'Cinema', en: 'Cinema' }, cents: 2280, who: 1, cat: 'ocio', month: 0, day: 26, for: [1, 2] },
  { title: { es: 'Compra semanal', ca: 'Compra setmanal', gl: 'Compra semanal', pt: 'Compras da semana', en: 'Weekly groceries' }, cents: 5290, who: 0, cat: 'compra', month: 1, day: 2 },
  { title: { es: 'Internet y fibra', ca: 'Internet i fibra', gl: 'Internet e fibra', pt: 'Internet e fibra', en: 'Broadband' }, cents: 3990, who: 0, cat: 'facturas', month: 1, day: 6 },
  { title: { es: 'Bombillas y enchufes', ca: 'Bombetes i endolls', gl: 'Lámpadas e enchufes', pt: 'Lâmpadas e fichas', en: 'Bulbs and plugs' }, cents: 2460, who: 1, cat: 'casa', month: 1, day: 9 },
  { title: { es: 'Pizzas del viernes', ca: 'Pizzes del divendres', gl: 'Pizzas do venres', pt: 'Pizzas de sexta-feira', en: 'Friday pizzas' }, cents: 3600, who: 2, cat: 'restaurante', month: 1, day: 11 },
];

/** Nombre del grupo, gasto fijo y plantillas. */
const TEXT: Record<Lang, { group: string; rent: string; groceries: string; gas: string }> = {
  es: { group: 'Piso de ejemplo', rent: 'Alquiler', groceries: 'Súper', gas: 'Bombona' },
  ca: { group: 'Pis d’exemple', rent: 'Lloguer', groceries: 'Súper', gas: 'Bombona' },
  gl: { group: 'Piso de exemplo', rent: 'Aluguer', groceries: 'Súper', gas: 'Bombona' },
  pt: { group: 'Casa de exemplo', rent: 'Renda', groceries: 'Supermercado', gas: 'Botija de gás' },
  en: { group: 'Sample flat', rent: 'Rent', groceries: 'Groceries', gas: 'Gas bottle' },
};

export function buildDemo(lang: Lang): { group: Group; meId: string } {
  const names = ['Alex', 'Marta', 'Leo'];
  const text = TEXT[lang];
  let g = newGroup(text.group, names, 'EUR', '🏠');
  const ids = g.members.map((m) => m.id) as [string, string, string];
  const now = today();
  const thisMonth = now.slice(0, 7);
  const lastMonth = addMonths(thisMonth, -1);
  const todayDay = Number(now.slice(8, 10));
  for (const r of ROWS) {
    const ym = r.month === 0 ? lastMonth : thisMonth;
    const day = r.month === 1 ? Math.min(r.day, todayDay) : r.day;
    g = addExpense(g, {
      title: r.title[lang],
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
    title: text.rent,
    amount: 120000,
    paidBy: ids[0],
    split: { mode: 'equal', among: [...ids] },
    category: 'casa',
    day: 1,
    startMonth: lastMonth,
  });
  // Plantillas: el súper (el importe cambia cada vez) y la bombona (siempre lo mismo).
  const all = { mode: 'equal' as const, among: [...ids] };
  g = saveTemplate(g, { title: text.groceries, paidBy: ids[0], split: all, category: 'compra' });
  g = saveTemplate(g, { title: text.gas, amount: 2200, paidBy: ids[0], split: all, category: 'casa' });
  return { group: materializeRecurring(g, now).group, meId: ids[0] };
}
