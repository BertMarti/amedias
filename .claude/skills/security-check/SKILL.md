---
name: security-check
description: Lista de comprobación de seguridad de «a medias» antes de abrir o fusionar un PR. Úsala siempre que cambies src/, public/, index.html o .github/.
---

# Comprobación de seguridad de «a medias»

1. `npm run check` y `npm run build` en verde (con Node < 24: `./dk.sh npm run check`).
2. `grep -rnE "innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML|eval\(|new Function" src` → vacío.
3. `grep -rnE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon" src` → nada que salga a terceros.
4. `index.html`: la CSP sigue siendo `default-src 'self'`, con `require-trusted-types-for 'script'` y sin `unsafe-*`.
5. Datos de fuera: cualquier lectura nueva de enlace, archivo o almacenamiento usa `parseGroup`/`decodeGroup`/`readBackup`/`importSplitwise`.
6. Cambios del modelo: tests de fusión (conmutativa, asociativa, idempotente) y de validación al día.
7. `public/sw.js`: solo GET, solo el ámbito `/amedias/`, versión de caché incrementada si cambian los recursos.
8. `npm audit --audit-level=high` y `npm install-scripts ls` sin novedades.
9. Lanza el subagente `security-auditor` sobre el diff y resuelve lo que encuentre.
