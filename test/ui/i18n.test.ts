import { describe, expect, it } from 'vitest';
import { detectLang, exportCsv, LANGS, loadSettings, LOCALES, parseCsv, type Lang } from '../../src/core';
import { dictionaries, LANG_NAMES, makeI18n } from '../../src/i18n';
import { es } from '../../src/i18n/es';
import { buildDemo } from '../../src/ui/demo';

const others = LANGS.filter((l) => l !== 'es');
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const keys = Object.keys(es) as (keyof typeof es)[];

describe('diccionarios', () => {
  it('hay un diccionario por idioma, con su nombre y su locale', () => {
    expect(Object.keys(dictionaries).sort()).toEqual([...LANGS].sort());
    for (const l of LANGS) {
      expect(LANG_NAMES[l].trim(), l).not.toBe('');
      expect(LOCALES[l], l).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });

  it.each(others)('%s tiene exactamente las mismas claves que es', (l) => {
    expect(Object.keys(dictionaries[l]).sort()).toEqual(Object.keys(es).sort());
  });

  it.each(LANGS)('%s: ningún texto está vacío', (l) => {
    for (const [k, v] of Object.entries(dictionaries[l])) expect(v.trim(), k).not.toBe('');
  });

  it.each(others)('%s: las variables {x} de cada clave coinciden con es', (l) => {
    for (const k of keys) expect(vars(dictionaries[l][k]), `${l} ${k}`).toEqual(vars(es[k]));
  });

  it('los plurales van por parejas _one/_other en todos los idiomas', () => {
    for (const l of LANGS) {
      const ks = Object.keys(dictionaries[l]);
      for (const k of ks.filter((x) => x.endsWith('_one'))) expect(ks, `${l} ${k}`).toContain(k.replace(/_one$/, '_other'));
      for (const k of ks.filter((x) => x.endsWith('_other'))) expect(ks, `${l} ${k}`).toContain(k.replace(/_other$/, '_one'));
    }
  });

  it('no hay llaves sueltas ni marcado: los textos son texto plano', () => {
    for (const l of LANGS)
      for (const [k, v] of Object.entries(dictionaries[l])) {
        expect(v.replace(/\{\w+\}/g, ''), `${l} ${k}`).not.toMatch(/[{}<>]/);
      }
  });

  it('las traducciones no se quedan en español por descuido', () => {
    // Algunas coinciden de verdad («Saldos», «Tema», «%»…); si más de la cuarta parte coincide, falta traducir.
    for (const l of ['ca', 'gl', 'pt'] as const) {
      const same = keys.filter((k) => dictionaries[l][k] === es[k]).length;
      expect(same / keys.length, l).toBeLessThan(0.25);
    }
  });
});

describe('P2: con contraseña, nada del grupo viaja en claro', () => {
  it('el mensaje de un enlace cifrado no lleva el nombre del grupo, en ningún idioma', () => {
    for (const l of LANGS) expect(dictionaries[l]['share.messageLocked'], l).not.toContain('{name}');
  });
});

describe('elegir idioma', () => {
  it('detecta el idioma del dispositivo, también con región o variante', () => {
    expect(detectLang(['es-ES'])).toBe('es');
    expect(detectLang(['es-MX', 'en'])).toBe('es');
    expect(detectLang(['ca-ES'])).toBe('ca');
    expect(detectLang(['ca-ES-valencia'])).toBe('ca');
    expect(detectLang(['ca'])).toBe('ca');
    expect(detectLang(['gl-ES'])).toBe('gl');
    expect(detectLang(['GL'])).toBe('gl');
    expect(detectLang(['pt-PT'])).toBe('pt');
    expect(detectLang(['pt-BR'])).toBe('pt');
    expect(detectLang(['pt_PT'])).toBe('pt');
    expect(detectLang(['en-US'])).toBe('en');
  });

  it('respeta el orden de preferencia y salta los idiomas que no tiene', () => {
    expect(detectLang(['fr-FR', 'gl-ES', 'es-ES'])).toBe('gl');
    expect(detectLang(['de-DE', 'pt-PT'])).toBe('pt');
    expect(detectLang(['en-GB', 'ca-ES'])).toBe('en');
  });

  it('euskera (pendiente de revisión nativa), asturiano y aragonés: español', () => {
    expect(detectLang(['eu-ES'])).toBe('es');
    expect(detectLang(['eu'])).toBe('es');
    expect(detectLang(['ast-ES'])).toBe('es');
    expect(detectLang(['an'])).toBe('es');
  });

  it('sin coincidencias, inglés; sin información, español', () => {
    expect(detectLang(['fr-FR', 'de'])).toBe('en');
    expect(detectLang([])).toBe('es');
    expect(detectLang([''])).toBe('es');
  });

  const mem = (data: Record<string, string>) =>
    ({
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => void (data[k] = v),
      removeItem: (k: string) => void delete data[k],
    }) as unknown as Storage;

  it('sin preferencia guardada, usa el idioma del dispositivo', () => {
    expect(loadSettings(mem({}), ['gl-ES']).lang).toBe('gl');
    expect(loadSettings(mem({}), ['pt-PT', 'en']).lang).toBe('pt');
    expect(loadSettings(mem({ 'repartito:v1:ajustes': 'no es JSON' }), ['ca']).lang).toBe('ca');
  });

  it('lo elegido en Ajustes manda sobre el dispositivo', () => {
    for (const l of LANGS) expect(loadSettings(mem({ 'repartito:v1:ajustes': JSON.stringify({ lang: l }) }), ['en-US']).lang).toBe(l);
  });

  it('un idioma guardado que no existe (o manipulado) se ignora', () => {
    for (const bad of ['eu', 'fr', '__proto__', 7, null]) {
      expect(loadSettings(mem({ 'repartito:v1:ajustes': JSON.stringify({ lang: bad }) }), ['ca-ES']).lang).toBe('ca');
    }
  });
});

describe('formatos de cada idioma', () => {
  const nbsp = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ');

  it('makeI18n usa el locale de cada idioma para el dinero y las fechas', () => {
    expect(makeI18n('ca').locale).toBe('ca-ES');
    expect(makeI18n('gl').locale).toBe('gl-ES');
    expect(makeI18n('pt').locale).toBe('pt-PT');
    expect(nbsp(makeI18n('ca').money(123450, 'EUR'))).toBe('1.234,50 €');
    expect(nbsp(makeI18n('gl').money(123450, 'EUR'))).toBe('1.234,50 €');
    expect(nbsp(makeI18n('pt').money(1250, 'EUR'))).toBe('12,50 €');
    expect(makeI18n('ca').month('2026-10')).toBe('octubre del 2026');
    expect(makeI18n('gl').month('2026-10')).toBe('outubro de 2026');
    expect(makeI18n('pt').month('2026-10')).toBe('outubro de 2026');
    expect(makeI18n('gl').month('2026-10', 'short')).toBe('out');
  });

  it('plurales y variables en los idiomas nuevos', () => {
    expect(makeI18n('ca').tp('home.people', 1)).toBe('1 persona');
    expect(makeI18n('ca').tp('home.people', 3)).toBe('3 persones');
    expect(makeI18n('gl').tp('home.expenses', 2)).toBe('2 gastos');
    expect(makeI18n('pt').tp('home.expenses', 0)).toBe('0 despesas');
    expect(makeI18n('pt').t('status.owed', { amount: '5 €' })).toBe('Devem-te 5 €');
    expect(makeI18n('ca').cat('restaurante')).toBe('Menjar fora');
  });

  it('el grupo de ejemplo sale en cada idioma', () => {
    const titles = (l: Lang) => buildDemo(l).group.expenses.map((e) => e.title);
    expect(buildDemo('ca').group.name).toBe('Pis d’exemple');
    expect(buildDemo('gl').group.name).toBe('Piso de exemplo');
    expect(buildDemo('pt').group.name).toBe('Casa de exemplo');
    expect(titles('ca')).toContain('Sopar de benvinguda');
    expect(titles('gl')).toContain('Cea de benvida');
    expect(titles('pt')).toContain('Jantar de boas-vindas');
    expect(buildDemo('pt').group.templates.map((t) => t.title).sort()).toEqual(['Botija de gás', 'Supermercado']);
  });

  it('el CSV traduce cabeceras, tipo y categoría, con «;» y coma decimal', () => {
    const { group } = buildDemo('pt');
    const rows = parseCsv(exportCsv(group, 'pt', makeI18n('pt').cat), ';');
    expect(rows[0]!.slice(0, 6)).toEqual(['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor (EUR)', 'Pagou']);
    expect(rows[0]).toContain('Parte de Marta');
    expect(rows.some((r) => r[3] === 'Pagamento')).toBe(true);
    expect(rows.find((r) => r[1] === 'Jantar de boas-vindas')!.slice(2, 5)).toEqual(['Comer fora', 'Despesa', '86,50']);
    const ca = parseCsv(exportCsv(buildDemo('ca').group, 'ca'), ';');
    expect(ca[0]!.slice(0, 6)).toEqual(['Data', 'Concepte', 'Categoria', 'Tipus', 'Import (EUR)', 'Ha pagat']);
    expect(ca[0]).toContain('Part (Alex)');
    const gl = parseCsv(exportCsv(buildDemo('gl').group, 'gl'), ';');
    expect(gl[0]!.slice(0, 6)).toEqual(['Data', 'Concepto', 'Categoría', 'Tipo', 'Importe (EUR)', 'Pagou']);
  });

  it('el CSV sigue neutralizando fórmulas aunque la categoría venga traducida', () => {
    const { group } = buildDemo('ca');
    const csv = exportCsv(group, 'ca', () => '=1+1');
    expect(csv).not.toMatch(/;=1\+1;/);
    expect(csv).toContain(`;'=1+1;`);
  });
});
