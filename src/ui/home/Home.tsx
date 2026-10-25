import { balances, liveExpenses, type Group } from '../../core';
import { useI18n } from '../../i18n';
import { MyStatus } from '../bits';
import { useApp } from '../context';
import { buildDemo } from '../demo';
import { Icon } from '../icons';
import { SplitDisc, Wordmark } from '../Logo';
import { OfflinePill } from '../OfflinePill';
import { activeMembers } from '../util';
import { EmptyArt } from './EmptyArt';

function GroupCard({ group }: { group: Group }) {
  const { t, tp } = useI18n();
  const { settings, openGroup } = useApp();
  const me = settings.me[group.id];
  const people = activeMembers(group).length;
  const count = liveExpenses(group).filter((e) => e.kind === 'expense').length;
  const mine = me ? (balances(group)[me] ?? 0) : null;
  return (
    <li>
      <button type="button" className="group-card" onClick={() => openGroup(group.id)}>
        <span className="group-emoji" aria-hidden="true">
          {group.emoji}
        </span>
        <span className="group-card-main">
          <span className="group-card-name">{group.name}</span>
          <span className="group-card-meta">
            {tp('home.people', people)}, {tp('home.expenses', count)}
          </span>
        </span>
        <span className="group-card-status">
          {mine === null ? <span className="status status--zero status--compact">{t('home.pickMe')}</span> : <MyStatus cents={mine} currency={group.currency} compact />}
        </span>
      </button>
    </li>
  );
}

export function Home() {
  const { t, lang } = useI18n();
  const { groups, push, addOrMerge, setMe, openGroup, toast } = useApp();
  const sorted = [...groups].sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));

  const tryDemo = () => {
    const { group, meId } = buildDemo(lang);
    addOrMerge([group]);
    setMe(group.id, meId);
    openGroup(group.id);
    toast(t('toast.demo'));
  };

  return (
    <div className="screen home">
      <header className="topbar">
        <Wordmark size={26} />
        <div className="topbar-actions">
          <OfflinePill />
          <button type="button" className="icon-btn" onClick={() => push({ t: 'settings' })} aria-label={t('settings.title')}>
            <Icon name="sliders" />
          </button>
        </div>
      </header>

      {sorted.length === 0 ? (
        <section className="empty" aria-labelledby="empty-title">
          <EmptyArt />
          <h1 id="empty-title" className="display">
            {t('home.empty.title')}
          </h1>
          <p className="lede">{t('home.empty.body')}</p>
          <div className="stack">
            <button type="button" className="btn btn--primary btn--big" onClick={() => push({ t: 'newGroup' })}>
              <Icon name="plus" />
              {t('home.newGroup')}
            </button>
            <button type="button" className="btn btn--soft" onClick={tryDemo}>
              <Icon name="sparkle" />
              {t('home.demo')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => push({ t: 'import' })}>
              <Icon name="link" />
              {t('home.open')}
            </button>
          </div>
        </section>
      ) : (
        <section className="home-list" aria-labelledby="groups-title">
          <div className="home-head">
            <h1 id="groups-title" className="display display--md">
              {t('home.title')}
            </h1>
            <SplitDisc size={40} className="home-head-disc" />
          </div>
          <ul className="group-list">
            {sorted.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </ul>
          <div className="home-actions">
            <button type="button" className="btn btn--primary btn--big" onClick={() => push({ t: 'newGroup' })}>
              <Icon name="plus" />
              {t('home.newGroup')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => push({ t: 'import' })}>
              <Icon name="link" />
              {t('home.open')}
            </button>
          </div>
        </section>
      )}

      <footer className="home-foot">
        <p>{t('about.privacy')}</p>
      </footer>
    </div>
  );
}
