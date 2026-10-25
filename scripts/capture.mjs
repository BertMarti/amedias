// Capturas del README: Chromium sin cabeza por CDP, vista de móvil 390×844 a 2x, con el grupo de ejemplo.
// Uso: con la build servida en http://localhost:4173/repartito/ (npx vite preview) y Chromium con
//      --remote-debugging-port=9333:  node scripts/capture.mjs <carpeta-de-salida>
// Evita pantallas con emojis: el Chromium del equipo de desarrollo no tiene fuente de emojis.
import fs from 'node:fs';

const out = process.argv[2] ?? 'capturas';
fs.mkdirSync(out, { recursive: true });
const CDP = process.env.CDP ?? 'http://127.0.0.1:9333';
const APP = process.env.APP ?? 'http://localhost:4173/repartito/';
const PUBLIC = 'https://bertmarti.github.io';

const target = await (await fetch(`${CDP}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const waiters = new Map();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (!Number.isInteger(d.id) || !waiters.has(d.id)) return;
  const resolve = waiters.get(d.id);
  waiters.delete(d.id);
  resolve(d);
};
const send = (method, params = {}) => new Promise((r) => (waiters.set(++seq, r), ws.send(JSON.stringify({ id: seq, method, params }))));
const sleep = (t) => new Promise((r) => setTimeout(r, t));
const ev = async (expression) => {
  const d = await send('Runtime.evaluate', { expression: `(async()=>{${expression}})()`, awaitPromise: true, returnByValue: true });
  if (d.result?.exceptionDetails) throw new Error(JSON.stringify(d.result.exceptionDetails));
  return d.result?.result?.value;
};
const viewport = (height) => send('Emulation.setDeviceMetricsOverride', { width: 390, height, deviceScaleFactor: 2, mobile: true });
const shot = async (name) => {
  await sleep(900);
  // Los avisos son temporales: fuera de la foto.
  await ev(`const t = document.querySelector('.toasts'); if (t) t.style.visibility = 'hidden';`);
  const d = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${out}/${name}.png`, Buffer.from(d.result.data, 'base64'));
  console.log('✓', name);
};
const H = `const lbl = (b) => b.getAttribute('aria-label') || b.textContent.trim();
  const click = async (re) => { const b = [...document.querySelectorAll('button')].find((b) => re.test(lbl(b))); if (!b) throw new Error('no ' + re); b.click(); await new Promise((r) => setTimeout(r, 700)); };`;

async function fresh(theme) {
  await ev(`localStorage.clear(); localStorage.setItem('repartito:v1:ajustes', JSON.stringify({ lang: 'es', theme: '${theme}', me: {} })); location.reload();`).catch(() => {});
  await sleep(1800);
  await ev('await document.fonts.ready;');
}

await viewport(844);
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await send('Page.enable');
await send('Page.navigate', { url: APP });
await sleep(1500);

await fresh('light');
await shot('01-inicio');
await ev(`${H} await click(/^Probar con un grupo de ejemplo$/);`);
await shot('02-gastos');
await ev(`${H} await click(/^Gasto$/);
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  const i = document.querySelector('.amount-input input'); set.call(i, '45,30'); i.dispatchEvent(new Event('input', { bubbles: true }));
  const c = document.querySelectorAll('.sheet input[type=text]')[0]; set.call(c, 'Cena del sábado'); c.dispatchEvent(new Event('input', { bubbles: true }));
  [...document.querySelectorAll('.sheet label')].find((l) => l.textContent.trim() === 'Comer fuera').click();
  await new Promise((r) => setTimeout(r, 300));
  await click(/^Partes$/); await click(/^Una parte más para Alex$/);`);
await viewport(1160);
await sleep(400);
await ev(`document.querySelector('.amount-field').scrollIntoView({ block: 'start' });`);
await shot('03-nuevo-gasto');
await viewport(844);
await ev(`${H} await click(/^Cerrar$/); await click(/^Saldos$/);`);
await shot('04-saldos');
await ev(`${H} await click(/^Resumen$/);`);
await shot('05-resumen');
await ev(`${H} await click(/^Compartir y sincronizar$/); await click(/^Generar$/); await click(/^Crear enlace$/); await new Promise((r) => setTimeout(r, 1500));
  // La vista previa local enseñaría «localhost»: se muestra la dirección pública, que es la que verá la gente.
  const l = [...document.querySelectorAll('.sheet input')].find((i) => i.value.includes('#g='));
  l.value = l.value.replace(location.origin, '${PUBLIC}');
  document.querySelector('.sheet input[type=text], .sheet input:not([type])').closest('.field').scrollIntoView({ block: 'start' });`);
await shot('06-compartir');

await fresh('dark');
await ev(`${H} await click(/^Probar con un grupo de ejemplo$/); await click(/^Saldos$/);`);
await shot('07-saldos-oscuro');

ws.close();
await fetch(`${CDP}/json/close/${target.id}`);
