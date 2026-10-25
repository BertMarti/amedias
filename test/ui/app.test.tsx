import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import App from '../../src/App';
import { addExpense, encodeGroup, loadGroups, newGroup, type Group } from '../../src/core';

let fetchMock: Mock;

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, '', '/amedias/');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  // La app nunca hace peticiones de red: ni analítica, ni CDN, ni nada.
  expect(fetchMock).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

const money = (text: string) => new RegExp(text.replace(/\s/g, '\\s'));

function createGroupWithExpense() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
  const sheet = screen.getByRole('dialog', { name: 'Nuevo grupo' });
  fireEvent.change(within(sheet).getByLabelText('Nombre'), { target: { value: 'Piso' } });
  expect(within(sheet).getByLabelText('Persona 1')).toHaveProperty('placeholder', 'Tu nombre');
  fireEvent.change(within(sheet).getByLabelText('Persona 1'), { target: { value: 'Alex' } });
  fireEvent.change(within(sheet).getByLabelText('Persona 2'), { target: { value: 'Ana' } });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Crear grupo' }));

  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('heading', { name: /Piso/ })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Gasto' }));
  const exp = screen.getByRole('dialog', { name: 'Nuevo gasto' });
  fireEvent.change(within(exp).getByLabelText('Importe'), { target: { value: '30' } });
  expect(within(exp).getByText(money('30,00 €'))).toBeTruthy();
  fireEvent.change(within(exp).getByLabelText('Concepto'), { target: { value: 'Compra del súper' } });
  fireEvent.click(within(exp).getByRole('button', { name: 'Añadir gasto' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('Compra del súper')).toBeTruthy();
}

describe('interfaz', () => {
  it('crea un grupo, añade un gasto y muestra los saldos', () => {
    createGroupWithExpense();
    // Tú pagaste 30 € a medias con Ana: te deben 15 €.
    expect(screen.getByText('Te deben')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Saldos' }));
    expect(screen.getByText(money('le deben 15,00 €'))).toBeTruthy();
    expect(screen.getByText(money('debe 15,00 €'))).toBeTruthy();
    expect(loadGroups().groups[0]!.expenses).toHaveLength(1);
  });

  it('«Marcar como pagado» deja a todo el mundo en paz', () => {
    createGroupWithExpense();
    fireEvent.click(screen.getByRole('button', { name: 'Saldos' }));
    const plan = screen.getByRole('heading', { name: 'Cómo quedar a cero' }).closest('section')!;
    expect(within(plan).getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(within(plan).getByRole('button', { name: /Marcar como pagado/ }));
    expect(screen.getByText('¡Estáis en paz!')).toBeTruthy();
    expect(screen.getAllByText('en paz')).toHaveLength(2);
    expect(screen.queryByRole('heading', { name: 'Cómo quedar a cero' })).toBeNull();
  });

  it('crea el grupo de ejemplo', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Probar con un grupo de ejemplo' }));
    expect(screen.getByRole('heading', { name: /Piso de ejemplo/ })).toBeTruthy();
    const g = loadGroups().groups[0]!;
    expect(g.members.map((m) => m.name)).toEqual(['Alex', 'Marta', 'Leo']);
    expect(g.recurring).toHaveLength(1);
    expect(g.expenses.length).toBeGreaterThanOrEqual(12);
    expect(screen.getAllByText('Alquiler').length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: 'Fijos' }));
    expect(screen.getByText('Alquiler')).toBeTruthy();
  });
});

function sharedGroup(): Group {
  let g = newGroup('Viaje a Lisboa', ['Ana', 'Luis'], 'EUR', '✈️');
  const [ana, luis] = g.members.map((m) => m.id) as [string, string];
  g = addExpense(g, { title: 'Hotel', amount: 24000, paidBy: ana, split: { mode: 'equal', among: [ana, luis] }, category: 'viaje', date: '2026-10-02' });
  return g;
}

describe('abrir un enlace compartido', () => {
  it('borra el #g= al momento, enseña el grupo y lo añade', async () => {
    const payload = await encodeGroup(sharedGroup());
    history.replaceState(null, '', `/amedias/#g=${payload}`);
    render(<App />);
    expect(location.hash).toBe('');
    expect(location.href).not.toContain(payload);

    const add = await screen.findByRole('button', { name: 'Añadir este grupo' });
    const sheet = screen.getByRole('dialog', { name: 'Grupo recibido' });
    expect(within(sheet).getByText('Viaje a Lisboa')).toBeTruthy();
    expect(within(sheet).getByText('Ana, Luis')).toBeTruthy();
    expect(within(sheet).getByText('1 gasto')).toBeTruthy();
    fireEvent.click(add);

    const who = screen.getByRole('dialog', { name: '¿Quién eres tú?' });
    fireEvent.click(within(who).getByRole('button', { name: 'Luis' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Debes')).toBeTruthy();
    expect(loadGroups().groups.map((g) => g.name)).toEqual(['Viaje a Lisboa']);
  });

  it('con contraseña: la pide y avisa si es incorrecta', async () => {
    const payload = await encodeGroup(sharedGroup(), 'mango-lima-42');
    history.replaceState(null, '', `/amedias/#g=${payload}`);
    render(<App />);
    expect(location.hash).toBe('');

    const pass = screen.getByLabelText('Contraseña');
    fireEvent.change(pass, { target: { value: 'otra' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(await screen.findByText(/La contraseña no es correcta/, {}, { timeout: 20_000 })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'mango-lima-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    expect(await screen.findByRole('button', { name: 'Añadir este grupo' }, { timeout: 20_000 })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Viaje a Lisboa')).toBeTruthy());
  }, 60_000);

  it('un enlace dañado da un mensaje claro', async () => {
    history.replaceState(null, '', '/amedias/#g=1.AAAA');
    render(<App />);
    expect(location.hash).toBe('');
    expect(await screen.findByText(/incompleto o dañado/)).toBeTruthy();
  });
});

describe('auditoría de seguridad (interfaz)', () => {
  it('F4: un enlace con ediciones fechadas en el futuro no se puede fusionar', async () => {
    const g = sharedGroup();
    g.expenses[0]!.updatedAt = Date.now() + 700 * 24 * 3600 * 1000;
    history.replaceState(null, '', `/amedias/#g=${await encodeGroup(g)}`);
    render(<App />);
    expect(await screen.findByText(/fecha futura/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Añadir este grupo' })).toBeNull();
    expect(loadGroups().groups).toHaveLength(0);
  });

  it('F2: al fusionar se enseña también lo que se borra', async () => {
    const g = sharedGroup();
    localStorage.setItem('amedias:v1:grupos', JSON.stringify([g]));
    const borrado = { ...g, expenses: g.expenses.map((e) => ({ ...e, deleted: true, updatedAt: e.updatedAt + 1 })) };
    history.replaceState(null, '', `/amedias/#g=${await encodeGroup(borrado)}`);
    render(<App />);
    expect(await screen.findByText('1 gasto borrado')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fusionar' }));
    expect(loadGroups().groups[0]!.expenses[0]!.deleted).toBe(true);
  });

  it('F11: los datos dañados se apartan con fecha y se pueden recuperar desde Ajustes', () => {
    localStorage.setItem('amedias:v1:grupos', JSON.stringify([{ v: 1, id: 'roto' }]));
    render(<App />);
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('amedias:v1:grupos-danados:'));
    expect(keys).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    expect(screen.getByText(/1 copia de datos que no se pudo abrir/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Descargar apartados' })).toBeTruthy();
  });
});

describe('contraseña generada (F7)', () => {
  it('cuatro bloques de cuatro símbolos sin ambigüedades, distintos cada vez', async () => {
    const { generatePassphrase } = await import('../../src/ui/util');
    const all = Array.from({ length: 200 }, generatePassphrase);
    for (const p of all) expect(p).toMatch(/^[a-hjkmnp-z2-9]{4}(-[a-hjkmnp-z2-9]{4}){3}$/);
    expect(new Set(all).size).toBe(200);
  });
});
