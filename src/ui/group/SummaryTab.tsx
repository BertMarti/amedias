import { useState } from 'react';
import { byCategory, byMonth, CATEGORIES, spentBy, type Group } from '../../core';
import { useI18n } from '../../i18n';
import { Avatar, CategoryTile } from '../bits';
import { useApp } from '../context';
import { currentMonth, memberHue } from '../util';

/** Estadísticas con CSS puro: barras por mes, desglose por categoría y lo que ha gastado cada uno. */
export function SummaryTab({ group }: { group: Group }) {
  const { t, money, month, cat, locale } = useI18n();
  const { settings } = useApp();
  const [range, setRange] = useState<'month' | 'all'>('all');
  const ym = currentMonth();
  const months = byMonth(group, ym, 6);
  const maxMonth = Math.max(1, ...months.map((m) => m.total));
  const cats = byCategory(group, range === 'month' ? ym : undefined);
  const catList = CATEGORIES.map((c) => ({ c, v: cats[c] })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const catTotal = catList.reduce((s, x) => s + x.v, 0);
  const spent = spentBy(group);
  const people = group.members.filter((m) => !m.deleted || (spent[m.id] ?? 0) > 0);
  const maxSpent = Math.max(1, ...people.map((m) => spent[m.id] ?? 0));
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const me = settings.me[group.id];

  return (
    <div className="summary">
      <section className="panel" aria-labelledby="months-title">
        <h2 id="months-title" className="panel-title">
          {t('summary.months')}
        </h2>
        <ol className="month-bars">
          {months.map((m) => (
            <li key={m.month} className={`month-bar${m.month === ym ? ' month-bar--now' : ''}`}>
              <span className="month-bar-value">{m.total > 0 ? money(m.total, group.currency).replace(/[,.]\d{2}(?=\D*$)/, '') : ''}</span>
              <span className="month-bar-track" aria-hidden="true">
                <span className="month-bar-fill" style={{ height: `${(m.total / maxMonth) * 100}%` }} />
              </span>
              <span className="month-bar-label">{month(m.month, 'short')}</span>
              <span className="sr-only">
                {month(m.month)}: {money(m.total, group.currency)}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel" aria-labelledby="cats-title">
        <div className="panel-head">
          <h2 id="cats-title" className="panel-title">
            {t('summary.categories')}
          </h2>
          <div className="segmented" role="group" aria-label={t('summary.range')}>
            <button type="button" aria-pressed={range === 'month'} onClick={() => setRange('month')}>
              {t('summary.thisMonth')}
            </button>
            <button type="button" aria-pressed={range === 'all'} onClick={() => setRange('all')}>
              {t('summary.all')}
            </button>
          </div>
        </div>
        {catList.length === 0 ? (
          <p className="muted">{t('summary.nothing')}</p>
        ) : (
          <>
            <div className="cat-stack" aria-hidden="true">
              {catList.map((x) => (
                <span key={x.c} className={`cat-stack-part cat-${x.c}`} style={{ flexGrow: x.v }} />
              ))}
            </div>
            <ul className="cat-list">
              {catList.map((x) => (
                <li key={x.c}>
                  <CategoryTile category={x.c} size="sm" />
                  <span className="cat-name">{cat(x.c)}</span>
                  <span className="cat-pct">{pct.format(x.v / catTotal)}</span>
                  <span className="amount">{money(x.v, group.currency)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="panel" aria-labelledby="spent-title">
        <h2 id="spent-title" className="panel-title">
          {t('summary.spentBy')}
        </h2>
        <p className="muted small">{t('summary.spentByBody')}</p>
        <ul className="spent-list">
          {people.map((m) => {
            const v = spent[m.id] ?? 0;
            return (
              <li key={m.id}>
                <Avatar member={m} size="sm" me={m.id === me} />
                <span className="spent-name">{m.name}</span>
                <span className="amount">{money(v, group.currency)}</span>
                <span className="spent-bar" aria-hidden="true">
                  <span className={`spent-fill hue-${memberHue(m.id)}`} style={{ width: `${(v / maxSpent) * 100}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
