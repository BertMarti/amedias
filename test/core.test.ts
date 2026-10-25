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
  migrateLegacyStorage,
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
  type Group,
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
