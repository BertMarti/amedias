/**
 * Fotos de tickets, guardadas SOLO en este dispositivo (IndexedDB), con el id del gasto como clave.
 *
 * Nunca forman parte del grupo: no viajan en los enlaces, ni en las copias de seguridad, ni en el CSV, y el JSON
 * del gasto no cambia. Se borran al borrar el gasto (también si el borrado llega al fusionar), el grupo o
 * todos los datos. Lo que se lee se vuelve a comprobar: solo se enseñan imágenes JPEG o WebP en `data:`.
 */
import { useSyncExternalStore } from 'react';
import type { Group } from '../core';

export interface PhotoRecord {
  /** Id del gasto. */
  id: string;
  groupId: string;
  /** `data:image/jpeg;base64,…` (o WebP). La CSP solo admite imágenes propias o `data:`. */
  data: string;
}

/** Lo mínimo que necesita la app. En los tests se cambia por `memoryPhotoStore`. */
export interface PhotoStore {
  get(id: string): Promise<string | null>;
  put(record: PhotoRecord): Promise<void>;
  remove(ids: readonly string[]): Promise<void>;
  /** Qué fotos hay, sin cargar las imágenes. */
  list(): Promise<{ id: string; groupId: string }[]>;
  clear(): Promise<void>;
}

/** ~400 KB de JPEG en base64 son ~540 000 caracteres: con margen, nada por encima de 700 000. */
export const MAX_PHOTO_CHARS = 700_000;
const PHOTO_DATA = /^data:image\/(?:jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export const isPhotoData = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_PHOTO_CHARS && PHOTO_DATA.test(v);

const UUIDISH = /^[0-9a-f-]{36}(?:~\d{4}-\d{2})?$/;

/* ---------- IndexedDB ---------- */

const DB_NAME = 'repartito-fotos';
const STORE = 'fotos';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB'));
  });
}

export function idbPhotoStore(factory: IDBFactory = indexedDB): PhotoStore {
  let db: Promise<IDBDatabase> | null = null;
  const open = () => {
    db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const r = factory.open(DB_NAME, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' }).createIndex('groupId', 'groupId');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error ?? new Error('IndexedDB'));
      r.onblocked = () => reject(new Error('IndexedDB bloqueada'));
    }).catch((e: unknown) => {
      db = null; // otro intento la próxima vez
      throw e;
    });
    return db;
  };
  const tx = async (mode: IDBTransactionMode) => (await open()).transaction(STORE, mode);
  return {
    async get(id) {
      const rec = (await req((await tx('readonly')).objectStore(STORE).get(id))) as unknown;
      const data = typeof rec === 'object' && rec !== null ? (rec as { data?: unknown }).data : undefined;
      return isPhotoData(data) ? data : null;
    },
    async put({ id, groupId, data }) {
      if (!UUIDISH.test(id) || !UUIDISH.test(groupId) || !isPhotoData(data)) throw new Error('Foto no válida');
      const t = await tx('readwrite');
      t.objectStore(STORE).put({ id, groupId, data });
      await done(t);
    },
    async remove(ids) {
      if (ids.length === 0) return;
      const t = await tx('readwrite');
      const s = t.objectStore(STORE);
      for (const id of ids) s.delete(id);
      await done(t);
    },
    async list() {
      // Recorre el índice solo con claves: no carga ninguna imagen en memoria.
      const out: { id: string; groupId: string }[] = [];
      const cursor = (await tx('readonly')).objectStore(STORE).index('groupId').openKeyCursor();
      await new Promise<void>((resolve, reject) => {
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (!c) return resolve();
          if (typeof c.primaryKey === 'string' && typeof c.key === 'string') out.push({ id: c.primaryKey, groupId: c.key });
          c.continue();
        };
        cursor.onerror = () => reject(cursor.error ?? new Error('IndexedDB'));
      });
      return out;
    },
    async clear() {
      const t = await tx('readwrite');
      t.objectStore(STORE).clear();
      await done(t);
    },
  };
}

/** Almacén en memoria con el mismo contrato (tests, o navegadores sin IndexedDB si algún día hiciera falta). */
export function memoryPhotoStore(): PhotoStore & { records: Map<string, PhotoRecord> } {
  const records = new Map<string, PhotoRecord>();
  return {
    records,
    get: async (id) => {
      const d = records.get(id)?.data;
      return isPhotoData(d) ? d : null;
    },
    put: async (r) => {
      if (!UUIDISH.test(r.id) || !UUIDISH.test(r.groupId) || !isPhotoData(r.data)) throw new Error('Foto no válida');
      records.set(r.id, { ...r });
    },
    remove: async (ids) => {
      for (const id of ids) records.delete(id);
    },
    list: async () => [...records.values()].map(({ id, groupId }) => ({ id, groupId })),
    clear: async () => records.clear(),
  };
}

/* ---------- El almacén de la app ---------- */

let current: PhotoStore | null | undefined;

/** El almacén de fotos, o `null` si el navegador no tiene IndexedDB (entonces no se ofrece adjuntar fotos). */
export function photos(): PhotoStore | null {
  if (current === undefined) current = typeof indexedDB === 'undefined' ? null : idbPhotoStore();
  return current;
}

/** Solo para tests. */
export function setPhotoStore(s: PhotoStore | null): void {
  current = s;
  known = new Set();
}

/* ---------- Qué gastos tienen foto (para el icono de la lista) ---------- */

let known: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

export async function refreshPhotoIds(): Promise<void> {
  const s = photos();
  if (!s) return;
  try {
    known = new Set((await s.list()).map((r) => r.id));
  } catch {
    known = new Set();
  }
  for (const l of listeners) l();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const usePhotoIds = (): ReadonlySet<string> => useSyncExternalStore(subscribe, () => known, () => known);

/* ---------- Operaciones (siempre refrescan la lista) ---------- */

async function run(fn: (s: PhotoStore) => Promise<unknown>): Promise<void> {
  const s = photos();
  if (!s) return;
  try {
    await fn(s);
  } finally {
    await refreshPhotoIds();
  }
}

export const savePhoto = (r: PhotoRecord): Promise<void> => run((s) => s.put(r));

export const deletePhotos = (ids: readonly string[]): Promise<void> => (ids.length ? run((s) => s.remove(ids)) : Promise.resolve());

export const clearPhotos = (): Promise<void> => run((s) => s.clear());

export const removeGroupPhotos = (groupId: string): Promise<void> =>
  run(async (s) => s.remove((await s.list()).filter((r) => r.groupId === groupId).map((r) => r.id)));

/**
 * Fotos que sobran: las de gastos borrados o que ya no existen en su grupo (p. ej. un borrado que llegó al
 * fusionar). Las de grupos que no conocemos no se tocan: puede ser un grupo apartado por dañado.
 */
export function orphanPhotos(list: readonly { id: string; groupId: string }[], groups: readonly Group[]): string[] {
  const byId = new Map(groups.map((g) => [g.id, new Set(g.expenses.filter((e) => !e.deleted).map((e) => e.id))]));
  return list.filter((r) => byId.has(r.groupId) && !byId.get(r.groupId)!.has(r.id)).map((r) => r.id);
}

export const prunePhotos = (groups: readonly Group[]): Promise<void> => run(async (s) => s.remove(orphanPhotos(await s.list(), groups)));
