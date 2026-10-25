---
name: security-check
description: Lista de comprobación de seguridad de «a medias» antes de abrir o fusionar un PR. Úsala siempre que cambies src/, public/, index.html o .github/.
---

# Comprobación de seguridad de «a medias»

1. `npm run check` y `npm run build` en verde (con Node < 24: `./dk.sh npm run check`).
2. `grep -rnE "innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML|eval\(|new Function" src` → vacío.
3. `grep -rnE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon" src` → nada que salga a terceros.
4. `vite.config.ts`: la CSP sigue siendo `default-src 'self'`, con `require-trusted-types-for 'script'`, `trusted-types amedias-sw` y sin `unsafe-*`.
5. Datos de fuera: cualquier lectura nueva de enlace, archivo o almacenamiento usa `parseGroup`/`decodeGroup`/`readBackup`/`importSplitwise`.
6. Cambios del modelo: tests de fusión (conmutativa, asociativa, idempotente) y de validación al día.
7. `public/sw.js`: solo GET, solo el ámbito `/amedias/`, y nada se guarda ni se sirve sin pasar `intact()` (huellas del build).
8. Android: `AndroidManifest.xml` sin `uses-permission` y con `allowBackup=false`; `capacitor.config.json` con `loggingBehavior: none`; ningún plugin nuevo sin justificar; ninguna clave de firma en el diff.
9. `npm audit --audit-level=high` y `npm install-scripts ls` sin novedades.
10. Lanza el subagente `security-auditor` sobre el diff y resuelve lo que encuentre.
