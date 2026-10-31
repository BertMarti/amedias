/**
 * Idiomas de la interfaz y cómo se elige el primero: el que la persona tenga en el dispositivo, si lo tenemos.
 * Después manda lo que elija en Ajustes (se guarda con el resto de preferencias).
 */

/** En el orden en que se ofrecen en Ajustes. */
export const LANGS = ['es', 'ca', 'gl', 'pt', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export const isLang = (x: unknown): x is Lang => typeof x === 'string' && (LANGS as readonly string[]).includes(x);

/** Locale de `Intl` (dinero, fechas, números) y de `<html lang>`. */
export const LOCALES: Record<Lang, string> = { es: 'es-ES', ca: 'ca-ES', gl: 'gl-ES', pt: 'pt-PT', en: 'en-GB' };

/**
 * Idiomas del dispositivo que aún no tenemos y cuya gente lee mejor otro de los nuestros. El euskera está pendiente
 * de una revisión nativa (PLAN.md); mientras tanto, español, como el asturiano y el aragonés.
 */
const CLOSEST: Record<string, Lang> = { eu: 'es', ast: 'es', an: 'es' };

/**
 * Primer idioma de la lista (`navigator.languages`, por orden de preferencia) que la app sabe hablar. `ca-ES-valencia`
 * da catalán y `pt-BR`, portugués de Portugal. Si no coincide ninguno, inglés; sin lista, español.
 */
export function detectLang(tags: readonly string[]): Lang {
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const primary = tag.trim().toLowerCase().split(/[-_]/)[0] ?? '';
    if (isLang(primary)) return primary;
    // `hasOwn`: una etiqueta «constructor» no puede sacar `Object` de la cadena de prototipos.
    if (Object.hasOwn(CLOSEST, primary)) return CLOSEST[primary]!;
  }
  return tags.some((x) => typeof x === 'string' && x.trim() !== '') ? 'en' : 'es';
}

/** Idiomas preferidos del navegador o del WebView de Android (vacío si no hay `navigator`). */
export function deviceLanguages(): string[] {
  try {
    if (typeof navigator === 'undefined') return [];
    const list = navigator.languages?.length ? navigator.languages : [navigator.language];
    return list.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}
