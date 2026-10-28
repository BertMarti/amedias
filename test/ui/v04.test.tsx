import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import App from '../../src/App';
import { baseAmount, loadGroups, type Group } from '../../src/core';

let fetchMock: Mock;

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, '', '/repartito/');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  expect(fetchMock).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

const money = (text: string) => new RegExp(text.replace(/\s/g, '\\s'));
const group = (): Group => loadGroups().groups[0]!;
const dialog = (name: string) => screen.getByRole('dialog', { name });

/** Viaje en euros con Alex (tú) y Ana. */
function viaje() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Nuevo grupo' }));
  const sheet = dialog('Nuevo grupo');
  fireEvent.change(within(sheet).getByLabelText('Nombre'), { target: { value: 'Japón' } });
  fireEvent.change(within(sheet).getByLabelText('Persona 1'), { target: { value: 'Alex' } });
  fireEvent.change(within(sheet).getByLabelText('Persona 2'), { target: { value: 'Ana' } });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Crear grupo' }));
}

/** Apunta «Ramen»: 3500 ¥ con 1 EUR = 161,5 JPY. */
function ramen() {
  fireEvent.click(screen.getByRole('button', { name: 'Gasto' }));
  const exp = dialog('Nuevo gasto');
  fireEvent.change(within(exp).getByLabelText('Importe'), { target: { value: '3500' } });
  fireEvent.change(within(exp).getByLabelText('Moneda del importe'), { target: { value: 'JPY' } });
  // Sin cambio todavía: una pista, no un error.
  expect(within(exp).getByText('¿Cuántos JPY son 1 EUR? Míralo en tu banco o en el recibo de la tarjeta.')).toBeTruthy();
  fireEvent.change(within(exp).getByLabelText('Cambio: JPY por 1 EUR'), { target: { value: '161,5' } });
  expect(within(exp).getByText(money('≈ 21,67 €'))).toBeTruthy();
  fireEvent.change(within(exp).getByLabelText('Concepto'), { target: { value: 'Ramen' } });
  fireEvent.click(within(exp).getByRole('button', { name: 'Añadir gasto' }));
  expect(screen.queryByRole('dialog')).toBeNull();
}

describe('varias monedas (v0.4.0)', () => {
  it('apunta un gasto en yenes: guarda el original y el equivalente, y la lista enseña los dos', () => {
    viaje();
    ramen();
    const e = group().expenses[0]!;
    expect(e).toMatchObject({ amount: 2167, original: { currency: 'JPY', amount: 3500, rate: 161_500_000 } });
    expect(e.original).not.toHaveProperty('inverse');
    expect(baseAmount(e.original!, 'EUR')).toBe(e.amount);
    const row = screen.getByRole('button', { name: /Ramen/ });
    expect(within(row).getByText(money('21,67 €'))).toBeTruthy();
    expect(within(row).getByText(money('3500 JPY'))).toBeTruthy();
    expect(within(row).getByText('pagado en')).toBeTruthy();
    // Los saldos van en euros.
    fireEvent.click(screen.getByRole('button', { name: 'Saldos' }));
    expect(screen.queryAllByText(money('1[01],8[34] €')).length).toBeGreaterThan(0);
  });

  it('el siguiente gasto en esa moneda propone el último cambio, y se puede escribir al revés', () => {
    viaje();
    ramen();
    fireEvent.click(screen.getByRole('button', { name: 'Gasto' }));
    const exp = dialog('Nuevo gasto');
    fireEvent.change(within(exp).getByLabelText('Moneda del importe'), { target: { value: 'JPY' } });
    expect((within(exp).getByLabelText('Cambio: JPY por 1 EUR') as HTMLInputElement).value).toBe('161,5');
    fireEvent.click(within(exp).getByRole('button', { name: 'Escribirlo al revés: EUR por 1 JPY' }));
    const inv = within(exp).getByLabelText('Cambio: EUR por 1 JPY') as HTMLInputElement;
    expect(inv.value).toBe('0,006192');
    fireEvent.change(inv, { target: { value: '0,0062' } });
    fireEvent.change(within(exp).getByLabelText('Importe'), { target: { value: '3500' } });
    expect(within(exp).getByText(money('≈ 21,70 €'))).toBeTruthy();
    fireEvent.change(within(exp).getByLabelText('Concepto'), { target: { value: 'Gyozas' } });
    fireEvent.click(within(exp).getByRole('button', { name: 'Añadir gasto' }));
    expect(group().expenses.find((e) => e.title === 'Gyozas')).toMatchObject({ amount: 2170, original: { currency: 'JPY', amount: 3500, rate: 6200, inverse: true } });
  });

  it('no guarda sin un cambio válido', () => {
    viaje();
    fireEvent.click(screen.getByRole('button', { name: 'Gasto' }));
    const exp = dialog('Nuevo gasto');
    fireEvent.change(within(exp).getByLabelText('Importe'), { target: { value: '20' } });
    fireEvent.change(within(exp).getByLabelText('Moneda del importe'), { target: { value: 'USD' } });
    fireEvent.click(within(exp).getByRole('button', { name: 'Añadir gasto' }));
    expect(within(exp).getByText('Escribe el cambio, por ejemplo 161,5')).toBeTruthy();
    fireEvent.change(within(exp).getByLabelText('Cambio: USD por 1 EUR'), { target: { value: '1,2,3' } });
    expect(within(exp).getByText(/Ese cambio no se entiende/)).toBeTruthy();
    fireEvent.click(within(exp).getByRole('button', { name: 'Añadir gasto' }));
    fireEvent.change(within(exp).getByLabelText('Cambio: USD por 1 EUR'), { target: { value: '0,000001' } });
    expect(within(exp).getByText(/sale demasiado/)).toBeTruthy();
    fireEvent.click(within(exp).getByRole('button', { name: 'Añadir gasto' }));
    expect(group().expenses).toHaveLength(0);
    fireEvent.change(within(exp).getByLabelText('Cambio: USD por 1 EUR'), { target: { value: '1,08' } });
    fireEvent.click(within(exp).getByRole('button', { name: 'Añadir gasto' }));
    expect(group().expenses[0]).toMatchObject({ amount: 1852, original: { currency: 'USD', amount: 2000, rate: 1_080_000 } });
  });

  it('los importes exactos van en la moneda del grupo y deben sumar el equivalente', () => {
    viaje();
    fireEvent.click(screen.getByRole('button', { name: 'Gasto' }));
    const exp = dialog('Nuevo gasto');
    fireEvent.change(within(exp).getByLabelText('Importe'), { target: { value: '3500' } });
    fireEvent.change(within(exp).getByLabelText('Moneda del importe'), { target: { value: 'JPY' } });
    fireEvent.change(within(exp).getByLabelText('Cambio: JPY por 1 EUR'), { target: { value: '161,5' } });
    fireEvent.click(within(exp).getByRole('button', { name: 'Importes' }));
    expect(within(exp).getByText('Los importes de cada persona van en EUR, la moneda del grupo.')).toBeTruthy();
    fireEvent.change(within(exp).getByLabelText('Importe de Alex'), { target: { value: '11,67' } });
    fireEvent.change(within(exp).getByLabelText('Importe de Ana'), { target: { value: '10' } });
    expect(within(exp).getByText('Cuadra con el total')).toBeTruthy();
    fireEvent.click(within(exp).getByRole('button', { name: 'Añadir gasto' }));
    const e = group().expenses[0]!;
    expect(e.amount).toBe(2167);
    expect(e.split).toMatchObject({ mode: 'exact' });
    expect(Object.values(e.split.mode === 'exact' ? e.split.amounts : {}).sort()).toEqual([1000, 1167]);
  });

  it('al editar se ve en su moneda; volver a la del grupo quita el original', () => {
    viaje();
    ramen();
    fireEvent.click(screen.getByRole('button', { name: /Ramen/ }));
    const edit = dialog('Editar gasto');
    expect((within(edit).getByLabelText('Moneda del importe') as HTMLSelectElement).value).toBe('JPY');
    expect((within(edit).getByLabelText('Importe') as HTMLInputElement).value).toBe('3500');
    expect((within(edit).getByLabelText('Cambio: JPY por 1 EUR') as HTMLInputElement).value).toBe('161,5');
    fireEvent.change(within(edit).getByLabelText('Moneda del importe'), { target: { value: 'EUR' } });
    expect(within(edit).queryByLabelText('Cambio: JPY por 1 EUR')).toBeNull();
    fireEvent.change(within(edit).getByLabelText('Importe'), { target: { value: '22' } });
    fireEvent.click(within(edit).getByRole('button', { name: 'Guardar' }));
    expect(group().expenses[0]).toMatchObject({ amount: 2200 });
    expect(group().expenses[0]).not.toHaveProperty('original');
  });

  it('«Repetir hoy» copia también la moneda y el cambio', () => {
    viaje();
    ramen();
    fireEvent.click(screen.getByRole('button', { name: /Ramen/ }));
    fireEvent.click(within(dialog('Editar gasto')).getByRole('button', { name: 'Repetir hoy' }));
    const nuevo = dialog('Nuevo gasto');
    expect((within(nuevo).getByLabelText('Moneda del importe') as HTMLSelectElement).value).toBe('JPY');
    fireEvent.click(within(nuevo).getByRole('button', { name: 'Añadir gasto' }));
    const live = group().expenses.filter((e) => !e.deleted);
    expect(live).toHaveLength(2);
    expect(live[1]!.original).toEqual(live[0]!.original);
  });

  it('un pago en otra moneda', () => {
    viaje();
    ramen();
    fireEvent.click(screen.getByRole('button', { name: 'Gasto' }));
    const sheet = dialog('Nuevo gasto');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Un pago' }));
    const pay = dialog('Registrar un pago');
    fireEvent.change(within(pay).getByLabelText('Importe'), { target: { value: '1000' } });
    fireEvent.change(within(pay).getByLabelText('Moneda del importe'), { target: { value: 'JPY' } });
    expect((within(pay).getByLabelText('Cambio: JPY por 1 EUR') as HTMLInputElement).value).toBe('161,5');
    fireEvent.click(within(pay).getByRole('button', { name: 'Guardar pago' }));
    const p = group().expenses.find((e) => e.kind === 'transfer')!;
    expect(p).toMatchObject({ amount: 619, original: { currency: 'JPY', amount: 1000 } });
    expect(p.split).toEqual({ mode: 'exact', amounts: { [Object.keys(p.split.mode === 'exact' ? p.split.amounts : {})[0]!]: 619 } });
  });

  it('con gastos en otras monedas, la moneda del grupo no se puede cambiar', () => {
    viaje();
    ramen();
    fireEvent.click(screen.getByRole('button', { name: 'Grupo y personas' }));
    const gs = dialog('Grupo y personas');
    expect(within(gs).getByText(/Hay gastos en otras monedas con su cambio respecto a EUR/)).toBeTruthy();
    const select = within(gs).getByLabelText('Moneda') as HTMLSelectElement;
    const enabled = [...select.options].filter((o) => !o.disabled).map((o) => o.value);
    expect(enabled).toEqual(['EUR']);
  });
});
