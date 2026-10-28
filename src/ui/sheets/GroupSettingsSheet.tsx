import { useState } from 'react';
import { addMember, balances, decimals, deleteTemplate, hasForeign, liveExpenses, liveTemplates, LIMITS, renameGroup, updateMember, type Currency, type Group, type Member } from '../../core';
import { useI18n } from '../../i18n';
import { Avatar, CategoryTile, FieldNote } from '../bits';
import { useApp } from '../context';
import { Icon } from '../icons';
import type { SheetProps } from '../Layers';
import { Sheet } from '../Sheet';
import { activeMembers, memberInUse } from '../util';
import { TextField } from './fields';
import { CurrencySelect, EmojiPicker } from './NewGroupSheet';

function MemberRow({ group, m, me }: { group: Group; m: Member; me?: string }) {
  const { t } = useI18n();
  const { commit, setMe, confirm, toast } = useApp();
  const [name, setName] = useState(m.name);
  const removable = (balances(group)[m.id] ?? 0) === 0 && !memberInUse(group, m.id) && m.id !== me;
  const rename = () => {
    if (name.trim() && name.trim() !== m.name) {
      commit(group.id, (g) => updateMember(g, m.id, { name }));
      toast(t('toast.renamed'));
    }
  };
  return (
    <li className="member-row">
      <Avatar member={m} me={m.id === me} />
      <input
        className="input"
        value={name}
        maxLength={LIMITS.name}
        aria-label={t('members.nameOf', { name: m.name })}
        onChange={(e) => setName(e.target.value)}
        onBlur={rename}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            rename();
          }
        }}
      />
      <button type="button" className={`btn btn--sm ${m.id === me ? 'btn--mint' : 'btn--ghost'}`} aria-pressed={m.id === me} onClick={() => setMe(group.id, m.id)}>
        {m.id === me ? t('members.isMe') : t('members.setMe')}
      </button>
      <button
        type="button"
        className="icon-btn icon-btn--sm"
        disabled={!removable}
        aria-label={t('members.remove', { name: m.name })}
        title={removable ? undefined : t('members.cantRemove')}
        onClick={() =>
          confirm({
            title: t('members.removeTitle', { name: m.name }),
            body: t('members.removeBody'),
            confirmLabel: t('members.removeConfirm'),
            danger: true,
            onConfirm: () => commit(group.id, (g) => updateMember(g, m.id, { deleted: true })),
          })
        }
      >
        <Icon name="trash" size={18} />
      </button>
    </li>
  );
}

/** Plantillas del grupo: se crean desde un gasto («Guardar como plantilla») y aquí se pueden borrar. */
function Templates({ group }: { group: Group }) {
  const { t, money, locale } = useI18n();
  const { commit, toast } = useApp();
  const list = liveTemplates(group, locale);
  return (
    <section className="form" aria-labelledby="gs-templates">
      <h3 id="gs-templates" className="section-title">
        {t('template.title')}
      </h3>
      <p className="muted small">{t('template.hint')}</p>
      {list.length === 0 ? (
        <p className="muted small">{t('template.empty')}</p>
      ) : (
        <ul className="template-list">
          {list.map((x) => (
            <li key={x.id} className="template-row">
              <CategoryTile category={x.category} size="sm" />
              <span className="template-name">{x.title}</span>
              <span className="template-amount">{x.amount !== undefined ? money(x.amount, group.currency) : t('template.free')}</span>
              <button
                type="button"
                className="icon-btn icon-btn--sm"
                aria-label={t('template.delete', { name: x.title })}
                onClick={() => {
                  commit(group.id, (g) => deleteTemplate(g, x.id));
                  toast(t('template.deleted'));
                }}
              >
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function GroupSettingsSheet({ active, onClose, group }: SheetProps & { group: Group }) {
  const { t } = useI18n();
  const { settings, commit, confirm, removeGroup, goHome, toast } = useApp();
  const me = settings.me[group.id];
  const [name, setName] = useState(group.name);
  const [emoji, setEmoji] = useState(group.emoji);
  const [currency, setCurrency] = useState<Currency>(group.currency);
  const [newPerson, setNewPerson] = useState('');
  const hasExpenses = liveExpenses(group).length > 0 || group.recurring.some((r) => !r.deleted);
  // Con gastos en otras monedas, su cambio es respecto a la moneda del grupo: no se puede cambiar.
  const foreign = hasForeign(group);
  const members = activeMembers(group);
  const dirty = name !== group.name || emoji !== group.emoji || currency !== group.currency;

  const add = () => {
    if (!newPerson.trim()) return;
    commit(group.id, (g) => addMember(g, newPerson));
    toast(t('toast.personAdded', { name: newPerson.trim() }));
    setNewPerson('');
  };

  const askDelete = () =>
    confirm({
      title: t('groupSettings.deleteTitle', { name: group.name }),
      body: t('groupSettings.deleteBody'),
      confirmLabel: t('groupSettings.deleteNext'),
      danger: true,
      onConfirm: () =>
        confirm({
          title: t('groupSettings.deleteSure'),
          body: t('groupSettings.deleteSureBody'),
          confirmLabel: t('groupSettings.deleteConfirm'),
          danger: true,
          onConfirm: () => {
            removeGroup(group.id);
            goHome();
            toast(t('toast.groupDeleted'));
          },
        }),
    });

  return (
    <Sheet title={t('groupSettings.title')} active={active} onClose={onClose}>
      <section className="form" aria-labelledby="gs-group">
        <h3 id="gs-group" className="section-title">
          {t('groupSettings.group')}
        </h3>
        <TextField label={t('newGroup.name')} value={name} onChange={setName} maxLength={LIMITS.name} />
        <EmojiPicker value={emoji} onChange={setEmoji} />
        {/* Cambiar entre monedas con distinto número de decimales cambiaría los importes guardados. */}
        <CurrencySelect
          value={currency}
          onChange={setCurrency}
          disabled={(c) => (foreign && c !== group.currency) || (hasExpenses && decimals(c) !== decimals(group.currency))}
        />
        {foreign ? (
          <FieldNote tone="muted">{t('groupSettings.currencyForeign', { currency: group.currency })}</FieldNote>
        ) : (
          hasExpenses && <FieldNote tone="muted">{t('groupSettings.currencyNote')}</FieldNote>
        )}
        <button
          type="button"
          className="btn btn--primary"
          disabled={!dirty}
          onClick={() => {
            commit(group.id, (g) => renameGroup(g, { name, emoji, currency }));
            toast(t('toast.saved'));
          }}
        >
          <Icon name="check" />
          {t('save')}
        </button>
      </section>

      <section className="form" aria-labelledby="gs-people">
        <h3 id="gs-people" className="section-title">
          {t('members.title')}
        </h3>
        <p className="muted small">{t('members.hint')}</p>
        <ul className="member-list">
          {members.map((m) => (
            <MemberRow key={`${m.id}-${m.updatedAt}`} group={group} m={m} me={me} />
          ))}
        </ul>
        <form
          className="add-person"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            className="input"
            value={newPerson}
            maxLength={LIMITS.name}
            onChange={(e) => setNewPerson(e.target.value)}
            placeholder={t('members.addPh')}
            aria-label={t('members.add')}
          />
          <button type="submit" className="btn btn--soft" disabled={!newPerson.trim() || members.length >= LIMITS.members}>
            <Icon name="plus" />
            {t('members.add')}
          </button>
        </form>
      </section>

      <Templates group={group} />

      <section className="danger-zone">
        <button type="button" className="btn btn--ghost btn--danger-text" onClick={askDelete}>
          <Icon name="trash" />
          {t('groupSettings.delete')}
        </button>
      </section>
    </Sheet>
  );
}
