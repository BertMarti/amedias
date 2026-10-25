import { useState } from 'react';
import { addPayment, amountToInput, parseAmount, today, updateExpense, type Expense, type Group } from '../../core';
import { eligibleMembers, isSettled } from '../util';
import { useI18n } from '../../i18n';
import { FieldNote } from '../bits';
import { useApp } from '../context';
import { AmountField, MemberPicker, TextField } from './fields';

/** «Registrar un pago»: alguien le devuelve dinero a otra persona (Bizum, transferencia, efectivo). */
export function TransferForm({ group, expense, formId, onDone }: { group: Group; expense?: Expense; formId: string; onDone: () => void }) {
  const { t, locale } = useI18n();
  const { settings, commit, toast, triggerCelebrate } = useApp();
  const me = settings.me[group.id];
  const members = eligibleMembers(group, expense);
  const firstTo = expense && expense.split.mode === 'exact' ? Object.keys(expense.split.amounts)[0] : undefined;
  const [amount, setAmount] = useState(expense ? amountToInput(expense.amount, group.currency, locale) : '');
  const [from, setFrom] = useState(expense?.paidBy ?? (members.some((m) => m.id === me) ? me! : (members[0]?.id ?? '')));
  const [to, setTo] = useState(firstTo ?? members.find((m) => m.id !== (expense?.paidBy ?? me ?? members[0]?.id))?.id ?? '');
  const [date, setDate] = useState(expense?.date ?? today());
  const [touched, setTouched] = useState(false);
  const cents = parseAmount(amount, group.currency);
  const valid = cents !== null && from && to && from !== to && /^\d{4}-\d{2}-\d{2}$/.test(date);

  const save = () => {
    setTouched(true);
    if (!valid || cents === null) return;
    let settled = false;
    commit(group.id, (g) => {
      const next = expense
        ? updateExpense(g, expense.id, { kind: 'transfer', title: expense.title, amount: cents, paidBy: from, split: { mode: 'exact', amounts: { [to]: cents } }, category: 'otros', date })
        : addPayment(g, from, to, cents, date);
      settled = isSettled(next);
      return next;
    });
    toast(expense ? t('toast.expenseSaved') : t('toast.paymentRecorded'));
    if (settled && !expense) triggerCelebrate();
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
      <p className="muted small">{t('payment.explain')}</p>
      <AmountField value={amount} onChange={setAmount} currency={group.currency} touched={touched} autoFocus={!expense} />
      <MemberPicker
        legend={t('payment.from')}
        name="pay-from"
        members={members}
        value={from}
        me={me}
        onChange={(id) => {
          setFrom(id);
          if (id === to) setTo(members.find((m) => m.id !== id)?.id ?? '');
        }}
      />
      <MemberPicker legend={t('payment.to')} name="pay-to" members={members} value={to} onChange={setTo} me={me} exclude={from} />
      <TextField label={t('expense.date')} type="date" value={date} onChange={setDate} />
      {touched && !valid && cents !== null && <FieldNote>{t('payment.invalid')}</FieldNote>}
    </form>
  );
}
