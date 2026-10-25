# Arquitectura

```text
src/
  core/          dominio puro y probado (sin React ni DOM salvo Web Crypto/Streams)
    types.ts       modelo: grupos, personas, gastos, gastos fijos; dinero en céntimos enteros
    money.ts       leer y formatear importes (12,5 · 1.234,56 · 1,234.56)
    split.ts       repartos (iguales, importes, partes, %), saldos y «cómo quedar a cero»
    merge.ts       fusión sin servidor (CRDT sencillo: último que escribe gana + lápidas)
    recurring.ts   gastos fijos mensuales con ids deterministas
    validate.ts    validación estricta de todo lo que entra de fuera
    share.ts       enlaces comprimidos y cifrados en el fragmento #
    csv.ts         exportar CSV (anti-fórmulas) e importar Splitwise
    storage.ts     localStorage, ajustes y copias de seguridad
    factory.ts     crear y editar con ids y marcas de tiempo
    stats.ts       resúmenes por categoría y mes
  ui/            pantallas y componentes React
  i18n/          español e inglés
public/          manifest, iconos y service worker (funciona sin conexión)
test/            Vitest: dominio (core.test.ts) e interfaz (ui/)
```

## Decisiones

| Decisión | Motivo |
|---|---|
| Sin servidor ni cuentas | Gratis para siempre (GitHub Pages), sin datos personales que proteger en ningún sitio y sin registros. |
| Sincronización por enlace con fusión | Colaborar sin servidor; la fusión conmutativa evita conflictos al reenviar. |
| Céntimos enteros | Sin errores de coma flotante: el reparto cuadra siempre al céntimo (método del mayor resto). |
| Ids deterministas en gastos fijos | Dos móviles que generan el alquiler de marzo no lo duplican. |
| Importar Splitwise | Quien se va de Splitwise por sus límites se trae su historial con los mismos saldos. |
| React + Vite, sin librerías de UI ni de gráficos | Control de la CSP y del peso; las gráficas son SVG propias. |
| PWA con service worker propio | Funciona sin conexión (en el súper, en un viaje); sin dependencias extra. |
