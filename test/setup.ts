/**
 * El navegador de los tests (happy-dom) dice ser `en-US`. La app elige el idioma del dispositivo cuando no hay ninguno
 * guardado, así que los tests de interfaz, escritos en español, simulan un dispositivo en español. Los tests de
 * detección pasan su propia lista a `detectLang` y a `loadSettings`.
 */
Object.defineProperty(navigator, 'language', { value: 'es-ES', configurable: true });
Object.defineProperty(navigator, 'languages', { value: ['es-ES', 'es'], configurable: true });
