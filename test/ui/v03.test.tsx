import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import App from '../../src/App';
import { backupJson, decodeGroup, deleteExpense, encodeGroup, exportCsv, loadGroups, today, type Group } from '../../src/core';
import { memoryPhotoStore, setPhotoStore } from '../../src/ui/photos';

// En happy-dom no hay canvas: la compresión se prueba aparte (photos.test.ts) y aquí devuelve una foto fija.
const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';
vi.mock('../../src/ui/image', () => ({ compressPhoto: vi.fn(async () => FOTO) }));

let fetchMock: Mock;
let store: ReturnType<typeof memoryPhotoStore>;

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, '', '/repartito/');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  store = memoryPhotoStore();
  setPhotoStore(store);
});

afterEach(() => {
  cleanup();
  expect(fetchMock).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  setPhotoStore(null);
  // navigator.share se añade en algunos tests.
  delete (navigator as { share?: unknown }).share;
});

const money = (text: string) => new RegExp(text.replace(/\s/g, '\\s'));
const group = (): Group => loadGroups().groups[0]!;

function demo() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Probar con un grupo de ejemplo' }));
}

/** Piso con Alex (tú) y Ana; Alex paga 30 € del súper (con foto opcional). */
async function piso({ photo = false } = {}) {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
  const sheet = screen.getByRole('dialog', { name: 'Nuevo grupo' });
  fireEvent.change(within(sheet).getByLabelText('Nombre'), { target: { value: 'Piso' } });
  fireEvent.change(within(sheet).getByLabelText('Persona 1'), { target: { value: 'Alex' } });
  fireEvent.change(within(sheet).getByLabelText('Persona 2'), { target: { value: 'Ana' } });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Crear grupo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Gasto' }));
  const exp = screen.getByRole('dialog', { name: 'Nuevo gasto' });
  fireEvent.change(within(exp).getByLabelText('Importe'), { target: { value: '30' } });
  fireEvent.change(within(exp).getByLabelText('Concepto'), { target: { value: 'Súper' } });
  if (photo) {
    fireEvent.change(within(exp).getByLabelText('Añadir foto del ticket'), { target: { files: [new File(['x'], 'ticket.jpg', { type: 'image/jpeg' })] } });
    expect(await within(exp).findByRole('button', { name: 'Ver la foto del ticket en grande' })).toBeTruthy();
  }
  fireEvent.click(within(exp).getByRole('button', { name: 'Añadir gasto' }));
  expect(screen.queryByRole('dialog')).toBeNull();
}

describe('plantillas', () => {
  it('un toque en una plantilla rellena el gasto', () => {
    demo();
    fireEvent.click(screen.getByRole('button', { name: 'Gasto' }));
    const exp = screen.getByRole('dialog', { name: 'Nuevo gasto' });
    expect(within(exp).getByRole('button', { name: 'Usar la plantilla Súper' })).toBeTruthy();
    fireEvent.click(within(exp).getByRole('button', { name: 'Usar la plantilla Bombona' }));
    expect((within(exp).getByLabelText('Importe') as HTMLInputElement).value).toBe('22,00');
    expect((within(exp).getByLabelText('Concepto') as HTMLInputElement).value).toBe('Bombona');
    fireEvent.click(within(exp).getByRole('button', { name: 'Añadir gasto' }));
    const nuevo = group().expenses.find((e) => e.title === 'Bombona')!;
    expect(nuevo).toMatchObject({ amount: 2200, category: 'casa', date: today() });
  });

  it('se guarda el formulario como plantilla (y se puede borrar desde «Grupo y personas»)', () => {
    demo();
    fireEvent.click(screen.getByRole('button', { name: 'Gasto' }));
    const exp = screen.getByRole('dialog', { name: 'Nuevo gasto' });
    fireEvent.click(within(exp).getByRole('button', { name: 'Guardar como plantilla' }));
    expect(within(exp).getByText(/Ponle un concepto/)).toBeTruthy();
    fireEvent.change(within(exp).getByLabelText('Concepto'), { target: { value: 'Agua' } });
    fireEvent.change(within(exp).getByLabelText('Importe'), { target: { value: '18,40' } });
    fireEvent.click(within(exp).getByRole('button', { name: 'Guardar como plantilla' }));
    expect(screen.getByText(/Plantilla «Agua» guardada/)).toBeTruthy();
    expect(group().templates.find((t) => t.title === 'Agua')).toMatchObject({ amount: 1840, category: 'compra' });
    expect(within(exp).getByRole('button', { name: 'Usar la plantilla Agua' })).toBeTruthy();
    // Guardar como plantilla no añade el gasto.
    expect(group().expenses.some((e) => e.title === 'Agua')).toBe(false);

    fireEvent.click(within(exp).getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Grupo y personas' }));
    const gs = screen.getByRole('dialog', { name: 'Grupo y personas' });
    fireEvent.click(within(gs).getByRole('button', { name: 'Borrar la plantilla Agua' }));
    expect(group().templates.find((t) => t.title === 'Agua')!.deleted).toBe(true);
    expect(within(gs).queryByRole('button', { name: 'Borrar la plantilla Agua' })).toBeNull();
  });
});

describe('«Repetir»', () => {
  it('abre un gasto nuevo igual, con la fecha de hoy', async () => {
    await piso();
    const original = group().expenses[0]!;
    // Lo pasamos a otra fecha para ver que la copia lleva la de hoy.
    localStorage.setItem('repartito:v1:grupos', JSON.stringify([{ ...group(), expenses: [{ ...original, date: '2026-01-15' }] }]));
    cleanup();
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Súper/ }));
    const edit = screen.getByRole('dialog', { name: 'Editar gasto' });
    fireEvent.click(within(edit).getByRole('button', { name: 'Repetir hoy' }));
    const nuevo = screen.getByRole('dialog', { name: 'Nuevo gasto' });
    expect((within(nuevo).getByLabelText('Importe') as HTMLInputElement).value).toBe('30,00');
    expect((within(nuevo).getByLabelText('Concepto') as HTMLInputElement).value).toBe('Súper');
    expect((within(nuevo).getByLabelText('Fecha') as HTMLInputElement).value).toBe(today());
    fireEvent.click(within(nuevo).getByRole('button', { name: 'Añadir gasto' }));
    const live = group().expenses.filter((e) => !e.deleted);
    expect(live).toHaveLength(2);
    expect(live.map((e) => e.date).sort()).toEqual(['2026-01-15', today()].sort());
    expect(new Set(live.map((e) => e.id)).size).toBe(2);
    expect(live[0]!.split).toEqual(live[1]!.split);
  });
});

describe('recordatorio amable', () => {
  it('abre el menú de compartir con un mensaje sin enlace', async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    await piso();
    fireEvent.click(screen.getByRole('button', { name: 'Saldos' }));
    fireEvent.click(screen.getByRole('button', { name: /Enviar a Ana un recordatorio amable de 15,00/ }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const arg = (share.mock.calls[0] as unknown as [ShareData])[0];
    expect(arg).not.toHaveProperty('url');
    expect(arg.text).toMatch(money('¡Hola, Ana! 👋 Te escribo por las cuentas de «Piso»: según Repartito, te toca pasarme 15,00 €'));
    // Nada más que nombres, importe y nombre del grupo: ni enlaces ni datos del grupo.
    expect(arg.text).not.toMatch(/https?:|#g=|Súper/);
  });

  it('sin menú de compartir, copia el mensaje', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await piso();
    fireEvent.click(screen.getByRole('button', { name: 'Saldos' }));
    fireEvent.click(screen.getByRole('button', { name: /Enviar a Ana un recordatorio amable/ }));
    expect(await screen.findByText(/Mensaje copiado: pégalo en WhatsApp/)).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('15,00'));
  });

  it('si debes tú, el botón es para avisar', async () => {
    await piso();
    fireEvent.click(screen.getByRole('button', { name: 'Grupo y personas' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Grupo y personas' })).getAllByRole('button', { name: 'Soy yo' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Saldos' }));
    expect(screen.getByRole('button', { name: /Decirle a Alex que le debes 15,00/ })).toBeTruthy();
  });
});

describe('fotos de tickets (solo en este dispositivo)', () => {
  it('se guarda con el gasto y nunca va en el grupo, los enlaces, las copias ni el CSV', async () => {
    await piso({ photo: true });
    const g = group();
    const e = g.expenses[0]!;
    await waitFor(() => expect(store.records.get(e.id)).toMatchObject({ id: e.id, groupId: g.id, data: FOTO }));
    // El JSON del gasto no cambia: ni la foto ni una marca.
    expect(Object.keys(e).sort()).toEqual(['amount', 'category', 'createdAt', 'date', 'id', 'kind', 'paidBy', 'split', 'title', 'updatedAt']);
    for (const text of [JSON.stringify(localStorage), backupJson([g]), exportCsv(g, 'es')]) {
      expect(text).not.toContain('data:image');
      expect(text).not.toContain(FOTO.slice(30));
    }
    const viaLink = await decodeGroup(await encodeGroup(g));
    expect(JSON.stringify(viaLink)).not.toContain('data:image');
    // En la lista, un icono discreto.
    expect(await screen.findByText('con foto del ticket')).toBeTruthy();
  });

  it('se ve en la hoja del gasto, en grande, y se puede quitar', async () => {
    await piso({ photo: true });
    const id = group().expenses[0]!.id;
    fireEvent.click(screen.getByRole('button', { name: /Súper/ }));
    const edit = screen.getByRole('dialog', { name: 'Editar gasto' });
    fireEvent.click(await within(edit).findByRole('button', { name: 'Ver la foto del ticket en grande' }));
    const full = screen.getByRole('dialog', { name: 'Foto del ticket' });
    expect(within(full).getByRole('img', { name: 'Foto del ticket de «Súper»' }).getAttribute('src')).toBe(FOTO);
    fireEvent.click(within(full).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Foto del ticket' })).toBeNull());
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Editar gasto' })).getByRole('button', { name: 'Quitar foto' }));
    // Hasta guardar, no se borra.
    expect(store.records.has(id)).toBe(true);
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Editar gasto' })).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(store.records.has(id)).toBe(false));
  });

  it('borrar el gasto borra su foto', async () => {
    await piso({ photo: true });
    const id = group().expenses[0]!.id;
    await waitFor(() => expect(store.records.has(id)).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /Súper/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Editar gasto' })).getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '¿Eliminar este gasto?' })).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(store.records.has(id)).toBe(false));
  });

  it('también si el borrado llega de otra persona al fusionar', async () => {
    await piso({ photo: true });
    const g = group();
    const id = g.expenses[0]!.id;
    await waitFor(() => expect(store.records.has(id)).toBe(true));
    cleanup();
    history.replaceState(null, '', `/repartito/#g=${await encodeGroup(deleteExpense(g, id))}`);
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fusionar' }));
    await waitFor(() => expect(store.records.has(id)).toBe(false));
  });

  it('«Borrar todos los datos» borra también las fotos', async () => {
    await piso({ photo: true });
    await waitFor(() => expect(store.records.size).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Volver a tus grupos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Borrar todos los datos' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, seguir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Borrar todo' }));
    await waitFor(() => expect(store.records.size).toBe(0));
  });

  it('eliminar el grupo borra sus fotos', async () => {
    await piso({ photo: true });
    await waitFor(() => expect(store.records.size).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Grupo y personas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar el grupo de este dispositivo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, seguir' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar para siempre' }));
    await waitFor(() => expect(store.records.size).toBe(0));
  });

  it('sin IndexedDB no se ofrece adjuntar fotos', () => {
    setPhotoStore(null);
    demo();
    fireEvent.click(screen.getByRole('button', { name: 'Gasto' }));
    expect(screen.queryByLabelText('Añadir foto del ticket')).toBeNull();
  });
});
