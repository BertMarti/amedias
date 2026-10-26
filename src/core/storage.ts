/**
 * Guardado local (localStorage). Nada sale del dispositivo salvo que la persona comparta un enlace o un
 * archivo. Lo que se lee se vuelve a validar: el almacenamiento también puede estar dañado o manipulado.
 */
import type { Group } from './types';
import { parseGroup } from './validate';

const PREFIX = 'repartito:v1:';
const KEY = `${PREFIX}grupos`;
const SETTINGS = `${PREFIX}ajustes`;
/** Prefijo de la v0.1.0, cuando la app se llamaba «a medias» (mismo origen en GitHub Pages). */
const LEGACY_PREFIX = 'amedias:v1:';

/** Borra los restos del nombre antiguo (los que la migración no movió porque ya existía la clave nueva). */
export function clearLegacyStorage(storage: Storage = localStorage): void {
  try {
    for (const k of Object.keys(storage).filter((x) => x.startsWith(LEGACY_PREFIX))) storage.removeItem(k);
  } catch {
    /* sin acceso: nada que borrar */
  }
}

/**
 * Pasa los datos guardados con el nombre antiguo al nuevo, sin pisar nada: si la clave nueva ya existe, la
 * antigua se deja como está. Devuelve cuántas claves movió.
 */
export function migrateLegacyStorage(storage: Storage = localStorage): number {
  let moved = 0;
  try {
    for (const k of Object.keys(storage).filter((x) => x.startsWith(LEGACY_PREFIX))) {
      const target = PREFIX + k.slice(LEGACY_PREFIX.length);
      const value = storage.getItem(k);
      if (value === null || storage.getItem(target) !== null) continue;
      storage.setItem(target, value);
      storage.removeItem(k);
      moved++;
    }
  } catch {
    /* sin acceso o sin espacio: se queda como estaba */
  }
  return moved;
}

export interface Settings {
  lang: 'es' | 'en';
  theme: 'auto' | 'light' | 'dark';
  lastGroup?: string;
  /** Mi nombre en cada grupo (id de grupo → id de persona), para «tú debes / te deben». */
  me: Record<string, string>;
}

const DEFAULT_SETTINGS: Settings = { lang: 'es', theme: 'auto', me: {} };

export interface LoadResult {
  groups: Group[];
  /** Grupos que no pasaron la validación (se conservan en bruto para no perderlos). */
  damaged: number;
}

export function loadGroups(storage: Storage = localStorage): LoadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(storage.getItem(KEY) ?? '[]');
  } catch {
    return { groups: [], damaged: 1 };
  }
  if (!Array.isArray(raw)) return { groups: [], damaged: 1 };
  const groups: Group[] = [];
  let damaged = 0;
  for (const g of raw) {
    try {
      groups.push(parseGroup(g));
    } catch {
      damaged++;
    }
  }
  return { groups, damaged };
}

export class StorageFullError extends Error {
  constructor() {
    super('No queda espacio en este navegador');
    this.name = 'StorageFullError';
  }
}

export function saveGroups(groups: Group[], storage: Storage = localStorage): void {
  try {
    storage.setItem(KEY, JSON.stringify(groups));
  } catch {
    throw new StorageFullError();
  }
}

export function loadSettings(storage: Storage = localStorage): Settings {
  try {
    const s = JSON.parse(storage.getItem(SETTINGS) ?? '{}') as Partial<Settings>;
    const me: Record<string, string> = {};
    if (s.me && typeof s.me === 'object') {
      for (const [g, m] of Object.entries(s.me)) if (/^[0-9a-f-]{36}$/.test(g) && /^[0-9a-f-]{36}$/.test(String(m))) me[g] = String(m);
    }
    return {
      lang: s.lang === 'en' ? 'en' : 'es',
      theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'auto',
      ...(typeof s.lastGroup === 'string' && /^[0-9a-f-]{36}$/.test(s.lastGroup) ? { lastGroup: s.lastGroup } : {}),
      me,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings, storage: Storage = localStorage): void {
  try {
    storage.setItem(SETTINGS, JSON.stringify(settings));
  } catch {
    /* preferencias: no es grave si no caben */
  }
}

/** Copia de seguridad completa (todos los grupos) como JSON. */
export function backupJson(groups: Group[]): string {
  return JSON.stringify({ app: 'repartito', v: 1, exportedAt: new Date().toISOString(), groups }, null, 1);
}

/** Lee una copia de seguridad o un grupo suelto exportado. Valida cada grupo. */
export function readBackup(text: string): Group[] {
  if (text.length > 20 * 1024 * 1024) throw new Error('El archivo es demasiado grande');
  const data = JSON.parse(text) as unknown;
  const list = Array.isArray((data as { groups?: unknown })?.groups) ? (data as { groups: unknown[] }).groups : [data];
  if (list.length > 200) throw new Error('Demasiados grupos');
  return list.map((g) => parseGroup(g));
}
