import { useI18n } from '../../i18n';
import type { ConfirmSpec } from '../context';
import type { SheetProps } from '../Layers';
import { Sheet } from '../Sheet';

/** Confirmación dentro de la app (nunca `window.confirm`). */
export function ConfirmSheet({ active, onClose, spec }: SheetProps & { spec: ConfirmSpec }) {
  const { t } = useI18n();
  return (
    <Sheet
      title={spec.title}
      active={active}
      onClose={onClose}
      size="sm"
      description={spec.body}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} data-autofocus>
            {t('cancel')}
          </button>
          <button
            type="button"
            className={`btn ${spec.danger ? 'btn--danger' : 'btn--primary'}`}
            onClick={() => {
              onClose();
              spec.onConfirm();
            }}
          >
            {spec.confirmLabel}
          </button>
        </>
      }
    >
      {null}
    </Sheet>
  );
}
