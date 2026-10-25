# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [Semantic Versioning](https://semver.org/lang/es/).

## [Sin publicar]

## [0.2.0] - 2026-10-25

### Cambiado

- **Nuevo nombre: Repartito** (antes «a medias»): ya había otras apps de gastos con ese nombre en las tiendas. La web pasa a `https://bertmarti.github.io/repartito/`; los datos guardados se migran solos y los enlaces ya enviados se siguen abriendo.

### Añadido

- **App de Android** (APK en cada release): la misma app, instalable como cualquier otra.
- En la app, compartir enlaces y guardar copias o CSV con el menú del sistema.
- Iconos adaptativos (también monocromos) y pantalla de arranque con la marca.

### Seguridad

- La app tiene su propio origen: no comparte almacenamiento con otras webs de `github.io`.
- No pide ningún permiso del sistema (ni Internet) y no copia los datos en la nube de Google.
- APK y AAB firmados en un entorno protegido, con huella del certificado verificada, atestación de procedencia y `SHA256SUMS.txt`.
- La web publicada no incluye Capacitor (sustituto vacío de 0,17 kB).

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

[Sin publicar]: https://github.com/BertMarti/repartito/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/BertMarti/repartito/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/BertMarti/repartito/releases/tag/v0.1.0
