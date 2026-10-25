/**
 * Modelo de datos de Repartito. Todo el dinero va en **céntimos enteros** (nunca decimales flotantes).
 *
 * Cada entidad lleva `id` (UUID) y `updatedAt` (ms): así dos copias del mismo grupo editadas en
 * móviles distintos se fusionan sin servidor (ver merge.ts). Borrar es marcar `deleted: true`
 * (lápida), para que el borrado también viaje al fusionar.
 */
export type Id = string;
export type Cents = number;
/** Fecha local `AAAA-MM-DD`. */
export type IsoDate = string;

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'MXN', 'ARS', 'COP', 'CLP', 'PEN', 'JPY'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CATEGORIES = [
  'compra',
  'casa',
  'facturas',
  'restaurante',
  'ocio',
  'transporte',
  'viaje',
  'salud',
  'regalos',
  'otros',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Split =
  /** A partes iguales entre `among`. */
  | { mode: 'equal'; among: Id[] }
  /** Importes exactos por persona; deben sumar el total. */
  | { mode: 'exact'; amounts: Record<Id, Cents> }
  /** Por partes (p. ej. 2 partes la habitación grande, 1 la pequeña). */
  | { mode: 'shares'; shares: Record<Id, number> }
  /** Por porcentajes en puntos básicos (10 000 = 100 %); deben sumar 10 000. */
  | { mode: 'percent'; basisPoints: Record<Id, number> };

export interface Member {
  id: Id;
  name: string;
  updatedAt: number;
  deleted?: boolean;
}

export interface Expense {
  id: Id;
  /** `expense`: un gasto; `transfer`: un pago entre personas para saldar (de `paidBy` a quien indique el reparto). */
  kind: 'expense' | 'transfer';
  title: string;
  amount: Cents;
  paidBy: Id;
  split: Split;
  category: Category;
  date: IsoDate;
  /** Si lo generó un gasto fijo: su id. */
  recurringId?: Id;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

/** Gasto fijo mensual (alquiler, internet, suscripciones). Se materializa en un gasto por mes. */
export interface Recurring {
  id: Id;
  title: string;
  amount: Cents;
  paidBy: Id;
  split: Split;
  category: Category;
  /** Día del mes en que se apunta (1-28, para que exista todos los meses). */
  day: number;
  /** Primer mes en que se aplica, `AAAA-MM`. */
  startMonth: string;
  /** Último mes en que se aplica, si termina (`AAAA-MM`). */
  endMonth?: string;
  updatedAt: number;
  deleted?: boolean;
}

export interface Group {
  /** Versión del formato, para migraciones. */
  v: 1;
  id: Id;
  name: string;
  emoji: string;
  currency: Currency;
  members: Member[];
  expenses: Expense[];
  recurring: Recurring[];
  createdAt: number;
  /** Momento del último cambio del nombre, emoji o moneda. */
  updatedAt: number;
}

export interface Transfer {
  from: Id;
  to: Id;
  amount: Cents;
}

/** Límites que aplica cualquier dato que entra de fuera (enlaces, archivos, CSV). */
export const LIMITS = {
  members: 50,
  expenses: 20_000,
  recurring: 100,
  text: 120,
  name: 40,
  /** 10 millones en la unidad de la moneda. */
  amount: 1_000_000_000,
} as const;
