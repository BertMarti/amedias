/** Conexión, instalación como app y service worker. */
import { useSyncExternalStore } from 'react';

/* ---------- ¿Hay conexión? ---------- */

function subscribeOnline(fn: () => void) {
  window.addEventListener('online', fn);
  window.addEventListener('offline', fn);
  return () => {
    window.removeEventListener('online', fn);
    window.removeEventListener('offline', fn);
  };
}

export const useOnline = (): boolean =>
  useSyncExternalStore(subscribeOnline, () => navigator.onLine !== false, () => true);

/* ---------- «Instalar app» (beforeinstallprompt, Chrome/Android) ---------- */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
const notify = () => installListeners.forEach((l) => l());

/** Se llama desde main.tsx lo antes posible: el evento puede llegar antes de que React monte. */
export function listenForInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

function subscribeInstall(fn: () => void) {
  installListeners.add(fn);
  return () => {
    installListeners.delete(fn);
  };
}

export function useInstallPrompt(): { available: boolean; install: () => Promise<boolean> } {
  const available = useSyncExternalStore(subscribeInstall, () => deferred !== null, () => false);
  return {
    available,
    install: async () => {
      const ev = deferred;
      if (!ev) return false;
      await ev.prompt();
      const { outcome } = await ev.userChoice;
      deferred = null;
      notify();
      return outcome === 'accepted';
    },
  };
}

/* ---------- Service worker ---------- */

interface TrustedTypesLike {
  createPolicy: (name: string, rules: { createScriptURL: (url: string) => string }) => { createScriptURL: (url: string) => unknown };
}

/**
 * Registra `sw.js` (solo en producción). Con `require-trusted-types-for 'script'` la URL del service
 * worker debe ser un TrustedScriptURL: una política mínima que solo acepta exactamente esa URL.
 */
export function registerServiceWorker(base: string): void {
  if (!('serviceWorker' in navigator)) return;
  const url = `${base}sw.js`;
  const tt = (window as unknown as { trustedTypes?: TrustedTypesLike }).trustedTypes;
  let scriptUrl: unknown = url;
  try {
    if (tt) {
      scriptUrl = tt
        .createPolicy('amedias-sw', {
          createScriptURL: (u) => {
            if (u !== url) throw new TypeError('URL de service worker no permitida');
            return u;
          },
        })
        .createScriptURL(url);
    }
  } catch {
    return;
  }
  const start = () => {
    navigator.serviceWorker
      .register(scriptUrl as string, { scope: base, updateViaCache: 'none' })
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        // Precalienta el trozo del QR para que también funcione sin conexión.
        setTimeout(() => void import('qrcode').catch(() => undefined), 4000);
      })
      .catch(() => undefined);
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
