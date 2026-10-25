import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Política de contenido de la web publicada: solo recursos propios, sin scripts ni estilos en línea, sin
 * peticiones a terceros y con Trusted Types. GitHub Pages no permite cabeceras, así que va en <meta>.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
  "require-trusted-types-for 'script'",
  // Solo puede existir la política que registra el service worker (ni siquiera una `default`).
  'trusted-types amedias-sw',
].join('; ');

/** Solo en el build: el servidor de desarrollo de Vite inyecta scripts en línea que la CSP bloquearía. */
function csp(): Plugin {
  return {
    name: 'amedias-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    },
  };
}

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : [join(dir, d.name)]));
}

/**
 * Tras el build, escribe en dist/sw.js el SHA-256 de cada archivo publicado y una versión derivada de ellos.
 * El service worker no guarda ni sirve nada cuya huella no coincida, y cada despliegue estrena cachés.
 */
function swIntegrity(): Plugin {
  let outDir = 'dist';
  return {
    name: 'amedias-sw-integrity',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const sw = join(outDir, 'sw.js');
      const map: Record<string, string> = {};
      for (const f of files(outDir).sort()) {
        if (f === sw) continue;
        map[relative(outDir, f).split(sep).join('/')] = createHash('sha256').update(readFileSync(f)).digest('hex');
      }
      const version = createHash('sha256').update(JSON.stringify(map)).digest('hex').slice(0, 12);
      const src = readFileSync(sw, 'utf8');
      const out = src.replace("const VERSION = 'dev';", `const VERSION = '${version}';`).replace('const INTEGRITY = {};', `const INTEGRITY = ${JSON.stringify(map)};`);
      if (out === src || !out.includes(version)) throw new Error('sw.js: no se encontraron VERSION/INTEGRITY para inyectar');
      writeFileSync(sw, out);
    },
  };
}

// GitHub Pages sirve la app en /amedias/.
export default defineConfig({
  base: '/amedias/',
  plugins: [react(), csp(), swIntegrity()],
  build: {
    target: 'es2022',
    sourcemap: false,
    // Sin `data:` en línea: la CSP solo permite recursos propios.
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
