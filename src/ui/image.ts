/**
 * Prepara la foto de un ticket: la reduce y la comprime en el propio dispositivo con un canvas (≤ 1600 px de lado
 * y ≤ 400 KB en JPEG). No sale nada a la red y no hace falta ninguna librería.
 */
import { isPhotoData } from './photos';

export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_MAX_BYTES = 400_000;
/** Una foto de móvil ronda los 3-12 MB; por encima de esto no se intenta ni abrir. */
export const PHOTO_MAX_INPUT = 40 * 1024 * 1024;

const SCALES = [1, 0.75, 0.5, 0.35];
const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45];

/** Tamaño que cabe en un cuadrado de `max` px sin deformar ni ampliar. */
export function fitWithin(w: number, h: number, max = PHOTO_MAX_SIDE): { w: number; h: number } {
  if (!(w > 0 && h > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/**
 * Prueba calidades de más a menos y, si no basta, tamaños más pequeños, hasta que la imagen quepa en `maxBytes`.
 * `encode(escala, calidad)` dibuja y codifica (en los tests, un falso).
 */
export async function shrink(encode: (scale: number, quality: number) => Promise<Blob | null>, maxBytes = PHOTO_MAX_BYTES): Promise<Blob> {
  for (const scale of SCALES) {
    for (const quality of QUALITIES) {
      const b = await encode(scale, quality);
      if (b && b.size > 0 && b.size <= maxBytes) return b;
    }
  }
  throw new Error('La foto no se puede reducir lo suficiente');
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => (typeof r.result === 'string' ? resolve(r.result) : reject(new Error('lectura')));
    r.onerror = () => reject(r.error ?? new Error('lectura'));
    r.readAsDataURL(blob);
  });
}

interface Decoded {
  source: CanvasImageSource;
  w: number;
  h: number;
  close: () => void;
}

/**
 * Abre la imagen sin URL `blob:` (la CSP no la admite): `createImageBitmap` lee el archivo directamente y respeta la
 * orientación de la cámara. Sin él, se carga como `data:`, que la CSP sí permite.
 */
async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const b = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: b, w: b.width, h: b.height, close: () => b.close() };
    } catch {
      /* algunos navegadores no entienden la opción: se prueba con la imagen */
    }
  }
  const url = await readAsDataUrl(file);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return { source: img, w: img.naturalWidth, h: img.naturalHeight, close: () => undefined };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/** De un archivo elegido por la persona a una imagen `data:image/jpeg` de ≤ 400 KB. */
export async function compressPhoto(file: Blob): Promise<string> {
  if (!file.type.startsWith('image/') || file.size === 0 || file.size > PHOTO_MAX_INPUT) throw new Error('No es una imagen');
  const img = await decode(file);
  try {
    const base = fitWithin(img.w, img.h);
    if (base.w === 0) throw new Error('Imagen vacía');
    const canvas = document.createElement('canvas');
    const blob = await shrink(async (scale, quality) => {
      const w = Math.max(1, Math.round(base.w * scale));
      const h = Math.max(1, Math.round(base.h * scale));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      // JPEG no tiene transparencia: fondo blanco (un PNG con transparencia saldría negro).
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img.source, 0, 0, w, h);
      const b = await toBlob(canvas, quality);
      return b && b.type === 'image/jpeg' ? b : null;
    });
    canvas.width = 0;
    canvas.height = 0;
    const data = await readAsDataUrl(blob);
    if (!isPhotoData(data)) throw new Error('Codificación inesperada');
    return data;
  } finally {
    img.close();
  }
}
