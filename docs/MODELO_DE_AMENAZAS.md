# Modelo de amenazas

«a medias» es una web estática (GitHub Pages) sin servidor propio ni cuentas. Los datos viven en el
navegador de cada persona. Análisis STRIDE de lo que sí puede salir mal.

## Activos

1. Los gastos de cada grupo (quién paga qué, cuánto, conceptos): datos personales y económicos.
2. La integridad de los saldos (que nadie «cuele» deudas).
3. La disponibilidad de la app en el móvil (que un enlace no la rompa).

## Actores

| Actor | Capacidades |
|---|---|
| Alguien que te envía un enlace o archivo malicioso | Controla por completo su contenido. |
| Quien intercepta un enlace | Lo lee si no tiene contraseña. |
| Un paquete npm o una action comprometidos | Ejecutan código en el build o en el CI. |
| Otra web | Intenta enmarcar la app o leer sus datos. |
| Otra web del mismo origen (`bertmarti.github.io/*`) | Comparte `localStorage`, Cache API y registros de service worker (I6, I7). |
| Un miembro del grupo malintencionado | Envía enlaces válidos pero manipulados (fechas, monedas, lápidas). |

## STRIDE

| # | Amenaza | Mitigación | Dónde |
|---|---|---|---|
| T1 | **Manipulación**: un enlace con importes negativos, NaN, repartos que no suman o personas inventadas | Validación estricta campo a campo; los repartos se recalculan siempre con aritmética entera. | `validate.ts`, `split.ts`, tests «rechaza: …» |
| T2 | Contaminación de prototipos con `__proto__`/`constructor` en un JSON | Objetos reconstruidos desde cero; claves de los repartos solo con formato UUID. | `validate.ts`, test «no contamina objetos» |
| T3 | Un enlace cifrado modificado | AES-GCM autentica: cualquier cambio falla al descifrar. | `share.ts` |
| T4 | **Fusión que te quita datos**: un enlace válido que, al juntarse con tu copia, pasaría de los límites; al reabrir la app el grupo se rechazaría | Antes de guardar, el resultado de cualquier fusión, importación, gasto fijo o edición pasa otra vez la validación completa (`revalidate`); si no la pasa, no se guarda y se avisa. | `merge.ts` (`incomingProblem`), `store.ts`, test F1 |
| T5 | **Cambios a escondidas** en una fusión (nombre, moneda, personas quitadas, gastos borrados, gastos fijos) | La vista previa enseña todo lo que cambiaría; lo que borra o cambia la moneda va en rojo. «Ya estás al día» solo si la fusión no cambia nada de verdad. | `mergePreview`, `IncomingSheet.tsx`, test F2 |
| T6 | Cambio de moneda con otros decimales (EUR → JPY) que multiplica todo por 100 | Se rechaza si hay gastos, tanto al editar como al fusionar. | `factory.ts`, `incomingProblem`, test F3 |
| T7 | **Ediciones «pegajosas»** con fechas adelantadas: ganarían a las tuyas durante meses | Se rechazan enlaces con ediciones a más de 24 h vista, y cada edición propia es siempre posterior a la versión que corrige (`max(ahora, anterior + 1)`). | `validate.ts`, `factory.ts`, test F4 |
| T8 | Lápidas de gastos fijos de meses futuros que anulan cobros que aún no existen | Un gasto `<fijo>~AAAA-MM` solo es válido si el fijo existe y el mes no pasa de dos meses vista. | `validate.ts`, test F5 |
| T9 | CSV de Splitwise con importes desorbitados, fechas imposibles o varias monedas | Esas filas se saltan y el resultado pasa la validación completa. | `csv.ts`, test F6 |
| T10 | Repartos que no cuadran (porcentajes que no suman 100 %, importes exactos que no suman el total) inflan el resumen | Se rechazan al validar. | `validate.ts`, test F14 |
| I1 | **Divulgación**: los datos en la URL acaban en servidores o historiales | Van en el fragmento `#` (no se envía al servidor ni en el `Referer`); la app lo borra de la barra y de la entrada actual del historial nada más leerlo. **No** puede borrarlo del historial global del navegador, de su sincronización ni de la app de mensajería por la que llegó: para grupos sensibles, usa contraseña. | `share.ts`, `store.ts` |
| I2 | Enlace interceptado | Contraseña opcional: PBKDF2 600 000 + AES-256-GCM. La que genera la app tiene unos 79 bits de azar (4 bloques de 4 símbolos): probarlas todas está fuera del alcance práctico. Una contraseña corta elegida a mano sí se puede adivinar sin conexión. | `share.ts`, `util.ts` |
| I3 | Fuga por `Referer` o recursos externos | `no-referrer`; la app no hace ninguna petición a terceros (sin analítica, CDN ni fuentes externas). | `index.html`, tests de interfaz |
| I4 | XSS que robe los datos de todos los grupos | CSP estricta (`default-src 'self'`, sin `unsafe-*`), **Trusted Types** con una sola política permitida (`trusted-types amedias-sw`, ni siquiera `default`), texto siempre como texto (React), ESLint y CI prohíben `innerHTML`/`eval`. | `vite.config.ts`, `eslint.config.js`, `ci.yml` |
| I5 | CSV abierto en Excel ejecuta fórmulas | Celdas que empiezan por `= + - @` neutralizadas con apóstrofo. | `csv.ts`, test |
| D1 | **Denegación**: un enlace o archivo enorme o una bomba de descompresión cuelga el móvil | Topes de 1,5 MB (enlace), 8 MB (descomprimido), 20 MB (archivo), 50 personas, 20 000 gastos; la descompresión se corta en el tope. | `share.ts`, `validate.ts`, test «bombas» |
| D2 | Un gasto fijo con fechas absurdas genera miles de gastos | Como mucho 36 meses de golpe; día del mes 1-28. | `recurring.ts` |
| D3 | Almacenamiento lleno o dañado | Error visible al guardar; al cargar se apartan los grupos dañados sin perder los demás. La copia en bruto se guarda con fecha (las 3 últimas) y se puede descargar desde Ajustes. | `storage.ts`, `store.ts`, `SettingsSheet.tsx`, test F11 |
| D4 | Abrir `…/amedias/icon.svg` (o cualquier otra ruta) sustituía la copia sin conexión de la app | El service worker solo guarda como app la propia `index.html`, y solo si su huella SHA-256 coincide con la publicada. | `public/sw.js`, test manual |
| D5 | Lista con miles de gastos que atasca el móvil | Se pintan de 150 en 150 («Ver más»); los totales del mes se calculan con todos. | `ExpensesTab.tsx` |
| I6 | **Origen compartido**: todas las webs de `bertmarti.github.io/*` (otros proyectos del mismo autor) son el mismo origen y comparten `localStorage`; un XSS en cualquiera de ellas podría leer o escribir los grupos | Las demás webs del origen son del mismo autor, sin servidor, con CSP estricta y revisión de seguridad; ninguna lee estas claves. Para aislarlo del todo: dominio propio (subdominio) para «a medias» (PLAN v0.2). | PLAN |
| I7 | El mismo origen comparte también la **Cache API** y los service workers: otra página podría escribir un script falso en la caché de la app | Al compilar se inyecta en `sw.js` el SHA-256 de cada archivo publicado; nada se guarda ni se sirve desde la caché si su huella no coincide (se borra y se pide a la red). Cada despliegue estrena cachés. Riesgo restante: anular el registro del service worker (solo afecta al modo sin conexión). | `vite.config.ts` (`swIntegrity`), `public/sw.js`, test manual |
| E1 | Enmarcar la app (clickjacking) | Sin acciones peligrosas de un clic; GitHub Pages no permite cabeceras, así que `frame-ancestors` no aplica (riesgo aceptado, bajo). | — |
| SC1 | Dependencia comprometida | Pocas dependencias, todas de build; `ignore-scripts=true`; `npm audit`, revisión de dependencias y Dependabot con 7 días de espera. La imagen de Node de `dk.sh` va fijada por digest. | `.npmrc`, `ci.yml`, `dependabot.yml`, `dk.sh` |
| SC2 | Action comprometida | Actions fijadas por SHA, permisos mínimos; solo el trabajo `deploy` puede publicar, y antes pasa lint, tipos, tests, `npm audit` y las comprobaciones de CSP y huellas. | `.github/workflows/` |

## Riesgos aceptados

- **Dispositivo comprometido** o extensiones del navegador maliciosas: pueden leer `localStorage`.
- **Quien tiene el enlace y la contraseña** ve el grupo entero (como recibir el archivo).
- **Relojes desajustados** pueden decidir qué edición gana en una fusión (ver
  [SINCRONIZACION.md](SINCRONIZACION.md#límites-del-modelo)); con un margen de 24 h.
- **Origen compartido con otras webs del autor en `github.io`** (I6, I7), hasta pasar a un dominio propio.
- **Navegadores sin Trusted Types** (Firefox y Safari antiguos): la CSP sigue bloqueando scripts ajenos; solo
  falta esa capa extra.

## Auditoría independiente (v0.1.0)

Antes de publicar, otro modelo (Fable) auditó el código sin ver las conclusiones del autor. Encontró
1 fallo alto (F1: fusión que superaba los límites y hacía desaparecer el grupo), 5 medios (F2-F6) y varios
bajos o informativos. **Todos están corregidos** y cada uno tiene su test de regresión (`F1`…`F15` en
`test/core.test.ts` y `test/ui/app.test.tsx`); D4 e I7 se comprobaron a mano en el navegador (caché
envenenada a propósito: el script falso no se ejecuta).
- **Sin cabeceras HTTP propias** en GitHub Pages: la CSP va en `<meta>`, que no admite `frame-ancestors`.
