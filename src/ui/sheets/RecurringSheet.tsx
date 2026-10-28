import { useId, useState } from 'react';
import { addRecurring, materializeRecurring, splitProblem, today, updateRecurring, type Category, type Group } from '../../core';
import { useI18n } from '../../i18n';
import { useApp } from '../context';
import { Icon } from '../icons';
import type { SheetProps } from '../Layers';
import { Sheet } from '../Sheet';
import { addMonths, currentMonth, eligibleMembers } from '../util';
import { CategoryPicker, MemberPicker, TextField } from './fields';
import { MoneyField, moneyDraftFrom, readMoney } from './MoneyField';
import { SplitEditor } from './SplitEditor';
import { draftFrom, draftToSplit } from './splitDraft';

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function RecurringSheet({ active, onClose, group, recurringId }: SheetProps & { group: Group; recurringId?: string }) {
  const { t, tp, locale, month } = useI18n();
  const { settings, commit, toast, confirm, pop } = useApp();
  const r = recurringId ? group.recurring.find((x) => x.id === recurringId && !x.deleted) : undefined;
  const me = settings.me[group.id];
  const members = eligibleMembers(group, r);
  const ym = currentMonth();
  const [title, setTitle] = useState(r?.title ?? '');
  const [money, setMoney] = useState(() => moneyDraftFrom(group, r, locale));
  const [category, setCategory] = useState<Category>(r?.category ?? 'casa');
  const [paidBy, setPaidBy] = useState(r?.paidBy ?? (members.some((m) => m.id === me) ? me! : (members[0]?.id ?? '')));
  const [day, setDay] = useState(String(r?.day ?? Math.min(28, Number(today().slice(8, 10)))));
  const [start, setStart] = useState(r?.startMonth ?? ym);
  const [end, setEnd] = useState(r?.endMonth ?? '');
  const [draft, setDraft] = useState(() => draftFrom(r?.split, members, group.currency, locale));
  const [touched, setTouched] = useState(false);
  const mv = readMoney(money, group.currency);
  const cents = mv.cents;
  if (recurringId && !r) return null;

  const startOptions = Array.from({ length: 25 }, (_, i) => addMonths(ym, i - 12));
  if (!startOptions.includes(start)) startOptions.unshift(start);
  const endOptions = Array.from({ length: 37 }, (_, i) => addMonths(start, i));
  if (end && !endOptions.includes(end)) endOptions.push(end);

  const apply = (fn: (g: Group) => Group) => {
    let added = 0;
    commit(group.id, (g) => {
      const res = materializeRecurring(fn(g), today());
      added = res.added;
      return res.group;
    });
    return added;
  };

  const save = () => {
    setTouched(true);
    const { split, inputError } = draftToSplit(draft, members, group.currency);
    if (cents === null || mv.problem || inputError || !paidBy || splitProblem(cents, split, new Set(members.map((m) => m.id)))) return;
    // `original: undefined` al editar quita la otra moneda si se volvió a la del grupo.
    const input = { title, amount: cents, original: mv.original, paidBy, split, category, day: Number(day), startMonth: start, ...(end ? { endMonth: end } : {}) };
    const added = apply((g) => (r ? updateRecurring(g, r.id, { ...input, endMonth: end || undefined }) : addRecurring(g, input)));
    toast(added > 0 ? tp('toast.recurring', added) : t('toast.fixedSaved'));
    onClose();
  };

  const footer = (
    <>
      {r && (
        <button
          type="button"
          className="btn btn--ghost btn--danger-text"
          onClick={() =>
            confirm({
              title: t('fixed.deleteTitle'),
              body: t('fixed.deleteBody'),
              confirmLabel: t('delete'),
              danger: true,
              onConfirm: () => {
                commit(group.id, (g) => updateRecurring(g, r.id, { deleted: true }));
                pop();
                toast(t('toast.deleted'));
              },
            })
          }
        >
          <Icon name="trash" />
          {t('delete')}
        </button>
      )}
      <button type="submit" form="form-recurring" className="btn btn--primary btn--grow">
        <Icon name="check" />
        {r ? t('save') : t('fixed.add')}
      </button>
    </>
  );

  return (
    <Sheet title={r ? t('fixed.edit') : t('fixed.new')} active={active} onClose={onClose} footer={footer} description={t('fixed.sheetExplain')}>
      <form
        id="form-recurring"
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <MoneyField group={group} value={money} onChange={setMoney} touched={touched} autoFocus={!r} />
        <TextField label={t('expense.title')} value={title} onChange={setTitle} placeholder={t('fixed.titlePh')} />
        <CategoryPicker value={category} onChange={setCategory} />
        <MemberPicker legend={t('fixed.paidBy')} name="fixed-paid-by" members={members} value={paidBy} onChange={setPaidBy} me={me} />
        <SplitEditor draft={draft} onChange={setDraft} amount={cents} members={members} currency={group.currency} me={me} exactHint={mv.foreign ? t('fx.exactNote', { currency: group.currency }) : undefined} />
        <div className="field-row">
          <Select
            label={t('fixed.day')}
            value={day}
            onChange={setDay}
            options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: t('fixed.dayN', { n: i + 1 }) }))}
          />
          <Select label={t('fixed.start')} value={start} onChange={setStart} options={startOptions.map((m) => ({ value: m, label: month(m) }))} />
        </div>
        <Select
          label={t('fixed.end')}
          value={end}
          onChange={setEnd}
          options={[{ value: '', label: t('fixed.noEnd') }, ...endOptions.map((m) => ({ value: m, label: month(m) }))]}
        />
        {r && !r.endMonth && (
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => {
              commit(group.id, (g) => updateRecurring(g, r.id, { endMonth: ym }));
              toast(t('toast.fixedEnded', { month: month(ym) }));
              onClose();
            }}
          >
            <Icon name="calendar" />
            {t('fixed.endNow')}
          </button>
        )}
      </form>
    </Sheet>
  );
}
