import { useI18n } from '../i18n';
import { useApp } from './context';
import { Icon } from './icons';

/** Aviso discreto: sin conexión todo sigue funcionando. */
export function OfflinePill() {
  const { t } = useI18n();
  const { online } = useApp();
  if (online) return null;
  return (
    <span className="pill pill--offline" role="status">
      <Icon name="offline" size={16} />
      {t('offline')}
    </span>
  );
}
