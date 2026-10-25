import { useState } from 'react';
import { liveExpenses, shareOf, type Expense, type Group } from '../../core';
import { useI18n } from '../../i18n';
import { CategoryTile } from '../bits';
import { useApp } from '../context';
import { Icon } from '../icons';
import { memberName } from '../util';

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function ExpenseRow({ group, e, me }: { group: Group; e: Expense; me?: string }) {
  const { t, money, date, cat } = useI18n();
  const { push, highlight } = useApp();
  const share = me ? (shareOf(e.amount, e.split)[me] ?? 0) : null;
  const transfer = e.kind === 'transfer';
  const to = transfer && e.split.mode === 'exact' ? Object.keys(e.split.amounts)[0] : undefined;
  return (
    <li>
      <button
        type="button"
        className={`expense-row${transfer ? ' expense-row--transfer' : ''}${highlight === e.id ? ' expense-row--new' : ''}`}
        onClick={() => push({ t: 'expense', groupId: group.id, expenseId: e.id })}
      >
        {transfer ? (
          <span className="cat-tile cat-tile--transfer" aria-hidden="true">
            <Icon name="swap" />
          </span>
        ) : (
          <CategoryTile category={e.category} />
        )}
        <span className="expense-main">
          <span className="expense-title">{transfer ? t('expense.payment') : e.title}</span>
          <span className="expense-sub">
            {transfer
              ? t('expense.paidTo', { from: memberName(group, e.paidBy), to: to ? memberName(group, to) : '?' })
              : t('expense.paidBy', { name: memberName(group, e.paidBy) })}
            {', '}
            {date(e.date)}
            {!transfer && <span className="sr-only">, {cat(e.category)}</span>}
            {e.recurringId && (
              <span className="tag">
                <Icon name="repeat" size={12} />
                {t('expense.fixed')}
              </span>
            )}
          </span>
        </span>
        <span className="expense-amounts">
          <span className="amount">{money(e.amount, group.currency)}</span>
          {!transfer && share !== null && (
            <span className={`expense-share${share === 0 ? ' expense-share--none' : ''}`}>
              {share === 0 ? t('expense.notIn') : t('expense.yourShare', { amount: money(share, group.currency) })}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/** Filas que se pintan de golpe: con miles de gastos, pintarlos todos atascaría un móvil. */
const PAGE = 150;

export function ExpensesTab({ group }: { group: Group }) {
  const { t, tp, month, money, cat } = useI18n();
  const { settings, push } = useApp();
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const me = settings.me[group.id];
  const all = liveExpenses(group).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const needle = fold(q.trim());
  const list = needle
    ? all.filter((e) => fold(`${e.title} ${cat(e.category)} ${memberName(group, e.paidBy)} ${money(e.amount, group.currency)}`).includes(needle))
    : all;

  const months: { ym: string; items: Expense[]; total: number }[] = [];
  for (const e of list) {
    const ym = e.date.slice(0, 7);
    let m = months[months.length - 1];
    if (!m || m.ym !== ym) {
      m = { ym, items: [], total: 0 };
      months.push(m);
    }
    m.items.push(e);
    if (e.kind === 'expense') m.total += e.amount;
  }
  // Los totales del mes se calculan con todo; solo se recortan las filas que se pintan.
  let budget = limit;
  const visible = months
    .map((m) => {
      const items = m.items.slice(0, Math.max(0, budget));
      budget -= items.length;
      return { ...m, items };
    })
    .filter((m) => m.items.length > 0);

  if (all.length === 0)
    return (
      <div className="panel empty-panel">
        <p className="empty-panel-title">{t('expenses.empty.title')}</p>
        <p>{t('expenses.empty.body')}</p>
        <button type="button" className="btn btn--soft" onClick={() => push({ t: 'expense', groupId: group.id, kind: 'transfer' })}>
          <Icon name="swap" />
          {t('payment.record')}
        </button>
      </div>
    );

  return (
    <div className="expenses">
      <div className="search">
        <Icon name="search" size={20} />
        <label htmlFor="search-expenses" className="sr-only">
          {t('expenses.search')}
        </label>
        <input id="search-expenses" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('expenses.search')} autoComplete="off" enterKeyHint="search" />
      </div>
      {months.length === 0 && <p className="muted center">{t('expenses.noResults')}</p>}
      {visible.map((m) => (
        <section key={m.ym} className="month" aria-label={month(m.ym)}>
          <h2 className="month-head">
            <span className="month-name">{month(m.ym)}</span>
            <span className="month-total">{money(m.total, group.currency)}</span>
          </h2>
          <ul className="expense-list">
            {m.items.map((e) => (
              <ExpenseRow key={e.id} group={group} e={e} me={me} />
            ))}
          </ul>
        </section>
      ))}
      {list.length > limit && (
        <button type="button" className="btn btn--soft btn--block" onClick={() => setLimit(limit + PAGE)}>
          {tp('expenses.more', list.length - limit)}
        </button>
      )}
      <button type="button" className="btn btn--ghost btn--block" onClick={() => push({ t: 'expense', groupId: group.id, kind: 'transfer' })}>
        <Icon name="swap" />
        {t('payment.record')}
      </button>
    </div>
  );
}
