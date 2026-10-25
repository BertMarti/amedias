/* global self, caches, fetch, URL, Response, crypto */
/*
 * Service worker de Repartito, escrito a mano.
 *
 * - Solo GET y solo dentro de su ámbito (/repartito/): nunca toca nada de otras rutas ni de otros orígenes.
 * - Al instalar guarda la app (index.html, manifest, icono) y los archivos con hash que enlaza index.html,
 *   incluidas sus fuentes, para que la app funcione sin conexión desde la primera visita.
 * - Navegación: primero la red (para recibir versiones nuevas) y, sin conexión, la copia guardada.
 * - /assets/ (nombres con hash, inmutables): primero la caché.
 * - Al activar borra las cachés de versiones anteriores.
 * - Integridad: al compilar se inyecta aquí el SHA-256 de cada archivo publicado (INTEGRITY) y una versión
 *   derivada de ellos. Nada se guarda ni se sirve desde la caché si su huella no coincide: otra página del
 *   mismo origen (bertmarti.github.io) podría escribir en la Cache API, pero no colar un script.
 *
 * Los datos de los grupos nunca pasan por aquí: viven en localStorage y en el fragmento # (que no se envía).
 */
// Ambas constantes las reescribe el build (plugin `sw-integrity` de vite.config.ts).
const VERSION = 'dev';
const INTEGRITY = {};
const SHELL_CACHE = `repartito-shell-${VERSION}`;
const ASSET_CACHE = `repartito-assets-${VERSION}`;
const MAX_ASSETS = 80;
const SCOPE = self.registration.scope; // p. ej. https://bertmarti.github.io/repartito/
const ASSETS_PREFIX = new URL('assets/', SCOPE).href;
const INDEX = new URL('./', SCOPE).href;
const SHELL = [INDEX, new URL('manifest.webmanifest', SCOPE).href, new URL('icon.svg', SCOPE).href];

const inScope = (url) => url.startsWith(SCOPE);
const cacheable = (res) => res && res.ok && res.type === 'basic';

/** Huella esperada de una URL del ámbito (ruta relativa a /repartito/; la raíz es index.html). */
function expected(url) {
  const path = new URL(url).pathname.slice(new URL(SCOPE).pathname.length) || 'index.html';
  return Object.prototype.hasOwnProperty.call(INTEGRITY, path) ? INTEGRITY[path] : null;
}

async function sha256(res) {
  const buf = await crypto.subtle.digest('SHA-256', await res.clone().arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** ¿Es esta respuesta exactamente el archivo publicado para `url`? */
async function intact(url, res) {
  const want = expected(url);
  return !!res && want !== null && (await sha256(res)) === want;
}

/** Guarda solo copias íntegras. */
async function putIntact(cache, url, res) {
  if (cacheable(res) && (await intact(url, res))) await cache.put(url, res.clone());
}

/** Lee de la caché solo si lo guardado sigue siendo íntegro (si no, lo borra). */
async function matchIntact(cache, url) {
  const hit = await cache.match(url);
  if (!hit) return null;
  if (await intact(url, hit)) return hit;
  await cache.delete(url);
  return null;
}

/** URLs de /assets/ que aparecen en un texto (index.html o CSS). */
function assetUrls(text, base) {
  const out = new Set();
  const re = /(?:src|href)="([^"]+)"|url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[1] || m[2];
    if (!raw || raw.startsWith('data:')) continue;
    const abs = new URL(raw, base).href;
    if (abs.startsWith(ASSETS_PREFIX)) out.add(abs);
  }
  return [...out];
}

async function precache() {
  const shell = await caches.open(SHELL_CACHE);
  const assets = await caches.open(ASSET_CACHE);
  const indexRes = await fetch(INDEX, { cache: 'reload' });
  if (!cacheable(indexRes)) throw new Error('index.html no disponible');
  const html = await indexRes.clone().text();
  await putIntact(shell, INDEX, indexRes);
  await Promise.all(
    SHELL.slice(1).map(async (url) => {
      const res = await fetch(url, { cache: 'reload' }).catch(() => null);
      await putIntact(shell, url, res);
    }),
  );
  const first = assetUrls(html, INDEX);
  const fonts = [];
  await Promise.all(
    first.map(async (url) => {
      const res = await fetch(url).catch(() => null);
      if (!cacheable(res)) return;
      if (url.endsWith('.css')) {
        // Fuentes latinas que usa la hoja de estilos (las demás se guardan si llegan a pedirse).
        for (const f of assetUrls(await res.clone().text(), url)) if (/latin/.test(f)) fonts.push(f);
      }
      await putIntact(assets, url, res);
    }),
  );
  await Promise.all(
    fonts.map(async (url) => {
      const res = await fetch(url).catch(() => null);
      await putIntact(assets, url, res);
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => /^(repartito|amedias)-/.test(k) && k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}

async function fromAssets(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await matchIntact(cache, request.url);
  if (hit) return hit;
  const res = await fetch(request);
  await putIntact(cache, request.url, res);
  trim(cache);
  return res;
}

/** Navegación: la red primero. Solo la propia app (index.html íntegro) se guarda como copia sin conexión. */
async function navigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (new URL(request.url).pathname === new URL(INDEX).pathname) await putIntact(cache, INDEX, res);
    return res;
  } catch {
    return (await matchIntact(cache, INDEX)) || Response.error();
  }
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (SHELL.includes(request.url)) await putIntact(cache, request.url, res);
    return res;
  } catch {
    return (await matchIntact(cache, request.url)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !inScope(request.url) || request.headers.has('range')) return;
  if (request.mode === 'navigate') event.respondWith(navigation(request));
  else if (request.url.startsWith(ASSETS_PREFIX)) event.respondWith(fromAssets(request));
  else event.respondWith(networkFirst(request));
});
