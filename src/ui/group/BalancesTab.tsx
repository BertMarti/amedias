import { addPayment, balances, settle, today, type Group, type Transfer } from '../../core';
import { useI18n } from '../../i18n';
import { Avatar } from '../bits';
import { Confetti } from '../Confetti';
import { useApp } from '../context';
import { Icon } from '../icons';
import { activeMembers, copyText, isSettled, memberName, vibrate } from '../util';

function TransferRow({ group, tr, me }: { group: Group; tr: Transfer; me?: string }) {
  const { t, money } = useI18n();
  const { commit, toast, triggerCelebrate } = useApp();
  const from = memberName(group, tr.from);
  const to = memberName(group, tr.to);
  const amount = money(tr.amount, group.currency);
  const vars = { from, to, amount, group: group.name };
  const text = tr.to === me ? t('settle.copy.toMe', vars) : tr.from === me ? t('settle.copy.fromMe', vars) : t('settle.copy.neutral', vars);

  const markPaid = () => {
    let settled = false;
    commit(group.id, (g) => {
      const next = addPayment(g, tr.from, tr.to, tr.amount, today());
      settled = isSettled(next);
      return next;
    });
    vibrate();
    toast(t('toast.paymentSaved', { from, to, amount }));
    if (settled) triggerCelebrate();
  };

  return (
    <li className="transfer">
      <div className="transfer-who">
        <Avatar member={{ id: tr.from, name: from }} size="sm" />
        <span className="transfer-names">
          <span>{from}</span>
          <Icon name="arrow" size={16} className="transfer-arrow" />
          <span className="sr-only">{t('settle.paysTo')}</span>
          <span>{to}</span>
        </span>
        <Avatar member={{ id: tr.to, name: to }} size="sm" />
        <span className="amount transfer-amount">{amount}</span>
      </div>
      <div className="transfer-actions">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={async () => toast((await copyText(text)) ? t('toast.copied') : t('toast.copyFailed'), 'info')}
          aria-label={t('settle.copyAria', vars)}
        >
          <Icon name="copy" size={18} />
          {t('settle.copy')}
        </button>
        <button type="button" className="btn btn--mint btn--sm" onClick={markPaid} aria-label={t('settle.markAria', vars)}>
          <Icon name="check" size={18} />
          {t('settle.mark')}
        </button>
      </div>
    </li>
  );
}

export function BalancesTab({ group }: { group: Group }) {
  const { t, money } = useI18n();
  const { settings, celebrate } = useApp();
  const me = settings.me[group.id];
  const bal = balances(group);
  const people = group.members.filter((m) => !m.deleted || (bal[m.id] ?? 0) !== 0);
  const max = Math.max(1, ...people.map((m) => Math.abs(bal[m.id] ?? 0)));
  const transfers = settle(bal);
  const settled = transfers.length === 0;

  return (
    <div className="balances">
      {settled && (
        <section className="panel peace">
          {celebrate > 0 && <Confetti key={celebrate} />}
          <p className="peace-title">{t('settle.peace')}</p>
          <p className="muted">{activeMembers(group).length > 1 ? t('settle.peaceBody') : t('settle.addPeople')}</p>
        </section>
      )}

      <section className="panel" aria-labelledby="bal-title">
        <h2 id="bal-title" className="panel-title">
          {t('balances.title')}
        </h2>
        <ul className="balance-list">
          {people.map((m) => {
            const v = bal[m.id] ?? 0;
            const pct = (Math.abs(v) / max) * 50;
            return (
              <li key={m.id} className={`balance ${v > 0 ? 'balance--pos' : v < 0 ? 'balance--neg' : 'balance--zero'}`}>
                <div className="balance-row">
                  <Avatar member={m} me={m.id === me} />
                  <span className="balance-name">
                    {m.name}
                    {m.id === me && <span className="you"> {t('you.tag')}</span>}
                  </span>
                  <span className="balance-value">
                    {v > 0 ? t('balances.owed', { amount: money(v, group.currency) }) : v < 0 ? t('balances.owes', { amount: money(-v, group.currency) }) : t('balances.even')}
                  </span>
                </div>
                <div className="balance-bar" aria-hidden="true">
                  <span className="balance-axis" />
                  {v !== 0 && <span className="balance-fill" style={{ width: `${Math.max(pct, 1.5)}%` }} />}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {!settled && (
        <section className="panel" aria-labelledby="settle-title">
          <h2 id="settle-title" className="panel-title">
            {t('settle.title')}
          </h2>
          <p className="muted small">{t('settle.body')}</p>
          <ul className="transfer-list">
            {transfers.map((tr) => (
              <TransferRow key={`${tr.from}-${tr.to}`} group={group} tr={tr} me={me} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
