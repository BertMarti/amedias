import { balances, liveExpenses, spentBy, type Group } from '../../core';
import { useI18n } from '../../i18n';
import { useApp } from '../context';
import { Icon } from '../icons';
import { SplitDisc } from '../Logo';

/**
 * La tarjeta protagonista: tu saldo en grande. El disco gira media vuelta con cada gasto y se orienta
 * según el estado (menta arriba si te deben, tomate si debes, de canto si estás en paz).
 */
export function Hero({ group }: { group: Group }) {
  const { t, money, tp } = useI18n();
  const { settings, push } = useApp();
  const me = settings.me[group.id];
  const live = liveExpenses(group);
  const mine = me ? (balances(group)[me] ?? 0) : 0;
  const total = Object.values(spentBy(group)).reduce((s, v) => s + v, 0);
  const count = live.filter((e) => e.kind === 'expense').length;
  const state = !me ? 'unknown' : mine > 0 ? 'pos' : mine < 0 ? 'neg' : 'zero';
  const base = state === 'neg' ? 180 : state === 'zero' ? 90 : 0;
  const rotation = base + live.length * 180;

  return (
    <section className={`hero hero--${state}`} aria-label={t('hero.aria')}>
      <SplitDisc size={180} gap={3} className="hero-disc" style={{ transform: `rotate(${rotation}deg)` }} />
      <div className="hero-content">
        {state === 'unknown' ? (
          <>
            <p className="hero-label">{t('hero.unknown')}</p>
            <button type="button" className="btn btn--on-ink" onClick={() => push({ t: 'whoami', groupId: group.id })}>
              <Icon name="user" />
              {t('whoami.title')}
            </button>
          </>
        ) : (
          <>
            <p className="hero-label">
              <Icon name={state === 'pos' ? 'up' : state === 'neg' ? 'down' : 'check'} size={18} />
              {state === 'pos' ? t('hero.owed') : state === 'neg' ? t('hero.owe') : t('hero.even')}
            </p>
            <p className="hero-amount">{state === 'zero' ? t('hero.evenBig') : money(Math.abs(mine), group.currency)}</p>
          </>
        )}
        <p className="hero-meta">{tp('hero.total', count, { amount: money(total, group.currency) })}</p>
      </div>
    </section>
  );
}
