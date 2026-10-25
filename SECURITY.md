# Política de seguridad

## Versiones con soporte

| Versión | Soporte |
|---|---|
| 0.2.x | ✅ |
| 0.1.x | ❌ (actualiza a 0.2) |

## Cómo informar de una vulnerabilidad

**No abras un issue público.** Usa el informe privado de GitHub:
<https://github.com/BertMarti/amedias/security/advisories/new>.

Incluye la versión o el commit, los pasos para reproducirlo y el impacto. Si puedes, no adjuntes datos de gastos reales.

- Acuse de recibo: en 72 horas.
- Primera evaluación: en 7 días.
- Aviso público coordinado contigo, con crédito si lo deseas.

## Alcance

Dentro: la validación de enlaces y archivos, el cifrado de enlaces, la CSP, el service worker y los workflows.
Fuera: dispositivos ya comprometidos, extensiones del navegador y los riesgos aceptados de
[docs/MODELO_DE_AMENAZAS.md](docs/MODELO_DE_AMENAZAS.md#riesgos-aceptados).

## Medidas en vigor

- Sin servidor ni cuentas: los datos viven en el navegador de cada persona.
- Enlaces en el fragmento `#` (no llegan a ningún servidor), borrados de la barra al leerlos, con contraseña opcional (PBKDF2 600 000 + AES-256-GCM).
- Validación estricta de todo lo que entra; topes contra bombas de descompresión y archivos enormes.
- CSP `default-src 'self'` con Trusted Types (una sola política permitida); ninguna petición a terceros.
- Fusiones seguras: vista previa completa, rechazo de fechas futuras, cambios de moneda que descuadran y resultados fuera de límites.
- Service worker que verifica el SHA-256 de cada archivo antes de guardarlo o servirlo desde la caché.
- CSV con protección anti-fórmulas.
- CI con CodeQL, gitleaks, `npm audit`, revisión de dependencias, OpenSSF Scorecard y Dependabot; actions fijadas por SHA; `ignore-scripts` en npm. El despliegue exige las mismas comprobaciones.
- App de Android sin permisos del sistema, con origen propio, sin copia en la nube y firma verificable con atestación de procedencia ([docs/ANDROID.md](docs/ANDROID.md)).
- Auditoría independiente antes de la v0.1.0: [resultados en el modelo de amenazas](docs/MODELO_DE_AMENAZAS.md#auditoría-independiente-v010).
