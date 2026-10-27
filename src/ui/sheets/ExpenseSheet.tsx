import { useState } from 'react';
import {
  addExpense,
  amountToInput,
  deleteExpense,
  liveTemplates,
  parseAmount,
  repeatInput,
  saveTemplate,
  splitProblem,
  today,
  updateExpense,
  type Category,
  type Expense,
  type Group,
  type Template,
  type TemplateInput,
} from '../../core';
import { useI18n, type Key } from '../../i18n';
import { CategoryTile, FieldNote } from '../bits';
import { useApp } from '../context';
import { Icon } from '../icons';
import type { SheetProps } from '../Layers';
import { photos } from '../photos';
import { Sheet } from '../Sheet';
import { eligibleMembers, vibrate } from '../util';
import { AmountField, CategoryPicker, MemberPicker, TextField } from './fields';
import { PhotoField, usePhotoDraft } from './PhotoField';
import { SplitEditor } from './SplitEditor';
import { draftFrom, draftToSplit, problemKey } from './splitDraft';
import { TransferForm } from './TransferForm';

/** Lo que trae un gasto nuevo copiado de otro («Repetir») o de una plantilla. */
type Prefill = TemplateInput;

/** Fila de plantillas al apuntar un gasto: un toque y el formulario queda relleno. */
function TemplatePicker({ group, onPick }: { group: Group; onPick: (t: Template) => void }) {
  const { t, money, locale } = useI18n();
  const list = liveTemplates(group, locale);
  if (list.length === 0) return null;
  return (
    <div className="field">
      <span className="field-label" id="tpl-legend">
        {t('template.legend')}
      </span>
      <div className="chips template-chips" role="group" aria-labelledby="tpl-legend">
        {list.map((x) => (
          <button key={x.id} type="button" className="chip chip--template" onClick={() => onPick(x)} aria-label={t('template.use', { name: x.title })}>
            <CategoryTile category={x.category} size="sm" />
            <span className="chip-label">{x.title}</span>
            <span className="chip-hint">{x.amount !== undefined ? money(x.amount, group.currency) : t('template.free')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExpenseForm({ group, expense, prefill, formId, onDone }: { group: Group; expense?: Expense; prefill?: Prefill; formId: string; onDone: () => void }) {
  const { t, locale } = useI18n();
  const { settings, commit, toast, setHighlight, setTab } = useApp();
  const me = settings.me[group.id];
  const members = eligibleMembers(group, expense);
  const src = expense ?? prefill;
  const defaultPayer = members.some((m) => m.id === me) ? me! : (members[0]?.id ?? '');
  const payerOf = (id: string | undefined) => (id && members.some((m) => m.id === id) ? id : defaultPayer);
  const [amount, setAmount] = useState(src?.amount !== undefined ? amountToInput(src.amount, group.currency, locale) : '');
  const [title, setTitle] = useState(src?.title ?? '');
  const [category, setCategory] = useState<Category>(src?.category ?? 'compra');
  const [paidBy, setPaidBy] = useState(payerOf(src?.paidBy));
  const [date, setDate] = useState(expense?.date ?? today());
  const [draft, setDraft] = useState(() => draftFrom(src?.split, members, group.currency, locale));
  const [touched, setTouched] = useState(false);
  const [tplError, setTplError] = useState<Key | null>(null);
  const photo = usePhotoDraft(expense?.id);
  const cents = parseAmount(amount, group.currency);
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const memberIds = new Set(members.map((m) => m.id));

  const pickTemplate = (x: Template) => {
    setTitle(x.title);
    setAmount(x.amount !== undefined ? amountToInput(x.amount, group.currency, locale) : '');
    setCategory(x.category);
    setPaidBy(payerOf(x.paidBy));
    setDraft(draftFrom(x.split, members, group.currency, locale));
    setTplError(null);
    vibrate();
  };

  const asTemplate = () => {
    const name = title.trim();
    if (!name) return setTplError('template.needTitle');
    const typed = amount.trim() !== '';
    if (typed && cents === null) return setTplError('expense.amountBad');
    const { split, inputError } = draftToSplit(draft, members, group.currency);
    if (inputError) return setTplError('split.err.input');
    if (!typed && split.mode === 'exact') return setTplError('template.needAmount');
    const problem = problemKey(splitProblem(typed ? cents! : 0, split, memberIds));
    if (problem || !paidBy) return setTplError(problem ?? 'split.err.pick');
    setTplError(null);
    commit(group.id, (g) => saveTemplate(g, { title: name, ...(typed && { amount: cents! }), paidBy, split, category }));
    toast(t('template.saved', { name }));
  };

  const save = () => {
    setTouched(true);
    const { split, inputError } = draftToSplit(draft, members, group.currency);
    if (cents === null || !dateOk || inputError || !paidBy) return;
    if (splitProblem(cents, split, memberIds)) return;
    const input = { kind: 'expense' as const, title, amount: cents, paidBy, split, category, date };
    if (expense) {
      commit(group.id, (g) => updateExpense(g, expense.id, input));
      photo.persist(expense.id, group.id, () => toast(t('photo.saveError'), 'error'));
      toast(t('toast.expenseSaved'));
    } else {
      let newId: string | null = null;
      commit(group.id, (g) => {
        const next = addExpense(g, input);
        newId = next.expenses[next.expenses.length - 1]?.id ?? null;
        return next;
      });
      if (newId) photo.persist(newId, group.id, () => toast(t('photo.saveError'), 'error'));
      setHighlight(newId);
      setTab('gastos');
      vibrate();
      toast(t('toast.expenseAdded'));
    }
    onDone();
  };

  return (
    <form
      id={formId}
      className="form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {expense?.recurringId && (
        <FieldNote tone="muted">
          <Icon name="repeat" size={14} /> {t('expense.fromFixed')}
        </FieldNote>
      )}
      {!expense && <TemplatePicker group={group} onPick={pickTemplate} />}
      <AmountField value={amount} onChange={setAmount} currency={group.currency} touched={touched} autoFocus={!expense} />
      <TextField label={t('expense.title')} value={title} onChange={setTitle} placeholder={t('expense.titlePh')} />
      <CategoryPicker value={category} onChange={setCategory} />
      <MemberPicker legend={t('expense.paidByLabel')} name="paid-by" members={members} value={paidBy} onChange={setPaidBy} me={me} />
      <SplitEditor draft={draft} onChange={setDraft} amount={cents} members={members} currency={group.currency} me={me} />
      <TextField label={t('expense.date')} type="date" value={date} onChange={setDate} />
      {touched && !dateOk && <FieldNote>{t('expense.dateBad')}</FieldNote>}
      {photos() && <PhotoField draft={photo} title={title || t('expense.new')} />}
      <div className="template-save">
        <button type="button" className="btn btn--ghost btn--sm" onClick={asTemplate}>
          <Icon name="bookmark" size={18} />
          {t('template.save')}
        </button>
        {tplError && <FieldNote>{t(tplError)}</FieldNote>}
      </div>
    </form>
  );
}

export function ExpenseSheet({ active, onClose, group, expenseId, kind, repeatOf }: SheetProps & { group: Group; expenseId?: string; kind?: 'expense' | 'transfer'; repeatOf?: string }) {
  const { t } = useI18n();
  const { commit, confirm, toast, pop, layers, setLayers } = useApp();
  const expense = expenseId ? group.expenses.find((e) => e.id === expenseId && !e.deleted) : undefined;
  const source = repeatOf ? group.expenses.find((e) => e.id === repeatOf && !e.deleted && e.kind === 'expense') : undefined;
  const [mode, setMode] = useState<'expense' | 'transfer'>(expense?.kind ?? kind ?? 'expense');
  const formId = `form-${mode}`;
  if (expenseId && !expense) return null;

  const askDelete = () =>
    confirm({
      title: mode === 'transfer' ? t('payment.deleteTitle') : t('expense.deleteTitle'),
      body: t('expense.deleteBody'),
      confirmLabel: t('delete'),
      danger: true,
      onConfirm: () => {
        // Al borrarlo, el almacén se lleva también su foto (ver `commit`).
        commit(group.id, (g) => deleteExpense(g, expense!.id));
        pop();
        toast(t('toast.deleted'));
      },
    });

  // «Repetir»: esta hoja se cambia por la de un gasto nuevo igual, con fecha de hoy.
  const repeat = () => setLayers([...layers.slice(0, -1), { t: 'expense', groupId: group.id, repeatOf: expense!.id }]);

  const title = expense ? (mode === 'transfer' ? t('payment.edit') : t('expense.edit')) : mode === 'transfer' ? t('payment.record') : t('expense.new');

  return (
    <Sheet
      title={title}
      active={active}
      onClose={onClose}
      footer={
        <>
          {expense && (
            <button type="button" className="btn btn--ghost btn--danger-text" onClick={askDelete}>
              <Icon name="trash" />
              {t('delete')}
            </button>
          )}
          <button type="submit" form={formId} className="btn btn--primary btn--grow">
            <Icon name="check" />
            {expense ? t('save') : mode === 'transfer' ? t('payment.save') : t('expense.add')}
          </button>
        </>
      }
    >
      {expense?.kind === 'expense' && (
        <div className="repeat-bar">
          <button type="button" className="btn btn--soft btn--sm" onClick={repeat} aria-describedby="repeat-hint">
            <Icon name="repeat" size={18} />
            {t('expense.repeat')}
          </button>
          <span id="repeat-hint" className="muted small">
            {t('expense.repeatHint')}
          </span>
        </div>
      )}
      {!expense && (
        <div className="segmented segmented--wide" role="group" aria-label={t('expense.kind')}>
          <button type="button" aria-pressed={mode === 'expense'} onClick={() => setMode('expense')}>
            {t('expense.kindExpense')}
          </button>
          <button type="button" aria-pressed={mode === 'transfer'} onClick={() => setMode('transfer')}>
            {t('expense.kindPayment')}
          </button>
        </div>
      )}
      {mode === 'expense' ? (
        <ExpenseForm key="e" group={group} expense={expense} prefill={source ? repeatInput(source) : undefined} formId={formId} onDone={onClose} />
      ) : (
        <TransferForm key="t" group={group} expense={expense} formId={formId} onDone={onClose} />
      )}
    </Sheet>
  );
}
