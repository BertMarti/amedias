import type { Group } from '../../core';
import { useI18n, type Key } from '../../i18n';
import { useApp, type Tab } from '../context';
import { Icon, type IconName } from '../icons';
import { SplitDisc } from '../Logo';
import { OfflinePill } from '../OfflinePill';
import { BalancesTab } from './BalancesTab';
import { ExpensesTab } from './ExpensesTab';
import { Hero } from './Hero';
import { RecurringTab } from './RecurringTab';
import { SummaryTab } from './SummaryTab';

const TABS: { id: Tab; icon: IconName; label: Key }[] = [
  { id: 'gastos', icon: 'receipt', label: 'tab.gastos' },
  { id: 'saldos', icon: 'scale', label: 'tab.saldos' },
  { id: 'resumen', icon: 'chart', label: 'tab.resumen' },
  { id: 'fijos', icon: 'repeat', label: 'tab.fijos' },
];

export function GroupScreen({ group, tab }: { group: Group; tab: Tab }) {
  const { t } = useI18n();
  const { goHome, push, setTab } = useApp();
  return (
    <div className="screen group-screen">
      <aside className="group-aside">
        <header className="topbar">
          <button type="button" className="icon-btn" onClick={goHome} aria-label={t('group.back')}>
            <Icon name="back" />
          </button>
          <h1 className="group-title">
            <span aria-hidden="true">{group.emoji}</span> {group.name}
          </h1>
          <div className="topbar-actions">
            <OfflinePill />
            <button type="button" className="icon-btn" onClick={() => push({ t: 'groupSettings', groupId: group.id })} aria-label={t('group.settings')}>
              <Icon name="users" />
            </button>
          </div>
        </header>
        <Hero group={group} />
        <button type="button" className="btn btn--share" onClick={() => push({ t: 'share', groupId: group.id })}>
          <Icon name="share" />
          {t('group.share')}
        </button>
        <nav className="tabbar" aria-label={t('group.sections')}>
          {TABS.map((x) => (
            <button
              key={x.id}
              type="button"
              className={`tab${tab === x.id ? ' tab--on' : ''}`}
              aria-current={tab === x.id ? 'page' : undefined}
              onClick={() => setTab(x.id)}
            >
              <Icon name={x.icon} />
              <span>{t(x.label)}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="group-main" aria-label={t(TABS.find((x) => x.id === tab)!.label)}>
        {tab === 'gastos' && <ExpensesTab group={group} />}
        {tab === 'saldos' && <BalancesTab group={group} />}
        {tab === 'resumen' && <SummaryTab group={group} />}
        {tab === 'fijos' && <RecurringTab group={group} />}
      </main>

      <button type="button" className="fab" onClick={() => push({ t: 'expense', groupId: group.id })}>
        <span className="fab-icon" aria-hidden="true">
          <SplitDisc size={34} gap={2.4} className="fab-disc" />
          <Icon name="plus" size={18} className="fab-plus" />
        </span>
        <span>{t('fab.add')}</span>
      </button>
    </div>
  );
}
