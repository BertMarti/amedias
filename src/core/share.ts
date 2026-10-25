/**
 * Compartir un grupo sin servidor: el grupo entero viaja en el fragmento «#» del enlace (los navegadores
 * nunca lo envían al servidor de la web), comprimido y, si se elige, cifrado con contraseña.
 *
 *   «1.<base64url(deflate(JSON))>»                         sin contraseña
 *   «1e.<base64url(salt16 ‖ iv12 ‖ AES-GCM(deflate(JSON)))>»   con contraseña (PBKDF2-SHA256 600 000 → AES-256-GCM)
 *
 * Al abrirlo se valida todo (validate.ts) y se fusiona con la copia local (merge.ts).
 */
import type { Group } from './types';
import { parseGroup } from './validate';

/**
 * Datos asociados de AES-GCM de los enlaces cifrados (protocolo v1). Es un identificador del protocolo, no la
 * marca: no cambia con el nombre de la app, para que los enlaces ya enviados se sigan abriendo.
 */
const AAD = 'amedias/1e';

export const MAX_PAYLOAD_CHARS = 1_500_000; // ~1,1 MB comprimidos: miles de gastos
export const MAX_JSON_BYTES = 8 * 1024 * 1024; // tope al descomprimir (contra bombas de descompresión)
export const QR_MAX_CHARS = 2000; // más largo no cabe en un QR legible
const ITER = 600_000;
const enc = new TextEncoder();

export class ShareError extends Error {
  constructor(
    readonly code: 'format' | 'too_large' | 'passphrase_required' | 'wrong_passphrase' | 'invalid' | 'unsupported',
    message: string,
  ) {
    super(message);
    this.name = 'ShareError';
  }
}

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) throw new ShareError('format', 'Enlace dañado');
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(data: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream, max: number): Promise<Uint8Array<ArrayBuffer>> {
  const reader = new Blob([data]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      throw new ShareError('too_large', 'Los datos son demasiado grandes');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let i = 0;
  for (const c of chunks) {
    out.set(c, i);
    i += c.length;
  }
  return out;
}

async function aesKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * ¿Sabe este navegador comprimir y descomprimir `deflate-raw`? (Safari < 16.4, Chrome < 103 y Firefox < 113 no.)
 * Sin esto, un enlace válido parecería dañado y la persona pediría otro que tampoco abriría.
 */
export function supportsLinks(): boolean {
  try {
    new DecompressionStream('deflate-raw');
    new CompressionStream('deflate-raw');
    return true;
  } catch {
    return false;
  }
}

const unsupported = () => new ShareError('unsupported', 'Este navegador es demasiado antiguo para los enlaces');

/** Grupo → texto para el fragmento del enlace. */
export async function encodeGroup(group: Group, passphrase?: string): Promise<string> {
  if (!supportsLinks()) throw unsupported();
  const deflated = await pipe(enc.encode(JSON.stringify(group)), new CompressionStream('deflate-raw'), MAX_JSON_BYTES);
  if (!passphrase) return `1.${b64url(deflated)}`;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(AAD) }, await aesKey(passphrase, salt), deflated),
  );
  const out = new Uint8Array(salt.length + iv.length + sealed.length);
  out.set(salt);
  out.set(iv, 16);
  out.set(sealed, 28);
  return `1e.${b64url(out)}`;
}

/** ¿El texto necesita contraseña? `null` si no parece un enlace de Repartito. */
export function payloadKind(payload: string): 'plain' | 'encrypted' | null {
  if (payload.startsWith('1.')) return 'plain';
  if (payload.startsWith('1e.')) return 'encrypted';
  return null;
}

/** Texto del fragmento → grupo validado. Lanza `ShareError` con un código para la interfaz. */
export async function decodeGroup(payload: string, passphrase?: string): Promise<Group> {
  if (payload.length > MAX_PAYLOAD_CHARS) throw new ShareError('too_large', 'El enlace es demasiado grande');
  const kind = payloadKind(payload);
  if (!kind) throw new ShareError('format', 'No es un enlace de Repartito');
  if (!supportsLinks()) throw unsupported();
  let bytes = fromB64url(payload.slice(kind === 'plain' ? 2 : 3));
  if (kind === 'encrypted') {
    if (!passphrase) throw new ShareError('passphrase_required', 'Este enlace tiene contraseña');
    if (bytes.length < 28 + 16) throw new ShareError('format', 'Enlace dañado');
    try {
      const key = await aesKey(passphrase, bytes.slice(0, 16));
      bytes = new Uint8Array(
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(16, 28), additionalData: enc.encode(AAD) }, key, bytes.slice(28)),
      );
    } catch {
      throw new ShareError('wrong_passphrase', 'Contraseña incorrecta o enlace dañado');
    }
  }
  let json: unknown;
  try {
    const raw = await pipe(bytes, new DecompressionStream('deflate-raw'), MAX_JSON_BYTES);
    json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
  } catch (e) {
    if (e instanceof ShareError) throw e;
    throw new ShareError('format', 'Enlace dañado');
  }
  try {
    return parseGroup(json);
  } catch {
    throw new ShareError('invalid', 'El enlace no contiene un grupo válido');
  }
}

/** Enlace completo para compartir. `base` = dirección de la app (p. ej. https://usuario.github.io/repartito/). */
export const shareUrl = (base: string, payload: string): string => `${base.replace(/#.*$/, '')}#g=${payload}`;

/** Extrae el payload de `location.hash` (`#g=…`), o `null`. */
export function payloadFromHash(hash: string): string | null {
  const m = /^#g=([A-Za-z0-9_.-]+)$/.exec(hash);
  return m ? m[1]! : null;
}
