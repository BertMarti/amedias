import type { Group } from '../../core';
import { useI18n } from '../../i18n';
import { CategoryTile } from '../bits';
import { useApp } from '../context';
import { Icon } from '../icons';
import { currentMonth, memberName } from '../util';

export function RecurringTab({ group }: { group: Group }) {
  const { t, money, month } = useI18n();
  const { push } = useApp();
  const ym = currentMonth();
  const list = group.recurring.filter((r) => !r.deleted).sort((a, b) => a.day - b.day || a.title.localeCompare(b.title));

  return (
    <div className="recurring">
      <section className="panel explainer">
        <Icon name="repeat" size={26} />
        <p>{t('fixed.explain')}</p>
      </section>
      {list.length === 0 ? (
        <p className="muted center">{t('fixed.empty')}</p>
      ) : (
        <ul className="recurring-list">
          {list.map((r) => {
            const ended = r.endMonth !== undefined && r.endMonth < ym;
            return (
              <li key={r.id}>
                <button type="button" className={`recurring-row${ended ? ' recurring-row--ended' : ''}`} onClick={() => push({ t: 'recurring', groupId: group.id, recurringId: r.id })}>
                  <CategoryTile category={r.category} />
                  <span className="expense-main">
                    <span className="expense-title">{r.title}</span>
                    <span className="expense-sub">
                      {t('fixed.when', { day: r.day, name: memberName(group, r.paidBy) })}
                      {ended
                        ? ` ${t('fixed.ended', { month: month(r.endMonth!) })}`
                        : r.endMonth
                          ? ` ${t('fixed.until', { month: month(r.endMonth) })}`
                          : r.startMonth > ym
                            ? ` ${t('fixed.from', { month: month(r.startMonth) })}`
                            : ''}
                    </span>
                  </span>
                  <span className="amount">{money(r.amount, group.currency)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="btn btn--soft btn--block" onClick={() => push({ t: 'recurring', groupId: group.id })}>
        <Icon name="plus" />
        {t('fixed.add')}
      </button>
    </div>
  );
}
