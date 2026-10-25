# PLAN.md · a medias

## Por qué existe

En 2026 la app de referencia para repartir gastos limita su plan gratuito a unos pocos gastos al día, con
esperas y anuncios. Las alternativas piden cuenta, tienen anuncios o un plan de pago. Lo que más se pide en
apps de productividad es que **funcionen sin conexión de verdad**, y la queja más repetida es que lo gratis
pase a ser de pago. «a medias» resuelve un problema diario (el súper del piso, la cena, el viaje) sin
ninguna de esas trabas.

## Principios

1. **Gratis para siempre, sin cuenta, sin anuncios y sin límites artificiales.**
2. **Tus datos son tuyos**: viven en tu dispositivo; compartir es una decisión explícita.
3. **Rápido de usar a diario**: apuntar un gasto en menos de 5 segundos.
4. **Cuadra al céntimo**: aritmética entera y tests.
5. **Seguro por defecto** frente a enlaces y archivos de otras personas.

## v0.1.0 «Primera cuenta» — publicada

- [x] Dominio: repartos (iguales, importes, partes, %), saldos, transferencias mínimas, gastos fijos.
- [x] Fusión sin servidor (conmutativa, asociativa, idempotente) y enlaces comprimidos y cifrables.
- [x] Validación estricta, CSV anti-fórmulas e importación de Splitwise.
- [x] Interfaz completa ES/EN, tema claro/oscuro, PWA sin conexión.
- [x] CI (lint, tipos, tests, build, audit, gitleaks), CodeQL, Scorecard, Dependabot.
- [x] Despliegue en GitHub Pages y README con capturas.
- [x] Auditoría de seguridad independiente (1 alto, 5 medios: todo corregido con tests).

## v0.2.0 «Bizum» — siguiente

- [ ] **Origen propio** (subdominio) para no compartir `localStorage`, Cache API ni service workers con otras webs de `bertmarti.github.io` (amenazas I6, I7).
- [ ] Recordatorio amable para pedir lo que te deben (texto listo para WhatsApp).
- [ ] Fotos de tickets guardadas solo en el dispositivo (IndexedDB), nunca en el enlace.
- [ ] Varias monedas en un mismo grupo (viajes) con cambio manual.
- [ ] Atajos: «repetir el último gasto», plantillas («Súper», «Bombona»).

## v0.3.0 «Juntos» — más adelante

- [ ] Sincronización en vivo opcional entre dispositivos (WebRTC o un relé cifrado de extremo a extremo).
- [ ] Widgets e integración con el menú de compartir del móvil (Share Target).
- [ ] Más idiomas (catalán, gallego, euskera, portugués).
