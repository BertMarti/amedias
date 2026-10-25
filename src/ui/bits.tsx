/** Piezas pequeñas reutilizables: avatar, chips de elección y estado de saldo. */
import type { ReactNode } from 'react';
import type { Cents, Currency, Member } from '../core';
import { useI18n } from '../i18n';
import { Icon } from './icons';
import { initial, memberHue } from './util';

export function Avatar({ member, size = 'md', me = false }: { member: Pick<Member, 'id' | 'name'>; size?: 'sm' | 'md' | 'lg'; me?: boolean }) {
  return (
    <span className={`avatar avatar--${size} hue-${memberHue(member.id)}${me ? ' avatar--me' : ''}`} aria-hidden="true">
      {initial(member.name)}
    </span>
  );
}

interface ChoiceProps {
  type: 'radio' | 'checkbox';
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  hint?: ReactNode;
}

/** Un chip que es un input real (radio o checkbox): accesible por teclado y por lector de pantalla. */
export function Choice({ type, name, checked, onChange, children, disabled, className, hint }: ChoiceProps) {
  return (
    <label className={`chip${checked ? ' chip--on' : ''}${className ? ` ${className}` : ''}${disabled ? ' chip--off' : ''}`}>
      <input type={type} name={name} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="chip-label">{children}</span>
      {hint !== undefined && <span className="chip-hint">{hint}</span>}
    </label>
  );
}

/** «Te deben 23,40 €» / «Debes 12,00 €» / «Estás en paz», con icono además de color. */
export function MyStatus({ cents, currency, compact = false }: { cents: Cents; currency: Currency; compact?: boolean }) {
  const { t, money } = useI18n();
  if (cents > 0)
    return (
      <span className={`status status--pos${compact ? ' status--compact' : ''}`}>
        <Icon name="up" size={16} />
        {t('status.owed', { amount: money(cents, currency) })}
      </span>
    );
  if (cents < 0)
    return (
      <span className={`status status--neg${compact ? ' status--compact' : ''}`}>
        <Icon name="down" size={16} />
        {t('status.owe', { amount: money(-cents, currency) })}
      </span>
    );
  return (
    <span className={`status status--zero${compact ? ' status--compact' : ''}`}>
      <Icon name="check" size={16} />
      {t('status.even')}
    </span>
  );
}

export function CategoryTile({ category, size = 'md' }: { category: string; size?: 'sm' | 'md' }) {
  return (
    <span className={`cat-tile cat-${category} cat-tile--${size}`} aria-hidden="true">
      <Icon name={category} size={size === 'sm' ? 18 : 22} />
    </span>
  );
}

/** Mensaje inline de error o aviso asociado a un campo. */
export function FieldNote({ id, tone = 'error', children }: { id?: string; tone?: 'error' | 'ok' | 'muted'; children: ReactNode }) {
  return (
    <p id={id} className={`field-note field-note--${tone}`}>
      {children}
    </p>
  );
}
