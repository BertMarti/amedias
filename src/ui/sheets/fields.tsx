/** Campos compartidos por las hojas de gasto, pago y gasto fijo (el importe está en MoneyField.tsx). */
import { useId } from 'react';
import { CATEGORIES, type Category, type Member } from '../../core';
import { useI18n } from '../../i18n';
import { Avatar, Choice } from '../bits';
import { Icon } from '../icons';

export function CategoryPicker({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  const { t, cat } = useI18n();
  return (
    <fieldset className="field">
      <legend className="field-label">{t('expense.category')}</legend>
      <div className="chips chips--cats">
        {CATEGORIES.map((c) => (
          <Choice key={c} type="radio" name="category" checked={value === c} onChange={() => onChange(c)} className={`chip--cat cat-${c}`}>
            <Icon name={c} size={18} />
            {cat(c)}
          </Choice>
        ))}
      </div>
    </fieldset>
  );
}

export function MemberPicker({ legend, name, members, value, onChange, me, exclude }: { legend: string; name: string; members: Member[]; value: string; onChange: (id: string) => void; me?: string; exclude?: string }) {
  return (
    <fieldset className="field">
      <legend className="field-label">{legend}</legend>
      <div className="chips">
        {members
          .filter((m) => m.id !== exclude)
          .map((m) => (
            <Choice key={m.id} type="radio" name={name} checked={value === m.id} onChange={() => onChange(m.id)}>
              <Avatar member={m} size="sm" me={m.id === me} />
              {m.name}
            </Choice>
          ))}
      </div>
    </fieldset>
  );
}

export function TextField({ label, value, onChange, placeholder, maxLength = 120, type = 'text', autoFocus = false }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; type?: string; autoFocus?: boolean }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        className="input"
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        {...(autoFocus ? { 'data-autofocus': true } : {})}
      />
    </div>
  );
}
