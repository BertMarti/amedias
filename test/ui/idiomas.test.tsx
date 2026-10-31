import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../../src/App';
import { loadSettings } from '../../src/core';

const device = (tags: string[]) => {
  Object.defineProperty(navigator, 'language', { value: tags[0], configurable: true });
  Object.defineProperty(navigator, 'languages', { value: tags, configurable: true });
};

beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, '', '/repartito/');
});

afterEach(() => {
  cleanup();
  device(['es-ES', 'es']);
});

describe('idioma de la interfaz', () => {
  it('la primera vez habla el idioma del dispositivo y lo pone en <html lang>', () => {
    device(['gl-ES', 'es']);
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Contas claras e amizades longas.' })).toBeTruthy();
    expect(document.documentElement.lang).toBe('gl-ES');
    expect(document.title).toBe('Repartito: gastos compartidos sen contas');
  });

  it('portugués del dispositivo (también de Brasil): portugués de Portugal', () => {
    device(['pt-BR']);
    render(<App />);
    expect(screen.getByRole('button', { name: 'Experimentar com um grupo de exemplo' })).toBeTruthy();
    expect(document.documentElement.lang).toBe('pt-PT');
  });

  it('en Ajustes se elige entre los cinco idiomas y la elección se guarda', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    const sheet = screen.getByRole('dialog', { name: 'Ajustes' });
    const group = within(sheet).getByRole('group', { name: 'Idioma' });
    expect(within(group).getAllByRole('radio')).toHaveLength(5);
    for (const name of ['Español', 'Català', 'Galego', 'Português', 'English']) expect(within(group).getByLabelText(name)).toBeTruthy();
    expect(within(group).getByLabelText('Español')).toHaveProperty('checked', true);

    fireEvent.click(within(group).getByLabelText('Català'));
    expect(screen.getByRole('dialog', { name: 'Configuració' })).toBeTruthy();
    expect(document.documentElement.lang).toBe('ca-ES');
    expect(loadSettings(localStorage, ['en-US']).lang).toBe('ca');
    // Cada nombre va marcado con su idioma, para los lectores de pantalla.
    expect(within(screen.getByRole('group', { name: 'Llengua' })).getByText('Português').getAttribute('lang')).toBe('pt-PT');
  });

  it('lo elegido gana al idioma del dispositivo al volver a abrir', () => {
    localStorage.setItem('repartito:v1:ajustes', JSON.stringify({ lang: 'pt', theme: 'auto', me: {} }));
    device(['ca-ES']);
    render(<App />);
    expect(screen.getByRole('button', { name: 'Definições' })).toBeTruthy();
  });

  it('el grupo de ejemplo sale en catalán, con importes en formato catalán', () => {
    device(['ca-ES']);
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Prova-ho amb un grup d’exemple' }));
    expect(screen.getByRole('heading', { name: /Pis d’exemple/ })).toBeTruthy();
    expect(screen.getByText('Pizzes del divendres')).toBeTruthy();
    expect(screen.getAllByText(/1\.200,00\s€/).length).toBeGreaterThan(0);
  });
});
