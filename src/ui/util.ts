/** Utilidades de interfaz (sin estado). Nada de aquí hace peticiones de red. */
import { balances, liveExpenses, payloadFromHash, payloadKind, today, type Expense, type Group, type Id, type Member } from '../core';
import { NATIVE, saveFileNative } from './native';

/** Tope para leer archivos que elige la persona (copias, CSV). */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const activeMembers = (g: Group): Member[] => g.members.filter((m) => !m.deleted);

export function memberName(g: Group, id: Id): string {
  return g.members.find((m) => m.id === id)?.name ?? '?';
}

export const currentMonth = (): string => today().slice(0, 7);

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

/** Nombre de archivo seguro: «Piso Lavapiés» → «piso-lavapies». */
export function fileSlug(name: string): string {
  const s = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return s || 'grupo';
}

/** Descarga un texto como archivo (Blob local; nada sale del dispositivo). En la app, menú de compartir. */
export function downloadText(filename: string, text: string, type: string): void {
  if (NATIVE) {
    void saveFileNative(filename, text);
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* sin permiso: probamos el método antiguo */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.className = 'offscreen';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Color estable para cada persona (índice de la paleta de avatares). */
export function memberHue(id: Id): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 8;
}

export function initial(name: string): string {
  const ch = [...name.trim()][0] ?? '?';
  return ch.toLocaleUpperCase();
}

/** Sin letras ni cifras que se confundan al dictar (i/l/1, o/0). 31 símbolos. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/**
 * Contraseña para los enlaces: cuatro bloques de cuatro símbolos al azar criptográfico (≈ 79 bits). Con
 * PBKDF2 de 600 000 vueltas, probarlas todas con tarjetas gráficas llevaría muchísimo más que la vida útil de
 * un enlace. Se descartan los valores que darían sesgo (muestreo por rechazo).
 */
export function generatePassphrase(): string {
  const out: string[] = [];
  const limit = 256 - (256 % ALPHABET.length);
  while (out.length < 16) {
    for (const b of crypto.getRandomValues(new Uint8Array(32))) {
      if (b < limit && out.length < 16) out.push(ALPHABET[b % ALPHABET.length]!);
    }
  }
  return [0, 4, 8, 12].map((i) => out.slice(i, i + 4).join('')).join('-');
}

/** Admite un enlace completo, un fragmento `#g=…` o el payload a pelo. */
export function extractPayload(text: string): string | null {
  const t = text.trim();
  const i = t.indexOf('#g=');
  if (i !== -1) return payloadFromHash(t.slice(i));
  return payloadKind(t) && /^[A-Za-z0-9_.-]+$/.test(t) ? t : null;
}

export function isSettled(g: Group): boolean {
  return Object.values(balances(g)).every((v) => v === 0);
}

/** ¿Aparece la persona en algún gasto vivo o gasto fijo activo? (si es así, no se puede quitar). */
export function memberInUse(g: Group, id: Id): boolean {
  const inSplit = (s: Group['expenses'][number]['split']) =>
    s.mode === 'equal'
      ? s.among.includes(id)
      : Object.keys(s.mode === 'exact' ? s.amounts : s.mode === 'shares' ? s.shares : s.basisPoints).includes(id);
  if (liveExpenses(g).some((e) => e.paidBy === id || inSplit(e.split))) return true;
  const ym = currentMonth();
  return g.recurring.some((r) => !r.deleted && (!r.endMonth || r.endMonth >= ym) && (r.paidBy === id || inSplit(r.split)));
}

export function vibrate(ms = 12): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no disponible */
  }
}

/** Personas que se pueden elegir: las activas y las (ya borradas) que aparecen en este gasto. */
export function eligibleMembers(group: Group, e?: Pick<Expense, 'paidBy' | 'split'>): Member[] {
  if (!e) return activeMembers(group);
  const ids = new Set([e.paidBy, ...(e.split.mode === 'equal' ? e.split.among : Object.keys(e.split.mode === 'exact' ? e.split.amounts : e.split.mode === 'shares' ? e.split.shares : e.split.basisPoints))]);
  return group.members.filter((m) => !m.deleted || ids.has(m.id));
}
