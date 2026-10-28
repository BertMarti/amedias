import { describe, expect, it } from 'vitest';
import {
  addExpense,
  addMember,
  addPayment,
  addRecurring,
  balances,
  byCategory,
  byMonth,
  decodeGroup,
  deleteExpense,
  encodeGroup,
  exportCsv,
  formatMoney,
  importSplitwise,
  incomingProblem,
  loadGroups,
  materializeRecurring,
  mergeGroups,
  mergePreview,
  newGroup,
  parseAmount,
  parseCsv,
  parseGroup,
  payloadFromHash,
  clearLegacyStorage,
  migrateLegacyStorage,
  supportsLinks,
  readBackup,
  recurringExpenseId,
  renameGroup,
  revalidate,
  saveGroups,
  settle,
  shareOf,
  ShareError,
  splitProblem,
  updateExpense,
  updateMember,
  updateRecurring,
  cleanText,
  deleteTemplate,
  latestEdit,
  liveTemplates,
  repeatInput,
  saveTemplate,
  LIMITS,
  baseAmount,
  convert,
  foreignAmount,
  formatRate,
  hasForeign,
  invertRate,
  lastRate,
  parseRate,
  rateToInput,
  RATE_MAX,
  RATE_MIN,
  type Group,
  type Original,
} from '../src/core';

const T0 = Date.UTC(2026, 9, 1);

function piso(): Group {
  return newGroup('Piso Lavapiés', ['Ana', 'Luis', 'Marta'], 'EUR', '🏠', T0);
}
const ids = (g: Group) => g.members.map((m) => m.id) as [string, string, string];
const suma = (r: Record<string, number>) => Object.values(r).reduce((s, v) => s + v, 0);

describe('dinero', () => {
  it.each([
    ['12', 1200], ['12,5', 1250], ['12.50', 1250], ['1.234,56', 123456], ['1,234.56', 123456],
    ['€ 7', 700], ['0,01', 1], ['1.234', 123400], ['1 000', 100000],
  ])('lee «%s» como %i céntimos', (txt, cents) => {
    expect(parseAmount(txt)).toBe(cents);
  });

  it.each(['', '0', '-5', 'abc', '12,', '12.3456', '1e5', '99999999999', 'NaN', '12..5'])('rechaza «%s»', (txt) => {
    expect(parseAmount(txt)).toBeNull();
  });

  it('monedas sin decimales', () => {
    expect(parseAmount('1.000', 'JPY')).toBe(1000);
    expect(parseAmount('12,5', 'JPY')).toBeNull();
    expect(formatMoney(1500, 'JPY', 'en-US')).toBe('¥1,500');
  });

  it('formatea en español', () => {
    expect(formatMoney(123456, 'EUR')).toMatch(/1\.?234,56\s€/);
  });
});

describe('repartos', () => {
  it('a partes iguales cuadra al céntimo y es determinista', () => {
    const [a, b, c] = ['a', 'b', 'c'].map((x) => x.repeat(8) + '-0000-4000-8000-000000000000');
    const r = shareOf(1000, { mode: 'equal', among: [c!, a!, b!] });
    expect(suma(r)).toBe(1000);
    expect(Object.values(r).sort()).toEqual([333, 333, 334]);
    expect(shareOf(1000, { mode: 'equal', among: [a!, b!, c!] })).toEqual(r);
  });

  it('por partes, porcentajes y exactos', () => {
    expect(shareOf(900, { mode: 'shares', shares: { x: 2, y: 1 } })).toEqual({ x: 600, y: 300 });
    expect(shareOf(1001, { mode: 'percent', basisPoints: { x: 5000, y: 5000 } })).toEqual({ x: 501, y: 500 });
    expect(shareOf(1000, { mode: 'exact', amounts: { x: 700, y: 300 } })).toEqual({ x: 700, y: 300 });
    expect(shareOf(1000, { mode: 'exact', amounts: { x: 700, y: 200 } })).toEqual({}); // no suma: inválido
  });

  it('para cualquier importe y número de personas, suma exactamente el total', () => {
    for (let n = 1; n <= 7; n++) {
      for (const amount of [1, 7, 99, 100, 101, 12345, 999_999_999]) {
        const among = Array.from({ length: n }, (_, i) => `${i}`);
        expect(suma(shareOf(amount, { mode: 'equal', among }))).toBe(amount);
      }
    }
  });

  it('detecta repartos no válidos', () => {
    const g = piso();
    const [a, b] = ids(g);
    const m = new Set(ids(g));
    expect(splitProblem(1000, { mode: 'equal', among: [] }, m)).toBe('pick');
    expect(splitProblem(1000, { mode: 'equal', among: ['intruso'] }, m)).toBe('unknown');
    expect(splitProblem(1000, { mode: 'exact', amounts: { [a]: 600, [b]: 300 } }, m)).toBe('sum');
    expect(splitProblem(1000, { mode: 'percent', basisPoints: { [a]: 5000, [b]: 4000 } }, m)).toBe('percentSum');
    expect(splitProblem(1000, { mode: 'shares', shares: { [a]: 1.5 } }, m)).toBe('shares');
    expect(splitProblem(1000, { mode: 'equal', among: [a, b] }, m)).toBeNull();
  });
});

describe('saldos y cómo quedar a cero', () => {
  it('saldos que suman cero y transferencias mínimas', () => {
    let g = piso();
    const [ana, luis, marta] = ids(g);
    g = addExpense(g, { title: 'Compra', amount: 9000, paidBy: ana, split: { mode: 'equal', among: [ana, luis, marta] }, category: 'compra', date: '2026-10-02' }, T0);
    g = addExpense(g, { title: 'Luz', amount: 6000, paidBy: luis, split: { mode: 'equal', among: [ana, luis, marta] }, category: 'facturas', date: '2026-10-03' }, T0);
    const bal = balances(g);
    expect(bal).toEqual({ [ana]: 4000, [luis]: 1000, [marta]: -5000 });
    expect(suma(bal)).toBe(0);
    const t = settle(bal);
    expect(t).toEqual([
      { from: marta, to: ana, amount: 4000 },
      { from: marta, to: luis, amount: 1000 },
    ]);
    // Registrar los pagos deja todo a cero
    for (const x of t) g = addPayment(g, x.from, x.to, x.amount, '2026-10-04', T0);
    expect(Object.values(balances(g)).every((v) => v === 0)).toBe(true);
  });

  it('como mucho n-1 transferencias y siempre cuadran', () => {
    const bal = { a: 500, b: -200, c: -300, d: 1000, e: -1000 };
    const t = settle(bal);
    expect(t.length).toBeLessThanOrEqual(4);
    const after = { ...bal } as Record<string, number>;
    for (const x of t) {
      after[x.from]! += x.amount;
      after[x.to]! -= x.amount;
    }
    expect(Object.values(after).every((v) => v === 0)).toBe(true);
  });

  it('los gastos borrados no cuentan y editar actualiza', () => {
    let g = piso();
    const [ana, luis] = ids(g);
    g = addExpense(g, { title: 'Cena', amount: 3000, paidBy: ana, split: { mode: 'equal', among: [ana, luis] }, category: 'restaurante', date: '2026-10-05' }, T0);
    const id = g.expenses[0]!.id;
    g = updateExpense(g, id, { title: 'Cena', amount: 5000, paidBy: ana, split: { mode: 'equal', among: [ana, luis] }, category: 'restaurante', date: '2026-10-05' }, T0 + 1);
    expect(balances(g)[luis]).toBe(-2500);
    g = deleteExpense(g, id, T0 + 2);
    expect(balances(g)[luis]).toBe(0);
  });
});

describe('fusión sin servidor', () => {
  function dosMoviles() {
    const base = piso();
    const [ana, luis, marta] = ids(base);
    const todos = { mode: 'equal' as const, among: [ana, luis, marta] };
    const movilAna = addExpense(base, { title: 'Pan', amount: 300, paidBy: ana, split: todos, category: 'compra', date: '2026-10-06' }, T0 + 10);
    const movilLuis = addExpense(base, { title: 'Gas', amount: 4500, paidBy: luis, split: todos, category: 'facturas', date: '2026-10-06' }, T0 + 20);
    return { base, movilAna, movilLuis, ana, luis, marta };
  }

  it('une los gastos de los dos móviles', () => {
    const { movilAna, movilLuis } = dosMoviles();
    const m = mergeGroups(movilAna, movilLuis);
    expect(m.expenses.map((e) => e.title).sort()).toEqual(['Gas', 'Pan']);
  });

  it('conmutativa, asociativa e idempotente', () => {
    const { movilAna, movilLuis, base } = dosMoviles();
    const tercero = addMember(base, 'Pablo', T0 + 30);
    const ab = mergeGroups(movilAna, movilLuis);
    expect(mergeGroups(movilLuis, movilAna)).toEqual(ab);
    expect(mergeGroups(ab, ab)).toEqual(ab);
    expect(mergeGroups(mergeGroups(movilAna, movilLuis), tercero)).toEqual(mergeGroups(movilAna, mergeGroups(movilLuis, tercero)));
  });

  it('gana la edición más reciente y los borrados viajan', () => {
    const { movilAna, ana, luis } = dosMoviles();
    const id = movilAna.expenses[0]!.id;
    const editado = updateExpense(movilAna, id, { title: 'Pan y leche', amount: 450, paidBy: ana, split: { mode: 'equal', among: [ana, luis] }, category: 'compra', date: '2026-10-06' }, T0 + 50);
    const borrado = deleteExpense(movilAna, id, T0 + 60);
    expect(mergeGroups(editado, movilAna).expenses[0]!.title).toBe('Pan y leche');
    expect(mergeGroups(editado, borrado).expenses[0]!.deleted).toBe(true);
    expect(mergePreview(movilAna, editado)).toMatchObject({ upToDate: false, newExpenses: 0, changed: 1, removed: 0, newMembers: 0 });
    expect(mergePreview(editado, borrado)).toMatchObject({ removed: 1, changed: 0 });
    expect(mergePreview(borrado, editado).upToDate).toBe(true);
  });

  it('no mezcla grupos distintos', () => {
    expect(() => mergeGroups(piso(), piso())).toThrow();
  });
});

describe('gastos fijos', () => {
  it('genera un gasto por mes sin duplicar, también al fusionar', () => {
    let g = piso();
    const [ana, luis, marta] = ids(g);
    g = addRecurring(g, { title: 'Alquiler', amount: 120000, paidBy: ana, split: { mode: 'equal', among: [ana, luis, marta] }, category: 'casa', day: 1, startMonth: '2026-08' }, T0);
    const r1 = materializeRecurring(g, '2026-10-15', T0);
    expect(r1.added).toBe(3); // agosto, septiembre, octubre
    expect(materializeRecurring(r1.group, '2026-10-20', T0).added).toBe(0);
    // Otro móvil lo genera por su cuenta: mismos ids → al fusionar quedan 3, no 6
    const otro = materializeRecurring(g, '2026-10-16', T0 + 999).group;
    expect(mergeGroups(r1.group, otro).expenses).toHaveLength(3);
  });

  it('respeta el día del mes y la fecha de fin', () => {
    let g = piso();
    const [ana] = ids(g);
    g = addRecurring(g, { title: 'Netflix', amount: 1399, paidBy: ana, split: { mode: 'equal', among: [ana] }, category: 'ocio', day: 20, startMonth: '2026-09', endMonth: '2026-09' }, T0);
    expect(materializeRecurring(g, '2026-10-25', T0).added).toBe(1);
    expect(materializeRecurring(g, '2026-09-19', T0).added).toBe(0);
  });

  it('un gasto fijo borrado no genera nada', () => {
    let g = piso();
    const [ana] = ids(g);
    g = addRecurring(g, { title: 'Gym', amount: 3000, paidBy: ana, split: { mode: 'equal', among: [ana] }, category: 'salud', day: 1, startMonth: '2026-01' }, T0);
    g = { ...g, recurring: g.recurring.map((r) => ({ ...r, deleted: true })) };
    expect(materializeRecurring(g, '2026-10-01', T0).added).toBe(0);
  });
});

describe('validación de datos que llegan de fuera', () => {
  const valido = () => {
    let g = piso();
    const [ana, luis] = ids(g);
    g = addExpense(g, { title: 'Cena', amount: 3000, paidBy: ana, split: { mode: 'equal', among: [ana, luis] }, category: 'restaurante', date: '2026-10-05' }, T0);
    return JSON.parse(JSON.stringify(g)) as Group;
  };

  it('acepta un grupo válido y descarta campos desconocidos', () => {
    const g = valido() as Group & { extra?: string };
    g.extra = 'x';
    expect(parseGroup(g)).not.toHaveProperty('extra');
  });

  it.each([
    ['versión desconocida', (g: Group) => ({ ...g, v: 2 })],
    ['importe negativo', (g: Group) => { g.expenses[0]!.amount = -5; return g; }],
    ['importe enorme', (g: Group) => { g.expenses[0]!.amount = 1e15; return g; }],
    ['importe decimal', (g: Group) => { g.expenses[0]!.amount = 10.5; return g; }],
    ['pagador inexistente', (g: Group) => { g.expenses[0]!.paidBy = '00000000-0000-4000-8000-000000000000'; return g; }],
    ['id con __proto__', (g: Group) => { g.members[0]!.id = '__proto__'; return g; }],
    ['categoría inventada', (g: Group) => { (g.expenses[0] as { category: string }).category = 'hack'; return g; }],
    ['fecha imposible', (g: Group) => { g.expenses[0]!.date = '2026-13-45'; return g; }],
    ['personas repetidas', (g: Group) => { g.members.push({ ...g.members[0]! }); return g; }],
    ['moneda rara', (g: Group) => ({ ...g, currency: 'XXX' })],
    ['demasiadas personas', (g: Group) => ({ ...g, members: Array.from({ length: 51 }, () => g.members[0]) })],
  ])('rechaza: %s', (_n, mutar) => {
    expect(() => parseGroup((mutar as (g: Group) => unknown)(valido()))).toThrow(/no válidos/);
  });

  it('limpia controles, marcas bidireccionales y textos largos', () => {
    const g = valido();
    g.expenses[0]!.title = 'Cena\u202e\u0000 <b>x</b>' + 'y'.repeat(500);
    g.emoji = '<img src=x>';
    const p = parseGroup(g);
    expect(p.expenses[0]!.title.includes('\u202e') || p.expenses[0]!.title.includes('\u0000')).toBe(false);
    expect(p.expenses[0]!.title.length).toBeLessThanOrEqual(120);
    expect(p.emoji).toBe('💸');
  });

  it('un JSON con __proto__ no contamina objetos', () => {
    const malicioso = JSON.parse('{"v":1,"__proto__":{"pwned":true},"id":"x"}');
    expect(() => parseGroup(malicioso)).toThrow();
    expect(({} as { pwned?: boolean }).pwned).toBeUndefined();
  });
});

describe('enlaces para compartir', () => {
  const grupo = () => {
    let g = piso();
    const [ana, luis, marta] = ids(g);
    for (let i = 0; i < 40; i++) {
      g = addExpense(g, { title: `Compra ${i}`, amount: 1000 + i, paidBy: ana, split: { mode: 'equal', among: [ana, luis, marta] }, category: 'compra', date: '2026-10-06' }, T0 + i);
    }
    return g;
  };

  it('ida y vuelta sin contraseña', async () => {
    const g = grupo();
    const payload = await encodeGroup(g);
    expect(payload.startsWith('1.')).toBe(true);
    expect(await decodeGroup(payload)).toEqual(parseGroup(JSON.parse(JSON.stringify(g))));
    expect(payloadFromHash(`#g=${payload}`)).toBe(payload);
  });

  it('con contraseña: sin ella o con otra no se abre', async () => {
    const g = grupo();
    const payload = await encodeGroup(g, 'piso-2026');
    expect(payload.startsWith('1e.')).toBe(true);
    expect(payload).not.toContain('Compra');
    await expect(decodeGroup(payload)).rejects.toMatchObject({ code: 'passphrase_required' });
    await expect(decodeGroup(payload, 'otra')).rejects.toMatchObject({ code: 'wrong_passphrase' });
    expect((await decodeGroup(payload, 'piso-2026')).expenses).toHaveLength(40);
  });

  it('rechaza enlaces dañados, ajenos o manipulados', async () => {
    await expect(decodeGroup('2.abc')).rejects.toBeInstanceOf(ShareError);
    await expect(decodeGroup('1.%%%')).rejects.toMatchObject({ code: 'format' });
    await expect(decodeGroup('1.AAAA')).rejects.toMatchObject({ code: 'format' });
    const malo = await encodeGroup({ ...grupo(), currency: 'XXX' } as unknown as Group);
    await expect(decodeGroup(malo)).rejects.toMatchObject({ code: 'invalid' });
    expect(payloadFromHash('#g=1.abc<script>')).toBeNull();
  });

  it('frena las bombas de descompresión', async () => {
    // 20 MB de ceros comprimen a muy poco; al abrirlo debe pararse en el tope.
    const reader = new Blob([new Uint8Array(20 * 1024 * 1024)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const bomba = new Uint8Array(await new Response(reader).arrayBuffer());
    const { b64url } = await import('../src/core/share');
    await expect(decodeGroup(`1.${b64url(bomba)}`)).rejects.toMatchObject({ code: 'too_large' });
  });
});

describe('CSV', () => {
  it('exporta con separador español y neutraliza fórmulas', () => {
    let g = piso();
    const [ana, luis] = ids(g);
    g = addExpense(g, { title: '=HYPERLINK("http://malo")', amount: 1050, paidBy: ana, split: { mode: 'equal', among: [ana, luis] }, category: 'otros', date: '2026-10-07' }, T0);
    const csv = exportCsv(g);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""http://malo"")"`);
    expect(csv).toContain(';10,50;Ana;5,25;5,25;0,00');
    const filas = parseCsv(csv, ';');
    expect(filas).toHaveLength(2);
  });

  it('importa una exportación de Splitwise conservando los saldos', () => {
    const csv = [
      'Date,Description,Category,Cost,Currency,Ana,Luis,Marta',
      '2026-09-01,Alquiler,Rent,900.00,EUR,600.00,-300.00,-300.00',
      '2026-09-02,Cena,Dining out,60.00,EUR,-20.00,40.00,-20.00',
      '2026-09-03,Regalo (dos pagan),Gifts,30.00,EUR,10.00,10.00,-20.00',
      '2026-09-04,Payment,Payment,100.00,EUR,0.00,100.00,-100.00',
      ',Total balance,,,EUR,590.00,-150.00,-440.00',
    ].join('\n');
    const { group, skipped } = importSplitwise(csv, (() => { let i = 0; return () => `00000000-0000-4000-8000-${String(i++).padStart(12, '0')}`; })(), T0);
    expect(skipped).toBe(0);
    expect(group.members.map((m) => m.name)).toEqual(['Ana', 'Luis', 'Marta']);
    const byName = Object.fromEntries(group.members.map((m) => [m.name, balances(group)[m.id]]));
    expect(byName).toEqual({ Ana: 59000, Luis: -15000, Marta: -44000 });
    expect(group.expenses.find((e) => e.title === 'Payment')!.kind).toBe('transfer');
    expect(group.expenses.find((e) => e.title === 'Alquiler')!.category).toBe('casa');
    expect(() => parseGroup(JSON.parse(JSON.stringify(group)))).not.toThrow();
  });

  it('rechaza lo que no es de Splitwise', () => {
    expect(() => importSplitwise('hola,adios\n1,2')).toThrow(/Splitwise/);
  });
});

describe('estadísticas', () => {
  it('por categoría y por mes, sin contar pagos', () => {
    let g = piso();
    const [ana, luis] = ids(g);
    g = addExpense(g, { title: 'Super', amount: 5000, paidBy: ana, split: { mode: 'equal', among: [ana, luis] }, category: 'compra', date: '2026-09-10' }, T0);
    g = addExpense(g, { title: 'Bar', amount: 2000, paidBy: luis, split: { mode: 'equal', among: [ana, luis] }, category: 'restaurante', date: '2026-10-10' }, T0);
    g = addPayment(g, luis, ana, 1500, '2026-10-11', T0);
    expect(byCategory(g).compra).toBe(5000);
    expect(byCategory(g, '2026-10').compra).toBe(0);
    expect(byMonth(g, '2026-10', 3)).toEqual([
      { month: '2026-08', total: 0 },
      { month: '2026-09', total: 5000 },
      { month: '2026-10', total: 2000 },
    ]);
  });
});

describe('almacenamiento local', () => {
  it('guarda, carga y aparta lo dañado', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) } as Storage;
    const g = piso();
    saveGroups([g], storage);
    mem.set('repartito:v1:grupos', JSON.stringify([g, { v: 1, roto: true }]));
    const r = loadGroups(storage);
    expect(r.groups).toHaveLength(1);
    expect(r.damaged).toBe(1);
  });

  it('copias de seguridad validadas', () => {
    const g = piso();
    expect(readBackup(JSON.stringify({ app: 'amedias', groups: [g] }))).toHaveLength(1);
    expect(() => readBackup(JSON.stringify({ groups: [{ v: 1 }] }))).toThrow();
  });
});

describe('auditoría de seguridad (regresiones)', () => {
  const DAY = 24 * 3600 * 1000;
  const conGasto = () => {
    const g = piso();
    const [ana, luis] = ids(g);
    return addExpense(g, { title: 'Cena', amount: 3000, paidBy: ana, split: { mode: 'equal', among: [ana, luis] }, category: 'restaurante', date: '2026-10-05' }, T0 + 1);
  };
  const clon = (g: Group) => JSON.parse(JSON.stringify(g)) as Group;

  it('F1: no se acepta una fusión que superaría los límites (si no, el grupo se perdería al reabrir)', () => {
    const local = conGasto();
    const otro = clon(local);
    for (let i = 0; i < 47; i++) otro.members.push({ id: crypto.randomUUID(), name: `P${i}`, updatedAt: T0 + 2 });
    expect(() => parseGroup(clon(otro))).not.toThrow(); // 50 personas: por sí solo es válido, pero…
    const local2 = clon(local);
    for (let i = 0; i < 2; i++) local2.members.push({ id: crypto.randomUUID(), name: `L${i}`, updatedAt: T0 + 2 });
    expect(incomingProblem(local2, otro, T0)).toBe('limits'); // …juntas pasarían de 50
    expect(incomingProblem(local, clon(local), T0)).toBeNull();
  });

  it('F2: la vista previa enseña cambios de nombre, moneda, personas y gastos fijos', () => {
    let g = conGasto();
    const [ana, luis, marta] = ids(g);
    g = addRecurring(g, { title: 'Luz', amount: 6000, paidBy: ana, split: { mode: 'equal', among: [ana, luis, marta] }, category: 'facturas', day: 5, startMonth: '2026-10' }, T0 + 2);
    let b = renameGroup(g, { name: 'Casa nueva', currency: 'USD' }, T0 + 10);
    b = updateMember(b, luis, { name: 'Luisito' }, T0 + 10);
    b = updateMember(b, marta, { deleted: true }, T0 + 10);
    b = updateRecurring(b, b.recurring[0]!.id, { amount: 6500 }, T0 + 10);
    expect(mergePreview(g, b)).toMatchObject({ upToDate: false, header: true, currency: true, renamedMembers: 1, removedMembers: 1, recurring: 1, newExpenses: 0, changed: 0 });
    expect(mergePreview(g, clon(g)).upToDate).toBe(true);
  });

  it('F3: no se acepta cambiar a una moneda con otros decimales si hay gastos', () => {
    const local = conGasto();
    const jpy = { ...clon(local), currency: 'JPY' as const, updatedAt: local.updatedAt + 1000 };
    expect(incomingProblem(local, jpy, T0)).toBe('currency');
    const usd = { ...clon(local), currency: 'USD' as const, updatedAt: local.updatedAt + 1000 };
    expect(incomingProblem(local, usd, T0)).toBeNull();
  });

  it('F4: una edición propia gana aunque la versión anterior viniera del futuro, y lo futuro se rechaza', () => {
    const local = conGasto();
    const id = local.expenses[0]!.id;
    const trampa = clon(local);
    trampa.expenses[0] = { ...trampa.expenses[0]!, amount: 500000, updatedAt: T0 + 700 * DAY };
    expect(incomingProblem(local, trampa, T0)).toBe('future');
    // Aunque llegara (p. ej. por un reloj mal puesto), corregirlo después gana.
    const tengo = mergeGroups(local, trampa);
    const e = tengo.expenses[0]!;
    const corregido = updateExpense(tengo, id, { title: e.title, amount: 3000, paidBy: e.paidBy, split: e.split, category: e.category, date: e.date }, T0 + 5);
    expect(mergeGroups(corregido, trampa).expenses[0]!.amount).toBe(3000);
    expect(incomingProblem(local, { ...clon(local), updatedAt: T0 + DAY / 2 }, T0)).toBeNull();
  });

  it('F5: no se aceptan gastos de un gasto fijo inexistente ni de meses futuros', () => {
    let g = conGasto();
    const [ana, luis] = ids(g);
    g = addRecurring(g, { title: 'Alquiler', amount: 90000, paidBy: ana, split: { mode: 'equal', among: [ana, luis] }, category: 'casa', day: 1, startMonth: '2026-01' }, T0);
    const r = g.recurring[0]!;
    const tumba = (ym: string, rid = r.id) => ({ ...g.expenses[0]!, id: `${rid}~${ym}`, recurringId: rid, deleted: true });
    expect(() => parseGroup({ ...clon(g), expenses: [...g.expenses, tumba('2099-01')] })).toThrow(/no válidos/);
    expect(() => parseGroup({ ...clon(g), expenses: [...g.expenses, tumba('2026-01', crypto.randomUUID())] })).toThrow(/no válidos/);
    expect(() => parseGroup({ ...clon(g), expenses: [...g.expenses, tumba('2026-01')] })).not.toThrow();
    expect(recurringExpenseId(r, '2026-01')).toBe(`${r.id}~2026-01`);
  });

  it('F6: Splitwise salta filas desorbitadas, fechas imposibles y otras monedas', () => {
    const csv = [
      'Date,Description,Category,Cost,Currency,Ana,Luis',
      '2026-09-01,Bien,Rent,10.00,EUR,5.00,-5.00',
      '2026-09-02,Enorme,Rent,10.00,EUR,99999999999.00,-99999999999.00',
      '2026-13-45,Fecha imposible,Rent,10.00,EUR,5.00,-5.00',
      '2026-09-03,Otra moneda,Rent,10.00,USD,5.00,-5.00',
    ].join('\n');
    const { group, skipped } = importSplitwise(csv, () => crypto.randomUUID(), T0);
    expect(group.expenses.map((e) => e.title)).toEqual(['Bien']);
    expect(skipped).toBe(3);
  });

  it('F13: el icono tiene que empezar por un emoji y los textos pierden caracteres invisibles', () => {
    expect(parseGroup({ ...clon(conGasto()), emoji: '1234567890' }).emoji).toBe('💸');
    expect(parseGroup({ ...clon(conGasto()), emoji: '🇪🇸' }).emoji).toBe('🇪🇸');
    expect(parseGroup({ ...clon(conGasto()), emoji: '👩‍👩‍👧' }).emoji).toBe('👩‍👩‍👧');
    expect(cleanText('Ana\u{E0041}\u{E0042}')).toBe('Ana');
  });

  it('F14: se rechazan repartos que no cuadran con el importe', () => {
    const g = clon(conGasto());
    const [ana, luis] = ids(g);
    g.expenses[0]!.split = { mode: 'percent', basisPoints: { [ana]: 2500, [luis]: 2500 } };
    expect(() => parseGroup(g)).toThrow(/no válidos/);
    g.expenses[0]!.split = { mode: 'exact', amounts: { [ana]: 1 } };
    expect(() => parseGroup(g)).toThrow(/no válidos/);
  });

  it('F15: dos móviles con versiones distintas de un gasto fijo: gana la más reciente', () => {
    let g = conGasto();
    const [ana, luis] = ids(g);
    g = addRecurring(g, { title: 'Luz', amount: 1000, paidBy: ana, split: { mode: 'equal', among: [ana, luis] }, category: 'facturas', day: 1, startMonth: '2026-10' }, T0 + 5);
    const nueva = updateRecurring(g, g.recurring[0]!.id, { amount: 999 }, T0 + 9);
    const conVieja = updateRecurring(g, g.recurring[0]!.id, { amount: 1000 }, T0 + 50);
    const a = materializeRecurring(nueva, '2026-10-20', T0).group;
    const b = materializeRecurring(conVieja, '2026-10-20', T0).group;
    const mes = (x: Group) => x.expenses.find((e) => e.recurringId)!.amount;
    expect(mes(mergeGroups(a, b))).toBe(1000);
    expect(mes(mergeGroups(b, a))).toBe(1000);
  });

  it('revalidate devuelve un grupo idéntico cuando es válido', () => {
    const g = conGasto();
    expect(revalidate(g)).toEqual(parseGroup(clon(g)));
  });
});

describe('cambio de nombre a Repartito', () => {
  it('migra los datos guardados con el nombre antiguo sin pisar los nuevos', () => {
    const mem = new Map<string, string>([
      ['amedias:v1:grupos', '[1]'],
      ['amedias:v1:ajustes', '{"lang":"en"}'],
      ['repartito:v1:ajustes', '{"lang":"es"}'],
      ['otra-web', 'x'],
    ]);
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
      ...Object.fromEntries(mem),
    } as unknown as Storage;
    // Object.keys(storage) lista las claves, como en el navegador.
    expect(migrateLegacyStorage(storage)).toBe(1);
    expect(mem.get('repartito:v1:grupos')).toBe('[1]');
    expect(mem.has('amedias:v1:grupos')).toBe(false);
    expect(mem.get('repartito:v1:ajustes')).toBe('{"lang":"es"}');
    expect(mem.get('amedias:v1:ajustes')).toBe('{"lang":"en"}');
    expect(mem.get('otra-web')).toBe('x');
  });

  it('los enlaces cifrados conservan su identificador de protocolo', async () => {
    const g = piso();
    const payload = await encodeGroup(g, 'clave-de-prueba');
    expect((await decodeGroup(payload, 'clave-de-prueba')).id).toBe(g.id);
  });
});

describe('revisión externa (regresiones)', () => {
  it('P3: en un navegador sin deflate-raw, el enlace no se da por dañado', async () => {
    const payload = await encodeGroup(piso());
    const original = globalThis.DecompressionStream;
    globalThis.DecompressionStream = class {
      constructor() {
        throw new TypeError('formato no soportado');
      }
    } as unknown as typeof DecompressionStream;
    try {
      await expect(decodeGroup(payload)).rejects.toMatchObject({ code: 'unsupported' });
      expect(supportsLinks()).toBe(false);
    } finally {
      globalThis.DecompressionStream = original;
    }
    expect(supportsLinks()).toBe(true);
  });

  it('P4: borrar los restos del nombre antiguo no toca nada más', () => {
    const mem = new Map<string, string>([
      ['amedias:v1:grupos', '[1]'],
      ['repartito:v1:grupos', '[2]'],
      ['otra-web', 'x'],
    ]);
    const storage = {
      removeItem: (k: string) => void mem.delete(k),
      ...Object.fromEntries(mem),
    } as unknown as Storage;
    clearLegacyStorage(storage);
    expect([...mem.keys()].sort()).toEqual(['otra-web', 'repartito:v1:grupos']);
  });
});

describe('plantillas y «Repetir» (v0.3.0)', () => {
  const DAY = 24 * 3600 * 1000;
  const clon = (g: Group) => JSON.parse(JSON.stringify(g)) as Group;
  const conPlantillas = () => {
    const g = piso();
    const [ana, luis, marta] = ids(g);
    const todos = { mode: 'equal' as const, among: [ana, luis, marta] };
    let x = saveTemplate(g, { title: 'Súper', paidBy: ana, split: todos, category: 'compra' }, T0 + 1);
    x = saveTemplate(x, { title: 'Bombona', amount: 2200, paidBy: luis, split: todos, category: 'casa' }, T0 + 2);
    return { g: x, ana, luis, marta, todos };
  };

  it('guarda, actualiza por nombre (sin mayúsculas ni tildes) y borra con lápida', () => {
    const { g, ana, todos } = conPlantillas();
    expect(liveTemplates(g).map((t) => t.title)).toEqual(['Bombona', 'Súper']);
    expect(g.templates.find((t) => t.title === 'Súper')).not.toHaveProperty('amount');
    const id = g.templates.find((t) => t.title === 'Súper')!.id;
    const g2 = saveTemplate(g, { title: '  super ', amount: 4500, paidBy: ana, split: todos, category: 'compra' }, T0 + 3);
    expect(g2.templates).toHaveLength(2);
    expect(g2.templates.find((t) => t.id === id)).toMatchObject({ title: 'super', amount: 4500, updatedAt: T0 + 3 });
    const g3 = deleteTemplate(g2, id, T0 + 4);
    expect(g3.templates.find((t) => t.id === id)).toMatchObject({ deleted: true, updatedAt: T0 + 4 });
    expect(liveTemplates(g3).map((t) => t.title)).toEqual(['Bombona']);
    // Con la plantilla borrada, guardar otra con el mismo nombre crea una nueva (la lápida se queda).
    expect(saveTemplate(g3, { title: 'Súper', paidBy: ana, split: todos, category: 'compra' }, T0 + 5).templates).toHaveLength(3);
    expect(() => revalidate(g3)).not.toThrow();
  });

  it('«Repetir» copia todo menos la fecha (hoy) y la identidad', () => {
    let { g } = conPlantillas();
    const [ana, luis] = ids(g);
    g = addExpense(g, { title: 'Cena', amount: 3000, paidBy: ana, split: { mode: 'exact', amounts: { [ana]: 1000, [luis]: 2000 } }, category: 'restaurante', date: '2026-10-05' }, T0 + 3);
    const src = g.expenses[0]!;
    const r = repeatInput(src, '2026-10-27');
    expect(r).toEqual({ kind: 'expense', title: 'Cena', amount: 3000, paidBy: ana, split: src.split, category: 'restaurante', date: '2026-10-27' });
    expect(r).not.toHaveProperty('id');
    const next = addExpense(g, { ...r, amount: r.amount! }, T0 + 4);
    expect(next.expenses).toHaveLength(2);
    expect(next.expenses[1]!.id).not.toBe(src.id);
    // Desde una plantilla sin importe, el importe queda por escribir.
    expect(repeatInput(g.templates.find((t) => t.title === 'Súper')!, '2026-10-27')).not.toHaveProperty('amount');
  });

  it('los grupos de antes (sin plantillas) se leen con la lista vacía', () => {
    const viejo = clon(piso()) as Partial<Group>;
    delete viejo.templates;
    expect(parseGroup(viejo).templates).toEqual([]);
    // Y un grupo con plantillas pasa la validación tal cual.
    const { g } = conPlantillas();
    expect(revalidate(g)).toEqual(g);
  });

  it.each([
    ['id que no es UUID', (t: Record<string, unknown>) => (t.id = '__proto__')],
    ['quien paga no está en el grupo', (t: Record<string, unknown>) => (t.paidBy = crypto.randomUUID())],
    ['importe negativo', (t: Record<string, unknown>) => (t.amount = -5)],
    ['importe con decimales', (t: Record<string, unknown>) => (t.amount = 10.5)],
    ['reparto que no cuadra con el importe', (t: Record<string, unknown>) => ((t.amount = 1000), (t.split = { mode: 'exact', amounts: {} }))],
    ['importes exactos sin importe', (t: Record<string, unknown>) => (t.split = { mode: 'exact', amounts: {} })],
    ['porcentajes que no suman 100 %', (t: Record<string, unknown>) => (t.split = { mode: 'percent', basisPoints: { [String(t.paidBy)]: 5000 } })],
    ['categoría inventada', (t: Record<string, unknown>) => (t.category = 'drogas')],
    ['fecha interna del futuro lejano', (t: Record<string, unknown>) => (t.updatedAt = Date.now() + 5 * 365 * DAY)],
  ])('rechaza una plantilla con %s', (_, mutate) => {
    const raw = clon(conPlantillas().g) as unknown as { templates: Record<string, unknown>[] };
    mutate(raw.templates[0]!);
    expect(() => parseGroup(raw)).toThrow();
  });

  it('rechaza listas de plantillas que no son listas, repetidas o por encima del límite', () => {
    const { g } = conPlantillas();
    expect(() => parseGroup({ ...clon(g), templates: {} })).toThrow();
    expect(() => parseGroup({ ...clon(g), templates: [g.templates[0], g.templates[0]] })).toThrow();
    const muchas = Array.from({ length: LIMITS.templates + 1 }, () => ({ ...g.templates[0]!, id: crypto.randomUUID() }));
    expect(() => parseGroup({ ...clon(g), templates: muchas })).toThrow();
    expect(() => parseGroup({ ...clon(g), templates: muchas.slice(1) })).not.toThrow();
  });

  it('limpia el nombre y descarta campos desconocidos', () => {
    const raw = clon(conPlantillas().g) as unknown as { templates: Record<string, unknown>[] };
    raw.templates[0]!.title = 'Sú\u202eper\u0000';
    raw.templates[0]!.foto = 'data:image/jpeg;base64,AAAA';
    const t = parseGroup(raw).templates[0]!;
    expect(t.title).toBe('Sú per');
    expect(t).not.toHaveProperty('foto');
  });

  it('la fusión con plantillas sigue siendo conmutativa, asociativa e idempotente', () => {
    const { g, ana, todos } = conPlantillas();
    const [idSuper, idBombona] = [g.templates[0]!.id, g.templates[1]!.id];
    const a = saveTemplate(g, { title: 'Súper', amount: 5000, paidBy: ana, split: todos, category: 'compra' }, T0 + 10);
    const b = deleteTemplate(g, idSuper, T0 + 20);
    const c = saveTemplate(deleteTemplate(g, idBombona, T0 + 5), { title: 'Luz', paidBy: ana, split: todos, category: 'facturas' }, T0 + 30);
    const m = (x: Group, y: Group) => mergeGroups(x, y);
    expect(m(a, b)).toEqual(m(b, a));
    expect(m(m(a, b), c)).toEqual(m(a, m(b, c)));
    expect(m(m(a, b), c)).toEqual(m(m(c, a), b));
    expect(m(m(a, b), m(a, b))).toEqual(m(a, b));
    const all = m(m(a, b), c);
    // Gana la lápida (más reciente) frente a la edición; la plantilla nueva llega y la otra se borra.
    expect(all.templates.find((t) => t.id === idSuper)!.deleted).toBe(true);
    expect(all.templates.find((t) => t.id === idBombona)!.deleted).toBe(true);
    expect(liveTemplates(all).map((t) => t.title)).toEqual(['Luz']);
    expect(() => revalidate(all)).not.toThrow();
  });

  it('propiedades de la fusión con ediciones al azar en tres móviles', () => {
    let seed = 42;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    const { g, ana, luis, todos } = conPlantillas();
    for (let ronda = 0; ronda < 25; ronda++) {
      const copias = [clon(g), clon(g), clon(g)];
      for (let paso = 0; paso < 6; paso++) {
        const i = rnd(3);
        const x = copias[i]!;
        const live = liveTemplates(x);
        const now = T0 + 100 + rnd(50);
        const op = rnd(3);
        if (op === 0 || live.length === 0) copias[i] = saveTemplate(x, { title: ['Súper', 'Luz', 'Agua', 'Bombona'][rnd(4)]!, ...(rnd(2) ? { amount: 100 + rnd(9000) } : {}), paidBy: rnd(2) ? ana : luis, split: todos, category: 'compra' }, now);
        else if (op === 1) copias[i] = deleteTemplate(x, live[rnd(live.length)]!.id, now);
        else copias[i] = addExpense(x, { title: 'Pan', amount: 100 + rnd(500), paidBy: ana, split: todos, category: 'compra', date: '2026-10-06' }, now);
      }
      const [a, b, c] = copias as [Group, Group, Group];
      expect(mergeGroups(a, b)).toEqual(mergeGroups(b, a));
      expect(mergeGroups(mergeGroups(a, b), c)).toEqual(mergeGroups(a, mergeGroups(b, c)));
      const ab = mergeGroups(a, b);
      expect(mergeGroups(ab, ab)).toEqual(ab);
      expect(mergeGroups(ab, a)).toEqual(ab);
      expect(() => revalidate(mergeGroups(ab, c))).not.toThrow();
    }
  });

  it('la vista previa cuenta las plantillas nuevas, cambiadas y borradas', () => {
    const { g, ana, todos } = conPlantillas();
    const b = deleteTemplate(saveTemplate(g, { title: 'Luz', paidBy: ana, split: todos, category: 'facturas' }, T0 + 10), g.templates[0]!.id, T0 + 11);
    expect(mergePreview(g, b)).toMatchObject({ upToDate: false, templates: 2, newExpenses: 0, recurring: 0 });
    expect(mergePreview(b, g)).toMatchObject({ upToDate: true, templates: 0 });
    expect(mergePreview(g, clon(g))).toMatchObject({ upToDate: true, templates: 0 });
  });

  it('una plantilla con fecha adelantada cuenta como edición del futuro (F4)', () => {
    const { g } = conPlantillas();
    const b = clon(g);
    b.templates[0]!.updatedAt = T0 + 30 * DAY;
    expect(latestEdit(b)).toBe(T0 + 30 * DAY);
    expect(incomingProblem(g, b, T0)).toBe('future');
    expect(incomingProblem(g, clon(g), T0)).toBeNull();
  });

  it('no se acepta una fusión que pasaría del límite de plantillas (F1)', () => {
    const { g, ana, todos } = conPlantillas();
    let a = g;
    let b = clon(g);
    for (let i = 0; i < 60; i++) a = saveTemplate(a, { title: `A${i}`, paidBy: ana, split: todos, category: 'compra' }, T0 + 3);
    for (let i = 0; i < 60; i++) b = saveTemplate(b, { title: `B${i}`, paidBy: ana, split: todos, category: 'compra' }, T0 + 3);
    expect(() => revalidate(a)).not.toThrow();
    expect(incomingProblem(a, b, T0 + 10)).toBe('limits');
  });
});

describe('varias monedas en un grupo (v0.4.0)', () => {
  const DAY = 24 * 3600 * 1000;
  const clon = <T,>(g: T) => JSON.parse(JSON.stringify(g)) as T;
  // 1 EUR = 161,5 JPY (como lo cotiza el banco) y 1 JPY = 0,0062 EUR (al revés).
  const YEN: Original = { currency: 'JPY', amount: 3500, rate: 161_500_000 };
  const YEN_INV: Original = { currency: 'JPY', amount: 3500, rate: 6200, inverse: true };

  /** Viaje en euros con una cena en yenes, un pago en dólares y un gasto normal. */
  const viaje = () => {
    let g = newGroup('Japón', ['Ana', 'Luis', 'Marta'], 'EUR', '✈️', T0);
    const [ana, luis, marta] = ids(g);
    const todos = { mode: 'equal' as const, among: [ana, luis, marta] };
    g = addExpense(g, { title: 'Ramen', amount: baseAmount(YEN_INV, 'EUR'), original: YEN_INV, paidBy: ana, split: todos, category: 'restaurante', date: '2026-10-05' }, T0 + 1);
    const usd: Original = { currency: 'USD', amount: 1000, rate: 1_080_000 };
    g = addPayment(g, luis, ana, baseAmount(usd, 'EUR'), '2026-10-06', T0 + 2, usd);
    g = addExpense(g, { title: 'Metro', amount: 900, paidBy: marta, split: todos, category: 'transporte', date: '2026-10-06' }, T0 + 3);
    return { g, ana, luis, marta, todos };
  };

  describe('conversión y redondeo', () => {
    it('convierte en las dos direcciones del cambio', () => {
      expect(baseAmount(YEN_INV, 'EUR')).toBe(2170); // 3500 × 0,0062 = 21,70 €
      expect(baseAmount(YEN, 'EUR')).toBe(2167); // 3500 / 161,5 = 21,6718… → 21,67 €
      expect(convert(1000, 1_080_000, false, 'USD', 'EUR')).toBe(926); // 10 $ / 1,08 = 9,259… → 9,26 €
    });

    it('monedas sin decimales, de origen y de destino', () => {
      // Grupo en yenes, gasto en euros: 21,70 € con 1 JPY = 0,0062 EUR → 3500 ¥.
      expect(convert(2170, 6200, false, 'EUR', 'JPY')).toBe(3500);
      // Grupo en pesos chilenos, gasto en dólares: 19,99 $ con 1 USD = 950 CLP → 18 990,5 → 18 991 (mitad hacia arriba).
      expect(convert(1999, 950_000_000, true, 'USD', 'CLP')).toBe(18991);
      expect(convert(1998, 950_000_000, true, 'USD', 'CLP')).toBe(18981);
      // De yenes a pesos chilenos (las dos sin decimales): 1000 ¥ con 1 JPY = 6,3 CLP.
      expect(convert(1000, 6_300_000, true, 'JPY', 'CLP')).toBe(6300);
      // De pesos chilenos a euros: 1 EUR = 1.020 CLP; 10 200 CLP = 10 €.
      expect(convert(10200, 1_020_000_000, false, 'CLP', 'EUR')).toBe(1000);
    });

    it('redondea siempre a la unidad más cercana (nunca a más de media unidad del valor exacto)', () => {
      let seed = 7;
      const rnd = (n: number) => {
        seed = (seed * 1103515245 + 12345) % 2 ** 31;
        return seed % n;
      };
      const cur = ['EUR', 'JPY', 'CLP', 'USD'] as const;
      for (let i = 0; i < 500; i++) {
        const amount = 1 + rnd(10_000_000);
        const rate = 1 + rnd(RATE_MAX);
        const inverse = rnd(2) === 1;
        const from = cur[rnd(4)]!;
        const to = cur[rnd(4)]!;
        const out = convert(amount, rate, inverse, from, to);
        if (!Number.isFinite(out)) continue;
        // valor exacto = num / den; |out − num/den| ≤ 1/2  ⇔  |2·out·den − 2·num| ≤ den
        const dTo = BigInt(to === 'JPY' || to === 'CLP' ? 1 : 100);
        const dFrom = BigInt(from === 'JPY' || from === 'CLP' ? 1 : 100);
        const num = BigInt(amount) * (inverse ? BigInt(rate) : 1_000_000n) * dTo;
        const den = (inverse ? 1_000_000n : BigInt(rate)) * dFrom;
        const err = 2n * BigInt(out) * den - 2n * num;
        expect(err <= den && -err < den, `${amount} ${rate} ${inverse} ${from}→${to}`).toBe(true);
        expect(convert(amount, rate, inverse, from, to)).toBe(out); // determinista
      }
    });

    it('un resultado que no cabe en un entero seguro no se confunde con un importe', () => {
      expect(convert(LIMITS.amount, RATE_MAX, true, 'JPY', 'EUR')).toBe(Infinity);
    });

    it('foreignAmount: misma moneda, cambio fuera de límites, menos de un céntimo o por encima del tope', () => {
      expect(foreignAmount(3500, 'JPY', 6200, true, 'EUR')).toEqual({ amount: 2170, original: YEN_INV });
      expect(foreignAmount(3500, 'JPY', 161_500_000, false, 'EUR')).toEqual({ amount: 2167, original: YEN });
      expect(foreignAmount(3500, 'EUR', 6200, true, 'EUR')).toEqual({ problem: 'same' });
      expect(foreignAmount(3500, 'JPY', 0, true, 'EUR')).toEqual({ problem: 'rate' });
      expect(foreignAmount(3500, 'JPY', 1.5, true, 'EUR')).toEqual({ problem: 'rate' });
      expect(foreignAmount(3500, 'JPY', RATE_MAX + 1, true, 'EUR')).toEqual({ problem: 'rate' });
      expect(foreignAmount(1, 'JPY', RATE_MAX, false, 'EUR')).toEqual({ problem: 'small' });
      expect(foreignAmount(LIMITS.amount, 'USD', 150_000_000, true, 'JPY')).toEqual({ problem: 'big' });
    });
  });

  describe('el cambio que se escribe', () => {
    it.each([
      ['161,5', 161_500_000], ['161.5', 161_500_000], ['0,0062', 6200], ['0.856', 856_000], ['1,085', 1_085_000],
      ['17', 17_000_000], ['1.234,5', 1_234_500_000], ['4,512.37', 4_512_370_000], ['1.000.000', RATE_MAX],
      [' 0,000001 ', RATE_MIN], ['950', 950_000_000], ['007,5', 7_500_000],
    ])('lee «%s» como %i millonésimas', (txt, micro) => {
      expect(parseRate(txt)).toBe(micro);
    });

    it.each(['', '0', '0,0000001', '-1', 'abc', '1e3', '1..2', '1,', ',5', '1,2,3', '1.234,5.6', '2.000.001', '12345678', 'NaN', '1.23.456'])(
      'rechaza «%s»',
      (txt) => {
        expect(parseRate(txt)).toBeNull();
      },
    );

    it('se enseña como se escribió, en cada idioma, y vuelve a leerse igual', () => {
      expect(rateToInput(161_500_000, 'es-ES')).toBe('161,5');
      expect(rateToInput(161_500_000, 'en-GB')).toBe('161.5');
      expect(rateToInput(6200)).toBe('0,0062');
      expect(rateToInput(17_000_000)).toBe('17');
      for (const r of [1, 6200, 856_000, 161_500_000, 4_512_370_000, RATE_MAX]) {
        expect(parseRate(rateToInput(r, 'es-ES'))).toBe(r);
        expect(parseRate(rateToInput(r, 'en-GB'))).toBe(r);
      }
      expect(formatRate(YEN, 'EUR')).toBe('1 EUR = 161,5 JPY');
      expect(formatRate(YEN_INV, 'EUR', 'en-GB')).toBe('1 JPY = 0.0062 EUR');
    });

    it('darle la vuelta al cambio', () => {
      expect(invertRate(161_500_000)).toBe(6192); // 1/161,5 = 0,0061919…
      expect(invertRate(1_000_000)).toBe(1_000_000);
      expect(invertRate(RATE_MAX)).toBe(RATE_MIN);
      expect(invertRate(RATE_MIN)).toBe(RATE_MAX);
      expect(invertRate(0)).toBeNull();
    });
  });

  describe('el modelo', () => {
    it('el gasto guarda el importe original y el equivalente; saldos, resumen y repartos usan el equivalente', () => {
      const { g, ana, luis, marta } = viaje();
      const ramen = g.expenses[0]!;
      expect(ramen).toMatchObject({ amount: 2170, original: YEN_INV });
      expect(g.expenses[1]).toMatchObject({ kind: 'transfer', amount: 926, original: { currency: 'USD', amount: 1000 } });
      expect(g.expenses[2]).not.toHaveProperty('original');
      expect(suma(shareOf(ramen.amount, ramen.split))).toBe(2170);
      const bal = balances(g);
      expect(suma(bal)).toBe(0);
      const parte = shareOf(2170, ramen.split);
      expect(bal).toEqual({ [ana]: 2170 - parte[ana]! - 300 - 926, [luis]: -parte[luis]! - 300 + 926, [marta]: -parte[marta]! + 900 - 300 });
      expect(byCategory(g).restaurante).toBe(2170);
      expect(revalidate(g)).toEqual(g);
    });

    it('editar en la moneda del grupo quita el importe original; «Repetir» lo conserva', () => {
      const { g, ana, todos } = viaje();
      const id = g.expenses[0]!.id;
      const editado = updateExpense(g, id, { title: 'Ramen', amount: 2000, paidBy: ana, split: todos, category: 'restaurante', date: '2026-10-05' }, T0 + 10);
      expect(editado.expenses[0]).not.toHaveProperty('original');
      expect(editado.expenses[0]!.amount).toBe(2000);
      const otraVez = updateExpense(editado, id, { title: 'Ramen', amount: 2167, original: YEN, paidBy: ana, split: todos, category: 'restaurante', date: '2026-10-05' }, T0 + 11);
      expect(otraVez.expenses[0]!.original).toEqual(YEN);
      expect(repeatInput(g.expenses[0]!, '2026-10-28')).toMatchObject({ amount: 2170, original: YEN_INV, date: '2026-10-28' });
      expect(() => revalidate(otraVez)).not.toThrow();
    });

    it('las lápidas no guardan el importe original', () => {
      const { g } = viaje();
      const b = deleteExpense(g, g.expenses[0]!.id, T0 + 10);
      expect(b.expenses[0]).toMatchObject({ deleted: true });
      expect(b.expenses[0]).not.toHaveProperty('original');
      // Una lápida que llega con un `original` cualquiera se acepta y se queda sin él.
      const raw = clon(g) as unknown as { expenses: Record<string, unknown>[] };
      raw.expenses[0]!.deleted = true;
      raw.expenses[0]!.original = { currency: 'XXX', amount: -1, rate: 'x' };
      expect(parseGroup(raw).expenses[0]).not.toHaveProperty('original');
    });

    it('gastos fijos en otra moneda: cada mes lleva su importe original', () => {
      let g = newGroup('Piso', ['Ana', 'Luis'], 'EUR', '🏠', T0);
      const [ana, luis] = g.members.map((m) => m.id) as [string, string];
      const usd: Original = { currency: 'USD', amount: 1599, rate: 1_080_000 };
      g = addRecurring(g, { title: 'Streaming', amount: baseAmount(usd, 'EUR'), original: usd, paidBy: ana, split: { mode: 'equal', among: [ana, luis] }, category: 'ocio', day: 1, startMonth: '2026-09' }, T0);
      const m = materializeRecurring(g, '2026-10-15', T0).group;
      expect(m.expenses).toHaveLength(2);
      for (const e of m.expenses) expect(e).toMatchObject({ amount: 1481, original: usd });
      expect(() => revalidate(m)).not.toThrow();
      const rid = g.recurring[0]!.id;
      const sinMoneda = updateRecurring(m, rid, { amount: 1500, original: undefined }, T0 + 1);
      expect(sinMoneda.recurring[0]).not.toHaveProperty('original');
      expect(updateRecurring(m, rid, { day: 2 }, T0 + 1).recurring[0]!.original).toEqual(usd);
      // Cambiar el importe sin mencionar la otra moneda la quita (si no, dejarían de cuadrar).
      const soloImporte = updateRecurring(m, rid, { amount: 1600 }, T0 + 1);
      expect(soloImporte.recurring[0]).not.toHaveProperty('original');
      expect(() => revalidate(soloImporte)).not.toThrow();
      expect(updateRecurring(m, rid, { deleted: true }, T0 + 1).recurring[0]).not.toHaveProperty('original');
    });

    it('último cambio usado por moneda (para proponerlo)', () => {
      const v = viaje();
      const { ana, todos } = v;
      let g = v.g;
      expect(lastRate(g, 'JPY')).toEqual({ rate: 6200, inverse: true });
      expect(lastRate(g, 'USD')).toEqual({ rate: 1_080_000 });
      expect(lastRate(g, 'GBP')).toBeNull();
      g = addExpense(g, { title: 'Sushi', amount: 2167, original: YEN, paidBy: ana, split: todos, category: 'restaurante', date: '2026-10-07' }, T0 + 20);
      expect(lastRate(g, 'JPY')).toEqual({ rate: 161_500_000 });
      g = deleteExpense(g, g.expenses[3]!.id, T0 + 30);
      expect(lastRate(g, 'JPY')).toEqual({ rate: 6200, inverse: true });
    });
  });

  describe('validación', () => {
    const raw = () => clon(viaje().g) as unknown as { currency: string; expenses: Record<string, unknown>[]; recurring: Record<string, unknown>[] };
    const o = (r: ReturnType<typeof raw>) => r.expenses[0]!.original as Record<string, unknown>;

    it('acepta un grupo con otras monedas y lo deja idéntico', () => {
      const { g } = viaje();
      expect(parseGroup(clon(g))).toEqual(revalidate(g));
      expect(parseGroup(clon(g)).expenses[0]!.original).toEqual(YEN_INV);
    });

    it.each([
      ['un importe que no es la conversión (+1 céntimo)', (r: ReturnType<typeof raw>) => (r.expenses[0]!.amount = 2171)],
      ['un importe original manipulado', (r: ReturnType<typeof raw>) => (o(r).amount = 3600)],
      ['un cambio manipulado', (r: ReturnType<typeof raw>) => (o(r).rate = 6300)],
      ['un cambio con decimales', (r: ReturnType<typeof raw>) => (o(r).rate = 6200.5)],
      ['un cambio de cero', (r: ReturnType<typeof raw>) => (o(r).rate = 0)],
      ['un cambio por encima del tope', (r: ReturnType<typeof raw>) => (o(r).rate = RATE_MAX + 1)],
      ['un cambio negativo', (r: ReturnType<typeof raw>) => (o(r).rate = -6200)],
      ['un cambio en texto', (r: ReturnType<typeof raw>) => (o(r).rate = '6200')],
      ['la dirección del cambio dada la vuelta', (r: ReturnType<typeof raw>) => delete o(r).inverse],
      ['una dirección que no es true', (r: ReturnType<typeof raw>) => (o(r).inverse = 'yes')],
      ['una dirección false', (r: ReturnType<typeof raw>) => (o(r).inverse = false)],
      ['la misma moneda que el grupo', (r: ReturnType<typeof raw>) => (o(r).currency = 'EUR')],
      // Aunque cuadre (1 EUR = 1 EUR): la misma moneda no es «otra moneda».
      ['la misma moneda que el grupo aunque cuadre', (r: ReturnType<typeof raw>) => (r.expenses[0]!.original = { currency: 'EUR', amount: 2170, rate: 1_000_000 })],
      ['una moneda inventada', (r: ReturnType<typeof raw>) => (o(r).currency = 'XBT')],
      ['un importe original negativo', (r: ReturnType<typeof raw>) => (o(r).amount = -3500)],
      ['un importe original con decimales', (r: ReturnType<typeof raw>) => (o(r).amount = 3500.5)],
      ['un importe original enorme', (r: ReturnType<typeof raw>) => (o(r).amount = 1e15)],
      ['un original que no es un objeto', (r: ReturnType<typeof raw>) => (r.expenses[0]!.original = [3500])],
      ['un original nulo', (r: ReturnType<typeof raw>) => (r.expenses[0]!.original = null)],
      ['la moneda del grupo cambiada a la del gasto', (r: ReturnType<typeof raw>) => (r.currency = 'JPY')],
      ['la moneda del grupo cambiada a otra con otros decimales', (r: ReturnType<typeof raw>) => (r.currency = 'CLP')],
    ])('rechaza %s', (_, mutate) => {
      const r = raw();
      mutate(r);
      expect(() => parseGroup(r)).toThrow(/no válidos/);
    });

    it('rechaza también un gasto fijo con el cambio manipulado', () => {
      let g = newGroup('Piso', ['Ana'], 'EUR', '🏠', T0);
      const [ana] = g.members.map((m) => m.id) as [string];
      const usd: Original = { currency: 'USD', amount: 1599, rate: 1_080_000 };
      g = addRecurring(g, { title: 'Streaming', amount: 1481, original: usd, paidBy: ana, split: { mode: 'equal', among: [ana] }, category: 'ocio', day: 1, startMonth: '2026-09' }, T0);
      expect(() => parseGroup(clon(g))).not.toThrow();
      const r = clon(g);
      r.recurring[0]!.amount = 1;
      r.recurring[0]!.split = { mode: 'equal', among: [ana] };
      expect(() => parseGroup(r)).toThrow(/no válidos/);
    });

    it('los repartos por importes exactos van en la moneda del grupo y tienen que sumar el equivalente', () => {
      const { g, ana, luis } = viaje();
      const exacto = updateExpense(g, g.expenses[0]!.id, { title: 'Ramen', amount: 2170, original: YEN_INV, paidBy: ana, split: { mode: 'exact', amounts: { [ana]: 1170, [luis]: 1000 } }, category: 'restaurante', date: '2026-10-05' }, T0 + 5);
      expect(() => revalidate(exacto)).not.toThrow();
      const mal = clon(exacto);
      mal.expenses[0]!.split = { mode: 'exact', amounts: { [ana]: 2500, [luis]: 1000 } }; // 3500: los yenes, no los euros
      expect(() => parseGroup(mal)).toThrow(/no válidos/);
    });
  });

  describe('moneda del grupo', () => {
    it('no se puede cambiar mientras haya gastos vivos en otras monedas', () => {
      const { g } = viaje();
      expect(hasForeign(g)).toBe(true);
      expect(() => renameGroup(g, { currency: 'USD' }, T0 + 10)).toThrow(/otras monedas/);
      expect(() => renameGroup(g, { name: 'Japón 2026', currency: 'EUR' }, T0 + 10)).not.toThrow();
      // Borrados los gastos en otras monedas, sí (las lápidas no guardan `original`).
      let b = deleteExpense(g, g.expenses[0]!.id, T0 + 10);
      b = deleteExpense(b, b.expenses[1]!.id, T0 + 11);
      expect(hasForeign(b)).toBe(false);
      const usd = renameGroup(b, { currency: 'USD' }, T0 + 12);
      expect(usd.currency).toBe('USD');
      expect(() => revalidate(usd)).not.toThrow();
    });

    it('no se fusiona un enlace que cambia la moneda si hay gastos en otras monedas (en cualquiera de las dos copias)', () => {
      const { g } = viaje();
      const otra = { ...clon(g), currency: 'GBP' as const, updatedAt: g.updatedAt + 1000 };
      expect(incomingProblem(g, otra, T0)).toBe('currency');
      const plano = piso();
      const conYenes = { ...clon(plano), currency: 'USD' as const, updatedAt: plano.updatedAt + 1000 };
      expect(incomingProblem(plano, conYenes, T0)).toBeNull(); // sin gastos en otras monedas, como antes
      const local = { ...clon(g), currency: 'USD' as const };
      expect(incomingProblem(local, clon(g), T0)).toBe('currency');
      expect(incomingProblem(g, clon(g), T0)).toBeNull();
    });
  });

  describe('fusión', () => {
    it('conmutativa, asociativa e idempotente con gastos en varias monedas (ediciones al azar)', () => {
      let seed = 2026;
      const rnd = (n: number) => {
        seed = (seed * 1103515245 + 12345) % 2 ** 31;
        return seed % n;
      };
      const { g, ana, luis, todos } = viaje();
      const monedas = ['JPY', 'USD', 'GBP', 'CLP'] as const;
      for (let ronda = 0; ronda < 30; ronda++) {
        const copias = [clon(g), clon(g), clon(g)];
        for (let paso = 0; paso < 8; paso++) {
          const i = rnd(3);
          const x = copias[i]!;
          const live = x.expenses.filter((e) => !e.deleted);
          const now = T0 + 100 + rnd(40);
          const fx = foreignAmount(1 + rnd(100_000), monedas[rnd(4)]!, 1 + rnd(2_000_000_000), rnd(2) === 1, 'EUR');
          const money = 'amount' in fx && rnd(3) > 0 ? { amount: fx.amount, original: fx.original } : { amount: 100 + rnd(9000) };
          const input = { title: 'Algo', ...money, paidBy: rnd(2) ? ana : luis, split: todos, category: 'viaje' as const, date: '2026-10-08' };
          const op = rnd(3);
          if (op === 0 || live.length === 0) copias[i] = addExpense(x, input, now);
          else if (op === 1) copias[i] = updateExpense(x, live[rnd(live.length)]!.id, input, now);
          else copias[i] = deleteExpense(x, live[rnd(live.length)]!.id, now);
        }
        // Lo que llega de fuera pasa siempre por parseGroup.
        const [a, b, c] = copias.map((x) => parseGroup(clon(x))) as [Group, Group, Group];
        expect(mergeGroups(a, b)).toEqual(mergeGroups(b, a));
        expect(mergeGroups(mergeGroups(a, b), c)).toEqual(mergeGroups(a, mergeGroups(b, c)));
        const ab = mergeGroups(a, b);
        expect(mergeGroups(ab, ab)).toEqual(ab);
        expect(mergeGroups(ab, a)).toEqual(ab);
        const all = mergeGroups(ab, c);
        expect(revalidate(all)).toEqual(all);
        for (const e of all.expenses) if (e.original) expect(baseAmount(e.original, 'EUR')).toBe(e.amount);
      }
    });

    it('la versión de un móvil con la v0.3 (sin `original`) no le gana a la completa con la misma marca', () => {
      const { g } = viaje();
      // Lo que haría la v0.3 al leer el grupo: quedarse con los campos que conoce.
      const v03 = clon(g);
      for (const e of v03.expenses) delete e.original;
      const recortado = parseGroup(v03);
      expect(recortado.expenses[0]!.amount).toBe(2170); // el importe sigue siendo correcto
      for (const [x, y] of [[g, recortado], [recortado, g]] as const) {
        const m = mergeGroups(x, y);
        expect(m.expenses.find((e) => e.title === 'Ramen')!.original).toEqual(YEN_INV);
      }
      expect(mergePreview(g, recortado).upToDate).toBe(true);
      expect(mergePreview(recortado, g)).toMatchObject({ upToDate: false, changed: 2 });
      expect(mergeGroups(mergeGroups(g, recortado), recortado)).toEqual(mergeGroups(g, recortado));
      // Una edición posterior en la v0.3 sí gana (y el gasto queda en la moneda del grupo, con su importe).
      const v03edit = clon(recortado);
      const ramen = v03edit.expenses.find((e) => e.title === 'Ramen')!;
      ramen.title = 'Ramen y gyozas';
      ramen.updatedAt += 1;
      const m = mergeGroups(g, v03edit).expenses.find((e) => e.id === ramen.id)!;
      expect(m).toMatchObject({ title: 'Ramen y gyozas', amount: 2170 });
      expect(m).not.toHaveProperty('original');
    });
  });

  describe('compatibilidad', () => {
    it('un grupo de la v0.3 (sin `original`) se lee igual que antes', () => {
      let g = piso();
      const [ana, luis] = ids(g);
      g = addExpense(g, { title: 'Cena', amount: 3000, paidBy: ana, split: { mode: 'equal', among: [ana, luis] }, category: 'restaurante', date: '2026-10-05' }, T0);
      const viejo = clon(g);
      expect(parseGroup(viejo)).toEqual(revalidate(g));
      expect(JSON.stringify(parseGroup(viejo))).not.toContain('original');
    });

    it('quitar `original` (lo que hace la v0.3 al leerlo) deja los mismos saldos', () => {
      const { g } = viaje();
      const v03 = clon(g);
      for (const e of v03.expenses) delete e.original;
      expect(balances(parseGroup(v03))).toEqual(balances(g));
    });

    it('un enlace con gastos en otras monedas va y vuelve igual', async () => {
      const { g } = viaje();
      expect(await decodeGroup(await encodeGroup(g))).toEqual(revalidate(g));
    });
  });

  describe('CSV', () => {
    it('añade moneda, importe y cambio originales, y sigue neutralizando fórmulas', () => {
      const { g, ana, todos } = viaje();
      const x = addExpense(g, { title: '=HYPERLINK("http://malo")', amount: 2167, original: YEN, paidBy: ana, split: todos, category: 'otros', date: '2026-10-09' }, T0 + 9);
      const csv = exportCsv(x);
      const filas = parseCsv(csv, ';');
      expect(filas[0]!.slice(4, 9)).toEqual(['Importe (EUR)', 'Moneda original', 'Importe original', 'Cambio', 'Pagó']);
      expect(filas[1]!.slice(4, 9)).toEqual(['21,70', 'JPY', '3500', '1 JPY = 0,0062 EUR', 'Ana']);
      const fila = (title: string) => filas.find((f) => f[1] === title)!.slice(4, 9);
      expect(fila('Pago')).toEqual(['9,26', 'USD', '10,00', '1 EUR = 1,08 USD', 'Luis']);
      expect(fila('Metro')).toEqual(['9,00', '', '', '', 'Marta']);
      expect(filas[4]!.slice(1, 9)).toEqual([`'=HYPERLINK("http://malo")`, 'otros', 'Gasto', '21,67', 'JPY', '3500', '1 EUR = 161,5 JPY', 'Ana']);
      const en = parseCsv(exportCsv(x, 'en'), ',');
      expect(en[0]!.slice(5, 8)).toEqual(['Original currency', 'Original amount', 'Exchange rate']);
      expect(en.find((f) => f[1] === 'Pago')!.slice(4, 8)).toEqual(['9.26', 'USD', '10.00', '1 EUR = 1.08 USD']);
    });

    it('un grupo de una sola moneda sale como antes', () => {
      const { g } = viaje();
      const b = deleteExpense(deleteExpense(g, g.expenses[0]!.id, T0 + 10), g.expenses[1]!.id, T0 + 10);
      expect(exportCsv(b)).not.toContain('original');
    });
  });

  it('una moneda del gasto con fecha adelantada sigue contando como edición del futuro (F4)', () => {
    const { g } = viaje();
    const b = clon(g);
    b.expenses[0]!.updatedAt = T0 + 30 * DAY;
    expect(incomingProblem(g, b, T0)).toBe('future');
  });
});
