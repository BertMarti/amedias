import { useState } from 'react';
import { addExpense, deleteExpense, parseAmount, splitProblem, today, updateExpense, amountToInput, type Category, type Expense, type Group } from '../../core';
import { useI18n } from '../../i18n';
import { FieldNote } from '../bits';
import { useApp } from '../context';
import { Icon } from '../icons';
import type { SheetProps } from '../Layers';
import { Sheet } from '../Sheet';
import { eligibleMembers, vibrate } from '../util';
import { AmountField, CategoryPicker, MemberPicker, TextField } from './fields';
import { SplitEditor } from './SplitEditor';
import { draftFrom, draftToSplit } from './splitDraft';
import { TransferForm } from './TransferForm';

function ExpenseForm({ group, expense, formId, onDone }: { group: Group; expense?: Expense; formId: string; onDone: () => void }) {
  const { t, locale } = useI18n();
  const { settings, commit, toast, setHighlight, setTab } = useApp();
  const me = settings.me[group.id];
  const members = eligibleMembers(group, expense);
  const [amount, setAmount] = useState(expense ? amountToInput(expense.amount, group.currency, locale) : '');
  const [title, setTitle] = useState(expense?.title ?? '');
  const [category, setCategory] = useState<Category>(expense?.category ?? 'compra');
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? (members.some((m) => m.id === me) ? me! : (members[0]?.id ?? '')));
  const [date, setDate] = useState(expense?.date ?? today());
  const [draft, setDraft] = useState(() => draftFrom(expense?.split, members, group.currency, locale));
  const [touched, setTouched] = useState(false);
  const cents = parseAmount(amount, group.currency);
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date);

  const save = () => {
    setTouched(true);
    const { split, inputError } = draftToSplit(draft, members, group.currency);
    if (cents === null || !dateOk || inputError || !paidBy) return;
    if (splitProblem(cents, split, new Set(members.map((m) => m.id)))) return;
    const input = { kind: 'expense' as const, title, amount: cents, paidBy, split, category, date };
    if (expense) {
      commit(group.id, (g) => updateExpense(g, expense.id, input));
      toast(t('toast.expenseSaved'));
    } else {
      let newId: string | null = null;
      commit(group.id, (g) => {
        const next = addExpense(g, input);
        newId = next.expenses[next.expenses.length - 1]?.id ?? null;
        return next;
      });
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
      <AmountField value={amount} onChange={setAmount} currency={group.currency} touched={touched} autoFocus={!expense} />
      <TextField label={t('expense.title')} value={title} onChange={setTitle} placeholder={t('expense.titlePh')} />
      <CategoryPicker value={category} onChange={setCategory} />
      <MemberPicker legend={t('expense.paidByLabel')} name="paid-by" members={members} value={paidBy} onChange={setPaidBy} me={me} />
      <SplitEditor draft={draft} onChange={setDraft} amount={cents} members={members} currency={group.currency} me={me} />
      <TextField label={t('expense.date')} type="date" value={date} onChange={setDate} />
      {touched && !dateOk && <FieldNote>{t('expense.dateBad')}</FieldNote>}
    </form>
  );
}

export function ExpenseSheet({ active, onClose, group, expenseId, kind }: SheetProps & { group: Group; expenseId?: string; kind?: 'expense' | 'transfer' }) {
  const { t } = useI18n();
  const { commit, confirm, toast, pop } = useApp();
  const expense = expenseId ? group.expenses.find((e) => e.id === expenseId && !e.deleted) : undefined;
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
        commit(group.id, (g) => deleteExpense(g, expense!.id));
        pop();
        toast(t('toast.deleted'));
      },
    });

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
        <ExpenseForm key="e" group={group} expense={expense} formId={formId} onDone={onClose} />
      ) : (
        <TransferForm key="t" group={group} expense={expense} formId={formId} onDone={onClose} />
      )}
    </Sheet>
  );
}
