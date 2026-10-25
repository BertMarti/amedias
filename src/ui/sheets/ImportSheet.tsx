import { useId, useState, type ChangeEvent } from 'react';
import { importSplitwise, readBackup } from '../../core';
import { useI18n } from '../../i18n';
import { FieldNote } from '../bits';
import { useApp } from '../context';
import { Icon } from '../icons';
import type { SheetProps } from '../Layers';
import { Sheet } from '../Sheet';
import { extractPayload, MAX_FILE_BYTES } from '../util';

/** «Abrir enlace o archivo»: un enlace pegado, una copia `.json` o una exportación `.csv` de Splitwise. */
export function ImportSheet({ active, onClose, restore }: SheetProps & { restore: boolean }) {
  const { t, tp } = useI18n();
  const { layers, setLayers } = useApp();
  const linkId = useId();
  const fileId = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const openIncoming = (source: Parameters<typeof setLayers>[0][number]) => setLayers([...layers.slice(0, -1), source]);

  const openLink = () => {
    const payload = extractPayload(text);
    if (!payload) {
      setError(t('import.badLink'));
      return;
    }
    openIncoming({ t: 'incoming', source: { kind: 'link', payload } });
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError(t('import.tooBig'));
      return;
    }
    setBusy(true);
    try {
      const content = await file.text();
      const looksCsv = /\.csv$/i.test(file.name) || !/^\s*[[{]/.test(content);
      if (looksCsv && !restore) {
        const { group, skipped } = importSplitwise(content);
        openIncoming({ t: 'incoming', source: { kind: 'groups', groups: [group], note: skipped > 0 ? tp('import.skipped', skipped) : undefined } });
      } else {
        const groups = readBackup(content);
        if (groups.length === 0) throw new Error('vacío');
        openIncoming({ t: 'incoming', source: { kind: 'groups', groups, restore } });
      }
    } catch {
      setError(restore ? t('import.badBackup') : t('import.badFile'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={restore ? t('import.restoreTitle') : t('import.title')} active={active} onClose={onClose} description={restore ? t('import.restoreBody') : t('import.body')}>
      {!restore && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            openLink();
          }}
        >
          <div className="field">
            <label htmlFor={linkId} className="field-label">
              {t('import.linkLabel')}
            </label>
            <textarea
              id={linkId}
              className="input input--mono"
              rows={3}
              value={text}
              spellCheck={false}
              autoComplete="off"
              placeholder="https://bertmarti.github.io/amedias/#g=…"
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              data-autofocus
            />
          </div>
          <button type="submit" className="btn btn--primary" disabled={!text.trim()}>
            <Icon name="link" />
            {t('import.openLink')}
          </button>
        </form>
      )}

      <div className="form">
        {!restore && <p className="or">{t('import.or')}</p>}
        <input id={fileId} className="file-input" type="file" accept={restore ? '.json,application/json' : '.json,.csv,application/json,text/csv'} onChange={onFile} disabled={busy} />
        <label htmlFor={fileId} className="btn btn--soft btn--big file-btn">
          <Icon name="upload" />
          {busy ? t('import.reading') : restore ? t('import.pickBackup') : t('import.pickFile')}
        </label>
        {!restore && <p className="muted small">{t('import.fileHint')}</p>}
      </div>
      {error && (
        <FieldNote>
          <span role="alert">{error}</span>
        </FieldNote>
      )}
    </Sheet>
  );
}
