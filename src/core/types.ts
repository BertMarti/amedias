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

/**
 * Importe pagado en otra moneda (v0.4.0), p. ej. una cena en yenes en un viaje en euros. El `amount` del gasto es su
 * equivalente en la moneda del grupo, calculado una vez y guardado (ver fx.ts); saldos y repartos solo usan `amount`.
 */
export interface Original {
  /** Distinta de la moneda del grupo. */
  currency: Currency;
  /** En la unidad mínima de `currency` (yenes; céntimos de dólar). */
  amount: Cents;
  /**
   * Tipo de cambio en millonésimas, tal como se escribió: 1 [moneda del grupo] = rate / 1e6 [`currency`]
   * (o, con `inverse`, 1 [`currency`] = rate / 1e6 [moneda del grupo]).
   */
  rate: number;
  inverse?: true;
}

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
  /** Si se pagó en otra moneda: el importe y el cambio que se escribieron (`amount` es su equivalente). */
  original?: Original;
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
  /** Si se paga en otra moneda, con un cambio fijo (v0.4.0). */
  original?: Original;
  updatedAt: number;
  deleted?: boolean;
}

/**
 * Plantilla para apuntar en dos toques un gasto habitual («Súper», «Bombona», «Luz»). Es del grupo: viaja en los
 * enlaces y se fusiona igual que lo demás (id UUID, `updatedAt` y lápidas).
 */
export interface Template {
  id: Id;
  /** Nombre de la plantilla y concepto del gasto. */
  title: string;
  /** Importe habitual. Sin él, se escribe al usarla (la luz cambia cada mes). */
  amount?: Cents;
  paidBy: Id;
  /** Sin importe, el reparto no puede ser por importes exactos. */
  split: Split;
  category: Category;
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
  /** Plantillas de gasto (v0.3.0). Los datos anteriores no las traen: se leen como lista vacía. */
  templates: Template[];
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
  /** Plantillas, lápidas incluidas. */
  templates: 100,
  text: 120,
  name: 40,
  /** 10 millones en la unidad de la moneda. */
  amount: 1_000_000_000,
} as const;
