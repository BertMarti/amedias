import { useId, useState } from 'react';
import { cleanText, CURRENCIES, LIMITS, newGroup, type Currency } from '../../core';
import { useI18n } from '../../i18n';
import { FieldNote } from '../bits';
import { useApp } from '../context';
import { Icon } from '../icons';
import type { SheetProps } from '../Layers';
import { Sheet } from '../Sheet';
import { TextField } from './fields';

export const EMOJIS = ['🏠', '🍕', '✈️', '🏖️', '💑', '🎉', '🚗', '🛒', '⛺', '🎓', '🐶', '💸'];

export function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  const { t } = useI18n();
  return (
    <fieldset className="field">
      <legend className="field-label">{t('newGroup.emoji')}</legend>
      <div className="emoji-grid">
        {EMOJIS.map((e) => (
          <label key={e} className={`emoji-opt${value === e ? ' emoji-opt--on' : ''}`}>
            <input type="radio" name="emoji" checked={value === e} onChange={() => onChange(e)} aria-label={e} />
            <span aria-hidden="true">{e}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CurrencySelect({ value, onChange, disabled }: { value: Currency; onChange: (c: Currency) => void; disabled?: (c: Currency) => boolean }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {t('newGroup.currency')}
      </label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value as Currency)}>
        {CURRENCIES.map((c) => (
          <option key={c} value={c} disabled={disabled?.(c)}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}

export function NewGroupSheet({ active, onClose }: SheetProps) {
  const { t } = useI18n();
  const { openGroup, addOrMerge, setMe, toast } = useApp();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏠');
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [people, setPeople] = useState<string[]>(['', '', '']);
  const [meIdx, setMeIdx] = useState(0);
  const [touched, setTouched] = useState(false);
  const clean = people.map((p) => cleanText(p, LIMITS.name));
  const filled = clean.filter(Boolean);
  const dupes = new Set(filled).size !== filled.length;
  const enough = new Set(filled).size >= 2;

  const create = () => {
    setTouched(true);
    if (!enough || dupes) return;
    const g = newGroup(name || t('newGroup.defaultName'), people, currency, emoji);
    const myName = clean[meIdx] || filled[0];
    const me = g.members.find((m) => m.name === myName) ?? g.members[0]!;
    addOrMerge([g]);
    setMe(g.id, me.id);
    openGroup(g.id);
    toast(t('toast.groupCreated', { name: g.name }));
  };

  return (
    <Sheet
      title={t('newGroup.title')}
      active={active}
      onClose={onClose}
      footer={
        <button type="submit" form="form-new-group" className="btn btn--primary btn--grow">
          <Icon name="check" />
          {t('newGroup.create')}
        </button>
      }
    >
      <form
        id="form-new-group"
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
      >
        <TextField label={t('newGroup.name')} value={name} onChange={setName} placeholder={t('newGroup.namePh')} maxLength={LIMITS.name} autoFocus />
        <EmojiPicker value={emoji} onChange={setEmoji} />
        <CurrencySelect value={currency} onChange={setCurrency} />
        <fieldset className="field">
          <legend className="field-label">{t('newGroup.people')}</legend>
          <p className="muted small">{t('newGroup.peopleHint')}</p>
          <ul className="people-edit">
            {people.map((p, i) => (
              <li key={i} className="person-row">
                <input
                  className="input"
                  value={p}
                  maxLength={LIMITS.name}
                  aria-label={t('newGroup.personN', { n: i + 1 })}
                  placeholder={t(meIdx === i ? 'newGroup.myNamePh' : 'newGroup.personPh')}
                  onChange={(e) => setPeople(people.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <label className={`me-toggle${meIdx === i ? ' me-toggle--on' : ''}`}>
                  <input type="radio" name="new-me" checked={meIdx === i} onChange={() => setMeIdx(i)} aria-label={t('newGroup.thisIsMe', { n: i + 1 })} />
                  <span aria-hidden="true">{t('newGroup.me')}</span>
                </label>
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  aria-label={t('newGroup.removePerson', { n: i + 1 })}
                  disabled={people.length <= 2}
                  onClick={() => {
                    setPeople(people.filter((_, j) => j !== i));
                    setMeIdx(meIdx === i ? 0 : meIdx > i ? meIdx - 1 : meIdx);
                  }}
                >
                  <Icon name="close" size={18} />
                </button>
              </li>
            ))}
          </ul>
          {people.length < LIMITS.members && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPeople([...people, ''])}>
              <Icon name="plus" size={18} />
              {t('newGroup.addPerson')}
            </button>
          )}
          {touched && !enough && <FieldNote>{t('newGroup.needTwo')}</FieldNote>}
          {dupes && <FieldNote>{t('newGroup.dupes')}</FieldNote>}
        </fieldset>
      </form>
    </Sheet>
  );
}
