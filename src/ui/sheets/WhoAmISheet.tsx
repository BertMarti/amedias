import type { Group } from '../../core';
import { useI18n } from '../../i18n';
import { Avatar } from '../bits';
import { useApp } from '../context';
import { Icon } from '../icons';
import type { SheetProps } from '../Layers';
import { Sheet } from '../Sheet';
import { activeMembers } from '../util';

/** «¿Quién eres tú?»: para decir «te deben» o «debes». Se guarda solo en este dispositivo. */
export function WhoAmISheet({ active, onClose, group }: SheetProps & { group: Group }) {
  const { t } = useI18n();
  const { settings, setMe, toast } = useApp();
  const current = settings.me[group.id];
  return (
    <Sheet title={t('whoami.title')} active={active} onClose={onClose} size="sm" description={t('whoami.body', { name: group.name })}>
      <ul className="pick-list">
        {activeMembers(group).map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className={`pick${current === m.id ? ' pick--on' : ''}`}
              aria-pressed={current === m.id}
              onClick={() => {
                setMe(group.id, m.id);
                toast(t('toast.hello', { name: m.name }));
                onClose();
              }}
            >
              <Avatar member={m} />
              <span>{m.name}</span>
              {current === m.id && <Icon name="check" />}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
