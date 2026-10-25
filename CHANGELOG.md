# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [Semantic Versioning](https://semver.org/lang/es/).

## [Sin publicar]

## [0.1.0] - 2026-10-25

### Añadido

- Grupos de gastos (piso, pareja, viaje) con personas, gastos y pagos, sin cuenta ni límites.
- Repartos a partes iguales, por importes, por partes o por porcentajes, que cuadran al céntimo.
- Saldos y «cómo quedar a cero» con el mínimo de transferencias, y registro de pagos.
- Gastos fijos mensuales (alquiler, internet, suscripciones) que se apuntan solos.
- Compartir y sincronizar sin servidor: enlace o QR que fusiona los cambios de todos, con contraseña opcional.
- Importación desde Splitwise (CSV) conservando los saldos, exportación a CSV y copias de seguridad.
- Resumen por meses y categorías.
- Español e inglés, tema claro y oscuro, instalable y funciona sin conexión (PWA).
- Seguridad: validación estricta, CSP con Trusted Types, enlaces cifrados, CSV anti-fórmulas y CI de seguridad.

### Seguridad

Auditoría independiente antes de publicar; todo corregido y con test de regresión:

- Una fusión, importación o edición que pasaría de los límites ya no se guarda (antes el grupo podía desaparecer al reabrir la app).
- La vista previa de un enlace enseña todo lo que cambiaría (también borrados, personas quitadas, gastos fijos, nombre y moneda).
- No se aceptan enlaces con ediciones fechadas en el futuro ni cambios de moneda que descuadren los importes; tus correcciones siempre ganan.
- No se aceptan lápidas de gastos fijos de meses futuros ni repartos que no cuadran.
- La importación de Splitwise salta filas desorbitadas, fechas imposibles y otras monedas.
- Contraseñas generadas de unos 79 bits (antes, unos 30).
- Service worker con huellas SHA-256 de cada archivo: no guarda ni sirve nada manipulado, y una navegación cualquiera ya no reemplaza la copia sin conexión.
- CSP con `trusted-types amedias-sw` y sin `blob:`.
- Los datos dañados se apartan con fecha y se pueden descargar desde Ajustes.
- El despliegue exige las mismas comprobaciones que el CI.

[Sin publicar]: https://github.com/BertMarti/amedias/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/BertMarti/amedias/releases/tag/v0.1.0
