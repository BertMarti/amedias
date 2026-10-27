/**
 * Foto del ticket de un gasto. Se prepara en el propio móvil (reducida y comprimida) y se guarda SOLO en este
 * dispositivo al guardar el gasto; nunca forma parte del grupo (ver `photos.ts`).
 */
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { FieldNote } from '../bits';
import { useApp } from '../context';
import { Icon } from '../icons';
import { compressPhoto } from '../image';
import { deletePhotos, photos, savePhoto } from '../photos';

export interface PhotoDraft {
  data: string | null;
  busy: boolean;
  error: boolean;
  pick: (file: File | undefined) => void;
  clear: () => void;
  /** Al guardar el gasto: guarda o borra la foto si cambió. */
  persist: (expenseId: string, groupId: string, onError: () => void) => void;
}

export function usePhotoDraft(expenseId: string | undefined): PhotoDraft {
  const [data, setData] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    const store = photos();
    if (!expenseId || !store) return;
    let alive = true;
    store.get(expenseId).then(
      (d) => {
        // Si mientras tanto ya se eligió o quitó otra, manda lo elegido.
        if (alive && !dirty.current) setData(d);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [expenseId]);

  return {
    data,
    busy,
    error,
    pick: (file) => {
      if (!file) return;
      setBusy(true);
      setError(false);
      compressPhoto(file).then(
        (d) => {
          dirty.current = true;
          setData(d);
          setBusy(false);
        },
        () => {
          setError(true);
          setBusy(false);
        },
      );
    },
    clear: () => {
      dirty.current = true;
      setData(null);
    },
    persist: (id, groupId, onError) => {
      if (!dirty.current) return;
      (data ? savePhoto({ id, groupId, data }) : deletePhotos([id])).catch(onError);
    },
  };
}

function Picker({ label, onPick, big = false, busy }: { label: string; onPick: (f: File | undefined) => void; big?: boolean; busy: boolean }) {
  return (
    <label className={`btn btn--soft ${big ? 'btn--block' : 'btn--sm'} photo-pick${busy ? ' photo-pick--busy' : ''}`}>
      {/* Sin `capture`: en la app de Android pediría el permiso de cámara. El selector del sistema ya ofrece la cámara. */}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={(e) => {
          onPick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <Icon name="camera" size={20} />
      {label}
    </label>
  );
}

export function PhotoField({ draft, title }: { draft: PhotoDraft; title: string }) {
  const { t } = useI18n();
  const { push } = useApp();
  const working = draft.busy ? t('photo.working') : null;
  return (
    <div className="field photo-field">
      <span className="field-label">{t('photo.title')}</span>
      {draft.data ? (
        <div className="photo-row">
          <button type="button" className="photo-thumb" onClick={() => push({ t: 'photo', src: draft.data!, title })} aria-label={t('photo.view')}>
            <img src={draft.data} alt="" />
          </button>
          <div className="photo-actions">
            <Picker label={working ?? t('photo.change')} onPick={draft.pick} busy={draft.busy} />
            <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={draft.clear}>
              <Icon name="trash" size={18} />
              {t('photo.remove')}
            </button>
          </div>
        </div>
      ) : (
        <Picker label={working ?? t('photo.add')} onPick={draft.pick} big busy={draft.busy} />
      )}
      {draft.error && <FieldNote>{t('photo.error')}</FieldNote>}
      <FieldNote tone="muted">
        <Icon name="lock" size={14} /> {t('photo.local')}
      </FieldNote>
    </div>
  );
}

/** La foto a pantalla completa. */
export function PhotoView({ src, title }: { src: string; title: string }) {
  const { t } = useI18n();
  return <img className="photo-full" src={src} alt={t('photo.alt', { title })} />;
}
