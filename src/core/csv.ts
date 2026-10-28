/**
 * CSV: exportar un grupo (para Excel o LibreOffice) e importar la exportación de Splitwise.
 *
 * Seguridad: las celdas de texto que empiezan por = + - @ o un tabulador se neutralizan con un apóstrofo
 * (inyección de fórmulas: un concepto como «=HYPERLINK(...)» no se ejecutará al abrir el archivo).
 */
import { formatRate } from './fx';
import { decimals } from './money';
import { cleanText, revalidate } from './validate';
import { shareOf } from './split';
import { CURRENCIES, LIMITS, type Category, type Currency, type Expense, type Group, type Id, type Member } from './types';

const PELIGROSO = /^[=+\-@\t\r]/;

function cell(value: string, sep: string): string {
  const safe = PELIGROSO.test(value) ? `'${value}` : value;
  return /["\n\r]/.test(safe) || safe.includes(sep) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Exporta los gastos vivos. En español usa «;» y coma decimal (lo que espera Excel en España).
 *
 * Si algún gasto se pagó en otra moneda, después del importe van tres columnas más: la moneda, el importe en esa
 * moneda y el cambio tal como se escribió («1 EUR = 161,5 JPY»). Los grupos de una sola moneda salen como antes.
 */
export function exportCsv(group: Group, locale: 'es' | 'en' = 'es'): string {
  const sep = locale === 'es' ? ';' : ',';
  const num = (c: number, currency: Currency = group.currency) => {
    const d = decimals(currency);
    const s = (c / 10 ** d).toFixed(d);
    return locale === 'es' ? s.replace('.', ',') : s;
  };
  const people = group.members.filter((m) => !m.deleted);
  const name = new Map(group.members.map((m) => [m.id, m.name]));
  const live = group.expenses.filter((e) => !e.deleted);
  const fx = live.some((e) => e.original);
  const fxHead = !fx ? [] : locale === 'es' ? ['Moneda original', 'Importe original', 'Cambio'] : ['Original currency', 'Original amount', 'Exchange rate'];
  const head =
    locale === 'es'
      ? ['Fecha', 'Concepto', 'Categoría', 'Tipo', `Importe (${group.currency})`, ...fxHead, 'Pagó', ...people.map((p) => `Parte de ${p.name}`)]
      : ['Date', 'Description', 'Category', 'Type', `Amount (${group.currency})`, ...fxHead, 'Paid by', ...people.map((p) => `${p.name}'s share`)];
  const rows = live
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map((e) => {
      const shares = shareOf(e.amount, e.split);
      const tipo = e.kind === 'transfer' ? (locale === 'es' ? 'Pago' : 'Payment') : locale === 'es' ? 'Gasto' : 'Expense';
      const o = e.original;
      const fxCells = !fx ? [] : o ? [o.currency, num(o.amount, o.currency), formatRate(o, group.currency, locale === 'es' ? 'es-ES' : 'en-GB')] : ['', '', ''];
      return [e.date, e.title, e.category, tipo, num(e.amount), ...fxCells, name.get(e.paidBy) ?? '?', ...people.map((p) => num(shares[p.id] ?? 0))];
    });
  // BOM para que Excel detecte UTF-8 (tildes y eñes).
  return '\ufeff' + [head, ...rows].map((r) => r.map((c) => cell(String(c), sep)).join(sep)).join('\r\n') + '\r\n';
}

/** Analiza CSV (RFC 4180, con comillas y saltos de línea dentro de comillas). */
export function parseCsv(text: string, sep = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\ufeff/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const CATEGORIAS_SPLITWISE: [RegExp, Category][] = [
  [/grocer|food and drink|liquor/i, 'compra'],
  [/rent|mortgage|household|furniture|maintenance|cleaning|home/i, 'casa'],
  [/electric|gas|water|heat|tv|phone|internet|utilit|trash/i, 'facturas'],
  [/dining|restaurant/i, 'restaurante'],
  [/entertain|games|movies|music|sports/i, 'ocio'],
  [/car|bus|train|taxi|parking|fuel|bicycle|transport/i, 'transporte'],
  [/hotel|plane|flight|travel/i, 'viaje'],
  [/medical|health/i, 'salud'],
  [/gift/i, 'regalos'],
];

export interface SplitwiseImport {
  group: Group;
  skipped: number;
}

/**
 * Importa la exportación CSV de un grupo de Splitwise («Fecha, Descripción, Categoría, Coste, Moneda,
 * Persona1, Persona2…», donde cada columna de persona es su efecto neto en ese gasto). Conserva los saldos
 * exactos: un gasto con un solo pagador se importa como gasto con reparto exacto; uno con varios pagadores,
 * como varios gastos de una persona a otra; los «Payment», como pagos.
 */
export function importSplitwise(text: string, newId: () => Id = () => crypto.randomUUID(), now = Date.now()): SplitwiseImport {
  if (text.length > 5 * 1024 * 1024) throw new Error('El archivo es demasiado grande');
  const rows = parseCsv(text);
  const head = rows[0];
  if (!head || head.length < 6 || !/date|fecha/i.test(head[0]!) || !/cost|coste/i.test(head[3] ?? '')) {
    throw new Error('No parece una exportación CSV de Splitwise');
  }
  const names = head.slice(5).map((n) => cleanText(n, LIMITS.name)).filter(Boolean);
  if (names.length === 0 || names.length > LIMITS.members) throw new Error('Número de personas no válido');
  const members: Member[] = names.map((name) => ({ id: newId(), name, updatedAt: now }));
  const firstCurrency = rows[1]?.[4]?.trim().toUpperCase();
  const currency: Currency = (CURRENCIES as readonly string[]).includes(firstCurrency ?? '') ? (firstCurrency as Currency) : 'EUR';
  const scale = 10 ** decimals(currency);
  const cents = (s: string): number | null => {
    const t = s.trim();
    if (!/^-?\d{1,12}([.,]\d{1,4})?$/.test(t)) return null;
    return Math.round(Number(t.replace(',', '.')) * scale);
  };
  const expenses: Expense[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const date = r[0]?.trim() ?? '';
    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) {
      skipped += r[1] && !/total balance|saldo total/i.test(r[1]) ? 1 : 0;
      continue;
    }
    const cost = cents(r[3] ?? '');
    const nets = names.map((_, i) => cents(r[5 + i] ?? '0') ?? NaN);
    // Solo se usa la moneda de la primera fila: una fila en otra moneda descuadraría los saldos.
    const sameCurrency = (r[4]?.trim().toUpperCase() ?? '') === (firstCurrency ?? '');
    const netOk = nets.every((n) => Number.isFinite(n) && Math.abs(n) <= LIMITS.amount);
    if (cost === null || cost <= 0 || cost > LIMITS.amount || !sameCurrency || !netOk || nets.reduce((s, n) => s + n, 0) !== 0) {
      skipped++;
      continue;
    }
    if (expenses.length >= LIMITS.expenses) break;
    const title = cleanText(r[1] ?? '') || 'Gasto';
    const isPayment = /^payment$/i.test(r[2]?.trim() ?? '');
    const category: Category = CATEGORIAS_SPLITWISE.find(([re]) => re.test(r[2] ?? ''))?.[1] ?? 'otros';
    const base = { title, category, date, createdAt: now, updatedAt: now };
    const payers = nets.map((n, i) => ({ i, n })).filter((x) => x.n > 0);
    if (isPayment || payers.length !== 1) {
      // Pagos y gastos con varios pagadores: pares deudor → acreedor que dejan los mismos saldos.
      const cred = payers.map((x) => ({ ...x }));
      const debt = nets.map((n, i) => ({ i, n: -n })).filter((x) => x.n > 0);
      for (const d of debt) {
        for (const c of cred) {
          const amt = Math.min(d.n, c.n);
          if (amt <= 0) continue;
          expenses.push({
            ...base,
            id: newId(),
            kind: isPayment ? 'transfer' : 'expense',
            amount: amt,
            paidBy: members[c.i]!.id,
            split: { mode: 'exact', amounts: { [members[d.i]!.id]: amt } },
          });
          d.n -= amt;
          c.n -= amt;
        }
      }
      continue;
    }
    // Un pagador: su parte = coste − su neto; la de los demás = −su neto.
    const p = payers[0]!.i;
    const amounts: Record<Id, number> = {};
    nets.forEach((n, i) => {
      const share = i === p ? cost - n : -n;
      if (share > 0) amounts[members[i]!.id] = share;
    });
    expenses.push({ ...base, id: newId(), kind: 'expense', amount: cost, paidBy: members[p]!.id, split: { mode: 'exact', amounts } });
  }
  // Última red: lo importado pasa la misma validación que cualquier grupo (límites incluidos).
  const group = revalidate({
    v: 1,
    id: newId(),
    name: 'Importado de Splitwise',
    emoji: '📥',
    currency,
    members,
    expenses,
    recurring: [],
    templates: [],
    createdAt: now,
    updatedAt: now,
  });
  return { group, skipped };
}
