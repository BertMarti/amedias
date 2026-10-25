---
name: release
description: Publica una versión de «a medias» (semver) con CHANGELOG, etiqueta y despliegue en GitHub Pages. Úsala cuando pidan «sacar versión» o «release».
---

# Publicar una versión

1. Ejecuta la skill `security-check` completa.
2. Decide la versión (semver). Un cambio que rompe enlaces o copias antiguas es versión mayor y necesita migración en `validate.ts`.
3. `npm version <x.y.z> --no-git-tag-version`; sube la versión de caché de `public/sw.js`.
4. Mueve «Sin publicar» de `CHANGELOG.md` a `[x.y.z] - AAAA-MM-DD` y actualiza MEMORY.md y PLAN.md.
5. Commit `chore(release): vx.y.z`, etiqueta y `git push --follow-tags`.
6. `gh release create vx.y.z` con las notas del CHANGELOG. El push a `main` despliega Pages (`deploy.yml`).
7. Abre la web publicada en el móvil y comprueba que se actualiza y funciona sin conexión.
