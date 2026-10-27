import { describe, expect, it } from 'vitest';
import { addExpense, deleteExpense, newGroup } from '../../src/core';
import { fitWithin, PHOTO_MAX_BYTES, shrink } from '../../src/ui/image';
import { isPhotoData, MAX_PHOTO_CHARS, memoryPhotoStore, orphanPhotos } from '../../src/ui/photos';

const JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwC/AA//2Q==';

describe('fotos de tickets: tamaño y compresión', () => {
  it('cabe en 1600 px sin deformar ni ampliar', () => {
    expect(fitWithin(4000, 3000)).toEqual({ w: 1600, h: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ w: 1200, h: 1600 });
    expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 });
    expect(fitWithin(10_000, 3)).toEqual({ w: 1600, h: 1 });
    expect(fitWithin(0, 100)).toEqual({ w: 0, h: 0 });
    expect(fitWithin(Number.NaN, 100)).toEqual({ w: 0, h: 0 });
  });

  it('baja la calidad y luego el tamaño hasta quedar por debajo de 400 KB', async () => {
    const calls: [number, number][] = [];
    // Un codificador falso: el peso depende de la escala y la calidad.
    const encode = async (scale: number, quality: number) => {
      calls.push([scale, quality]);
      return new Blob([new Uint8Array(Math.round(2_000_000 * scale * scale * quality))], { type: 'image/jpeg' });
    };
    const b = await shrink(encode);
    expect(b.size).toBeLessThanOrEqual(PHOTO_MAX_BYTES);
    expect(calls[0]).toEqual([1, 0.85]);
    expect(calls.at(-1)![0]).toBeLessThan(1);
  });

  it('si no hay forma de reducirla, falla en vez de guardar algo enorme', async () => {
    await expect(shrink(async () => new Blob([new Uint8Array(PHOTO_MAX_BYTES + 1)]))).rejects.toThrow();
    await expect(shrink(async () => null)).rejects.toThrow();
  });
});

describe('fotos de tickets: almacén local', () => {
  it('solo se aceptan imágenes JPEG o WebP en data: y de tamaño acotado', () => {
    expect(isPhotoData(JPEG)).toBe(true);
    expect(isPhotoData('data:image/webp;base64,AAAA')).toBe(true);
    expect(isPhotoData('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false);
    expect(isPhotoData('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isPhotoData('javascript:alert(1)')).toBe(false);
    expect(isPhotoData('blob:https://x/1')).toBe(false);
    expect(isPhotoData('data:image/jpeg;base64,AA"onerror="x')).toBe(false);
    expect(isPhotoData(`data:image/jpeg;base64,${'A'.repeat(MAX_PHOTO_CHARS)}`)).toBe(false);
    expect(isPhotoData(42)).toBe(false);
  });

  it('el almacén rechaza ids que no son de gastos y datos que no son fotos', async () => {
    const s = memoryPhotoStore();
    const id = crypto.randomUUID();
    const groupId = crypto.randomUUID();
    await s.put({ id, groupId, data: JPEG });
    await s.put({ id: `${id}~2026-10`, groupId, data: JPEG });
    await expect(s.put({ id: '__proto__', groupId, data: JPEG })).rejects.toThrow();
    await expect(s.put({ id, groupId, data: 'data:image/svg+xml;base64,AAAA' })).rejects.toThrow();
    expect(await s.get(id)).toBe(JPEG);
    expect((await s.list()).map((r) => r.id).sort()).toEqual([id, `${id}~2026-10`].sort());
    await s.remove([id]);
    expect(await s.get(id)).toBeNull();
    await s.clear();
    expect(await s.list()).toEqual([]);
  });

  it('sobran las fotos de gastos borrados o inexistentes, pero no las de grupos desconocidos', () => {
    let g = newGroup('Piso', ['Ana', 'Luis']);
    const [ana, luis] = g.members.map((m) => m.id) as [string, string];
    const gasto = { title: 'Súper', amount: 1000, paidBy: ana, split: { mode: 'equal' as const, among: [ana, luis] }, category: 'compra' as const, date: '2026-10-27' };
    g = addExpense(addExpense(g, gasto), gasto);
    const [vivo, borrado] = g.expenses.map((e) => e.id) as [string, string];
    g = deleteExpense(g, borrado);
    const otroGrupo = crypto.randomUUID();
    const fantasma = crypto.randomUUID();
    const list = [
      { id: vivo, groupId: g.id },
      { id: borrado, groupId: g.id },
      { id: fantasma, groupId: g.id },
      { id: crypto.randomUUID(), groupId: otroGrupo },
    ];
    expect(orphanPhotos(list, [g]).sort()).toEqual([borrado, fantasma].sort());
  });
});
