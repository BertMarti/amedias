# MEMORY.md · Repartito
Última actualización: 2026-10-25 por lead (v0.2.0)

Memoria compartida entre agentes: estado, decisiones y trampas. Lo estable está en [AGENTS.md](AGENTS.md);
la hoja de ruta, en [PLAN.md](PLAN.md).

## Estado

- v0.1.0 completa: 82 tests (69 de dominio, 13 de interfaz), lint y tipos limpios, `npm audit` sin avisos.
- Probada a mano en el navegador a 320 y 375 px, tema oscuro, inglés, sin conexión, enlaces con y sin contraseña y fusión.
- Auditoría independiente (Fable): 1 alto, 5 medios y varios bajos; todo corregido con tests `F1`…`F15` (ver MODELO_DE_AMENAZAS).

## Decisiones (y por qué)

- **Elección del producto**: búsqueda de necesidades (oct. 2026). Splitwise limita su plan gratis a 3-4 gastos al día, con esperas y anuncios. En España no aparece ninguna alternativa gratis, sin anuncios y sin registro. Lo más pedido en apps de productividad es un modo sin conexión que funcione de verdad.
- **Sin servidor**: GitHub Pages es gratis para siempre y no hay datos de nadie que proteger en un servidor. La colaboración va por enlace más fusión.
- **Fusión LWW + lápidas** (último que escribe gana, con borrados marcados): es suficiente para gastos (pocas ediciones concurrentes del mismo gasto) y es fácil de demostrar conmutativa, asociativa e idempotente.
- **Ids deterministas en gastos fijos** (`<id>~AAAA-MM`) con el `updatedAt` del fijo: no se duplican entre móviles, gana la versión más reciente del fijo y cualquier edición manual gana a ambas. Solo valen si el fijo existe y el mes no pasa de +2.
- **Ediciones monótonas**: `updatedAt = max(ahora, anterior + 1)`. Enlaces con ediciones a más de 24 h vista se rechazan (`incomingProblem`).
- **Nada se guarda sin `revalidate`**: fusiones, importaciones, gastos fijos y ediciones pasan otra vez `parseGroup`; si no, el grupo «desaparecería» al reabrir.
- **Service worker con huellas**: el plugin `swIntegrity` (vite.config.ts) inyecta el SHA-256 de cada archivo de `dist/` y la versión en `sw.js`. Mismo origen que otras webs del autor → la Cache API es compartida.
- **Contraseña generada**: 4×4 símbolos de un alfabeto de 31 sin ambigüedades (≈ 79 bits), con muestreo por rechazo.
- **Importar Splitwise**: su CSV trae el efecto neto por persona. Un pagador → gasto con reparto exacto. Varios pagadores o «Payment» → pares deudor→acreedor. Los saldos quedan idénticos (test).
- **`parseAmount`**: el último separador es decimal solo si le siguen 1-2 cifras; con 3 es de miles («1.234» = 1234). Rechaza separadores seguidos.
- **Validación**: los ids deben ser UUID, lo que bloquea por diseño claves como `__proto__`; el emoji solo admite emojis; topes de 50 personas, 20 000 gastos, 120 caracteres por texto y 1e9 céntimos.
- **Enlaces**: `#g=1.` sin contraseña o `#g=1e.` con ella (PBKDF2 600 000 + AES-GCM con AAD). Tope de 1,5 MB de texto y de 8 MB al descomprimir.
- **App de Android con Capacitor 8** (v0.2.0): misma base de código; `NATIVE` es constante de compilación (`--mode android`) y en la web los plugins se cambian por `native-stub.ts`. Origen propio `https://localhost` (resuelve I6/I7 en la app), sin permisos, `allowBackup=false`, `loggingBehavior: none`. Los enlaces siempre usan `PUBLIC_URL`.
- **Firma**: PKCS#12 RSA 4096, alias `repartito`, huella SHA-256 fijada en `android.yml` (`CERT_SHA256`) (fijada en `android.yml`). Secretos en el entorno `android-release` (solo etiquetas `v*`). Copia de la clave fuera del repo, en el equipo del autor: sin ella no se puede actualizar la app instalada.
- **Versión de Android** = `package.json` (`x.y.z` → versionCode `x*10000+y*100+z`).
- **Prueba de la app**: emulador API 35 en el CI y `scripts/android-e2e.mjs` por DevTools (solo los APK de depuración permiten inspeccionar el WebView).
- **Coordinación**: el repo de perfil `BertMarti` (README y `site/`) lo gestiona la sesión «Revisión de repositorios GitHub». A ella se le pasan las capturas `.webp` de 640×400 y los textos, sin dominios reales, IPs ni emails.

## Trampas conocidas

- GitHub Pages no permite cabeceras propias: la CSP va en `<meta>` (no admite `frame-ancestors`).
- Las rutas de la SPA no existen en Pages (404): la navegación es por estado interno con `pushState` en la misma URL.
- happy-dom: `CompressionStream` y Web Crypto vienen de Node 24 (por eso se usa `./dk.sh` con un Node local antiguo).
- `eslint-disable-next-line` tiene que ir justo encima de la línea: un comentario en medio lo anula.
- El Chromium sin cabeza del equipo de desarrollo no tiene fuente de emojis: las capturas del README evitan pantallas con emoji.
- La demo no llama «Tú» a nadie («Marta pagó a Tú»): usa «Alex» y la app marca «(tú)».
- Con `bash -e`, una línea `! comando` en mitad de un paso de Actions **no** hace fallar el paso: solo cuenta si es la última línea. Usa `if …; then exit 1; fi`.
- En el equipo de desarrollo (arm64) no hay SDK de Android: el APK solo se compila en el CI (rama + PR).
- `sw.js` en `public/` lleva `VERSION = 'dev'` e `INTEGRITY = {}`: sin build no cachea nada. El CI comprueba que el build los reescribe.

## Tras publicar (2026-10-25)

- Repo público `BertMarti/repartito`, Pages desplegado desde Actions y release v0.1.0. CI, CodeQL, Scorecard y despliegue en verde.
- Build reproducible: la `VERSION` del service worker publicada coincide con la del build local.
- Comprobado en la web publicada: CSP con `trusted-types repartito-sw`, service worker activo con cachés verificadas, consola limpia.
- CodeQL avisó de `js/unvalidated-dynamic-method-call` en `scripts/brand/render.mjs` (herramienta local): corregido.
- Avisos de Scorecard aceptados por ahora (proyecto de una persona): protección de rama, revisión de código, fuzzing, insignia CII.
- Tarjetas 640×400 para el perfil enviadas a la sesión «Revisión de repositorios GitHub», que las publica con su propia PR.

## v0.2.0 publicada (2026-10-25)

- **Nuevo nombre, Repartito**, por las apps «A medias» ya existentes en App Store y Google Play. Repo renombrado a `BertMarti/repartito` (GitHub redirige el antiguo); web en `/repartito/` (la ruta `/amedias/` da 404).
- Release v0.2.0 con `repartito-v0.2.0.apk`, `.aab` y `SHA256SUMS.txt`: firmados en el entorno `android-release`, huella del certificado verificada en el CI, atestaciones de procedencia comprobadas por la API.
- Web publicada comprobada: service worker en `/repartito/`, cachés `amedias-*` antiguas borradas, consola limpia.
- El `gh` del equipo de desarrollo (2.46) no tiene `gh attestation`: se comprueba con `gh api repos/BertMarti/repartito/attestations/sha256:<huella>`.
- Pendiente (PLAN v0.3): App Links para abrir los `#g=` en la app (necesita `assetlinks.json` en la raíz del dominio) y Google Play (cuenta de desarrollador del autor).

## v0.2.1 publicada (2026-10-26)

- Hallazgos de la revisión externa P1-P4 corregidos con tests (PR #2). Release con APK/AAB firmados (misma huella de certificado que la v0.2.0, así que se instala encima) y atestaciones comprobadas.
