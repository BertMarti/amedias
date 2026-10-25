import { useId, useState } from 'react';
import { encodeGroup, exportCsv, QR_MAX_CHARS, shareUrl, type Group } from '../../core';
import { useI18n } from '../../i18n';
import { FieldNote } from '../bits';
import { useApp } from '../context';
import { Icon } from '../icons';
import type { SheetProps } from '../Layers';
import { appUrl, canShare as systemShare, shareLink } from '../native';
import { Sheet } from '../Sheet';
import { copyText, downloadText, fileSlug, generatePassphrase } from '../util';

interface Link {
  url: string;
  payloadLength: number;
  qr: string | null;
  encrypted: boolean;
}

async function makeQr(text: string): Promise<string | null> {
  try {
    const QR = await import('qrcode');
    return await QR.toDataURL(text, { errorCorrectionLevel: 'L', margin: 2, width: 560, color: { dark: '#1D1A16', light: '#FFFFFF' } });
  } catch {
    return null;
  }
}

/** Compartir y sincronizar: enlace (con contraseña opcional), QR, archivo y CSV. Nada se sube a ningún sitio. */
export function ShareSheet({ active, onClose, group }: SheetProps & { group: Group }) {
  const { t, lang } = useI18n();
  const { toast } = useApp();
  const passId = useId();
  const [pass, setPass] = useState('');
  const [link, setLink] = useState<Link | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const canShare = systemShare();

  const generate = async () => {
    setBusy(true);
    setError(false);
    try {
      const payload = await encodeGroup(group, pass || undefined);
      const url = shareUrl(appUrl(), payload);
      const qr = payload.length <= QR_MAX_CHARS ? await makeQr(url) : null;
      setLink({ url, payloadLength: payload.length, qr, encrypted: !!pass });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const shareText = link?.encrypted ? t('share.messageLocked', { name: group.name }) : t('share.message', { name: group.name });

  return (
    <Sheet title={t('share.title')} active={active} onClose={onClose}>
      <div className="share-intro">
        <p>{t('share.explain')}</p>
      </div>

      <section className="form" aria-labelledby="share-link-title">
        <h3 id="share-link-title" className="section-title">
          {t('share.link')}
        </h3>
        <div className="field">
          <label htmlFor={passId} className="field-label">
            <Icon name="lock" size={16} /> {t('share.pass')}
          </label>
          <div className="input-with-btn">
            <input
              id={passId}
              className="input"
              value={pass}
              autoComplete="off"
              spellCheck={false}
              placeholder={t('share.passPh')}
              onChange={(e) => {
                setPass(e.target.value);
                setLink(null);
              }}
            />
            <button
              type="button"
              className="btn btn--soft btn--sm"
              onClick={() => {
                setPass(generatePassphrase());
                setLink(null);
              }}
            >
              <Icon name="sparkle" size={18} />
              {t('share.generate')}
            </button>
          </div>
          <FieldNote tone="muted">{pass ? t('share.passOn') : t('share.passOff')}</FieldNote>
        </div>

        {!link && (
          <button type="button" className="btn btn--primary btn--big" onClick={generate} disabled={busy} aria-busy={busy}>
            <Icon name="link" />
            {busy ? (pass ? t('share.encrypting') : t('share.creating')) : t('share.create')}
          </button>
        )}
        {error && <FieldNote>{t('share.error')}</FieldNote>}

        {link && (
          <div className="share-result">
            <label className="sr-only" htmlFor="share-url">
              {t('share.link')}
            </label>
            <input id="share-url" className="input input--mono" readOnly value={link.url} onFocus={(e) => e.target.select()} />
            <div className="btn-row">
              <button type="button" className="btn btn--primary" onClick={async () => toast((await copyText(link.url)) ? t('toast.linkCopied') : t('toast.copyFailed'), 'info')}>
                <Icon name="copy" />
                {t('share.copy')}
              </button>
              {canShare && (
                <button
                  type="button"
                  className="btn btn--soft"
                  onClick={() => void shareLink(`${group.name} (a medias)`, shareText, link.url)}
                >
                  <Icon name="share" />
                  {t('share.send')}
                </button>
              )}
            </div>
            {link.encrypted && <FieldNote tone="muted">{t('share.passSeparately')}</FieldNote>}
            {link.qr ? (
              <figure className="qr">
                <img src={link.qr} alt={t('share.qrAlt', { name: group.name })} width={280} height={280} />
                <figcaption>{t('share.qrHint')}</figcaption>
              </figure>
            ) : (
              <FieldNote tone="muted">{link.payloadLength > QR_MAX_CHARS ? t('share.tooBigForQr') : t('share.noQr')}</FieldNote>
            )}
          </div>
        )}
        <p className="warning">
          <Icon name="info" size={18} />
          {t('share.warning')}
        </p>
      </section>

      <section className="form" aria-labelledby="share-files-title">
        <h3 id="share-files-title" className="section-title">
          {t('share.files')}
        </h3>
        <p className="muted small">{t('share.filesHint')}</p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              downloadText(`amedias-${fileSlug(group.name)}.json`, JSON.stringify(group, null, 1), 'application/json');
              toast(t('toast.downloaded'), 'info');
            }}
          >
            <Icon name="download" />
            {t('share.downloadFile')}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              downloadText(`amedias-${fileSlug(group.name)}.csv`, exportCsv(group, lang), 'text/csv;charset=utf-8');
              toast(t('toast.downloaded'), 'info');
            }}
          >
            <Icon name="download" />
            {t('share.csv')}
          </button>
        </div>
      </section>
    </Sheet>
  );
}
