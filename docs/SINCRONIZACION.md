# Sincronizar sin servidor

> Documento técnico. Para una explicación de uso, ver el [README](../README.md).

Repartito no tiene servidor ni cuentas. Cada persona guarda **su copia** del grupo en su navegador
(`localStorage`). Para ponerse al día, una persona envía un **enlace** (o un archivo), y quien lo abre
**fusiona** esa copia con la suya. Cuando todas las personas han recibido los cambios de todas, las copias
son idénticas.

## El enlace

```text
https://bertmarti.github.io/repartito/#g=1.<base64url(deflate-raw(JSON del grupo))>
https://bertmarti.github.io/repartito/#g=1e.<base64url(salt16 ‖ iv12 ‖ AES-256-GCM(deflate-raw(JSON)))>
```

- Todo va en el **fragmento** (`#`): los navegadores no lo envían en la petición HTTP, así que ni GitHub
  Pages ni nadie en el camino ve los datos.
- Con contraseña: PBKDF2-SHA-256 (600 000 iteraciones, sal aleatoria de 16 bytes) → AES-256-GCM con
  IV aleatorio y AAD `amedias/1e`. Sin la contraseña, el enlace es ruido.
- Al abrirlo, la app guarda el contenido en memoria y **borra el fragmento** de la barra de direcciones y
  de la entrada actual del historial (`history.replaceState`) antes de hacer nada más. Lo que no puede
  borrar es el historial global del navegador ni el chat por el que llegó: para grupos sensibles, contraseña.
- Tope de 1,5 MB de texto y 8 MB al descomprimir: un enlace diminuto que se descomprime en cientos de MB
  (bomba de descompresión) se corta al pasar el tope.

## La fusión (`src/core/merge.ts`)

Cada persona, gasto y gasto fijo tiene un `id` (UUID) y un `updatedAt`. Fusionar es:

1. Unir por `id`.
2. Si los dos lados tienen el mismo `id`, gana el `updatedAt` mayor. Si empatan, gana el mayor en orden
   de texto JSON (determinista).
3. Borrar es una **lápida** (`deleted: true` con su `updatedAt`), así el borrado también viaja.

La fusión es **conmutativa, asociativa e idempotente** (hay tests de las tres): da igual el orden en que
lleguen los enlaces o si llegan repetidos.

### Antes de aceptar

La app enseña **todo** lo que cambiaría: gastos nuevos, cambiados y borrados; personas nuevas, renombradas
y quitadas; cambios en los gastos fijos; nombre, icono y moneda. Lo que borra o cambia la moneda va en rojo.
Y no deja fusionar (con el motivo) si:

- trae ediciones fechadas a más de 24 h vista (ganarían a las tuyas durante meses);
- cambia a una moneda con otros decimales y ya hay gastos;
- el resultado pasaría de los límites (al reabrir la app, el grupo se rechazaría).

Cada edición propia lleva `updatedAt = max(ahora, anterior + 1)`, así que corregir algo siempre gana a la
versión que se corrige, aunque viniera con el reloj adelantado.

### Gastos fijos

El alquiler de marzo lo pueden generar dos móviles por su cuenta. El id de cada gasto generado es
**determinista** (`<id del gasto fijo>~2026-03`), así que al fusionar queda uno. Se crean con el
`updatedAt` del gasto fijo: si dos móviles tenían versiones distintas del fijo, gana la más reciente, y
cualquier edición manual posterior gana a ambas. Un id `~AAAA-MM` solo es válido si el gasto fijo existe y
el mes no pasa de dos meses vista (así nadie puede «anular» por adelantado cobros futuros).

## Validación (`src/core/validate.ts`)

Lo que llega de un enlace, un archivo o el propio almacenamiento se reconstruye campo a campo:

- solo los campos conocidos; los identificadores deben ser UUID (así ninguna clave puede ser
  `__proto__` o `constructor`: sin contaminación de prototipos);
- importes enteros entre 1 céntimo y 10 millones;
- repartos que apuntan a personas del grupo y que **cuadran** con el importe;
- fechas válidas;
- textos sin caracteres de control ni de formato invisibles (marcas bidireccionales, etiquetas), recortados;
- el icono tiene que empezar por un emoji;
- topes de 50 personas, 20 000 gastos y 100 gastos fijos.

Cualquier fallo rechaza el grupo entero con un mensaje genérico, sin eco de los datos.

## Límites del modelo

- **Ediciones simultáneas del mismo gasto**: gana la última (por reloj del dispositivo). Los enlaces con
  ediciones a más de 24 h vista no se aceptan, y una edición propia siempre gana a la versión que corrige.
- Quien tiene el enlace (y la contraseña, si la hay) ve el grupo entero. Es como enviar el archivo.
