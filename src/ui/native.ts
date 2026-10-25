/**
 * Diferencias de la app de Android (Capacitor) respecto a la web.
 *
 * `NATIVE` es una constante de compilación (`vite build --mode android`): en el build web vale `false`, así que
 * todo lo que cuelga de ella (y los plugins de Capacitor) desaparece del paquete web.
 */
export const NATIVE = import.meta.env.MODE === 'android';

/** Dirección pública de la web. Dentro de la app el origen es `https://localhost`, que no sirve para compartir. */
export const PUBLIC_URL = 'https://bertmarti.github.io/repartito/';

/** Base para los enlaces que se comparten: siempre una dirección que cualquiera pueda abrir. */
export function appUrl(): string {
  return NATIVE ? PUBLIC_URL : location.origin + import.meta.env.BASE_URL;
}

/** ¿Hay un menú de compartir del sistema? (El WebView de Android no trae `navigator.share`.) */
export const canShare = (): boolean => NATIVE || typeof navigator.share === 'function';

/** Abre el menú de compartir del sistema con un texto y un enlace. */
export async function shareLink(title: string, text: string, url: string): Promise<void> {
  if (NATIVE) {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text, url, dialogTitle: title }).catch(() => undefined);
    return;
  }
  await navigator.share({ title, text, url }).catch(() => undefined);
}

/**
 * En la app no hay descargas: el archivo se escribe en la caché privada de la app y se ofrece con el menú de
 * compartir (guardar en Archivos o Drive, enviarlo por WhatsApp…). Nunca sale sin que la persona lo elija.
 */
export async function saveFileNative(filename: string, text: string): Promise<void> {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const { uri } = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
  await Share.share({ title: filename, files: [uri] }).catch(() => undefined);
}
