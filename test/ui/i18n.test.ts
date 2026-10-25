import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { es } from '../../src/i18n/es';

describe('diccionarios', () => {
  it('es y en tienen exactamente las mismas claves', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it('ningún texto está vacío', () => {
    for (const dict of [es, en]) for (const [k, v] of Object.entries(dict)) expect(v.trim(), k).not.toBe('');
  });

  it('las variables {x} coinciden entre idiomas', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of Object.keys(es) as (keyof typeof es)[]) expect(vars(en[k]), k).toEqual(vars(es[k]));
  });
});

describe('P2: con contraseña, nada del grupo viaja en claro', () => {
  it('el mensaje de un enlace cifrado no lleva el nombre del grupo', () => {
    for (const dict of [es, en]) expect(dict['share.messageLocked']).not.toContain('{name}');
  });
});
