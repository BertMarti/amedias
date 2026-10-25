import { useState } from 'react';
import { backupJson, today, type Settings } from '../../core';
import { useI18n, type Key } from '../../i18n';
import { useApp } from '../context';
import { Icon } from '../icons';
import type { SheetProps } from '../Layers';
import { SplitDisc } from '../Logo';
import { useInstallPrompt } from '../platform';
import { Sheet } from '../Sheet';
import { DAMAGED_PREFIX, damagedKeys } from '../store';
import { downloadText } from '../util';

function Radios<T extends string>({ legend, name, value, options, onChange }: { legend: string; name: string; value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="field">
      <legend className="field-label">{legend}</legend>
      <div className="segmented segmented--wide">
        {options.map((o) => (
          <label key={o.v} className={`seg-radio${value === o.v ? ' seg-radio--on' : ''}`}>
            <input type="radio" name={name} checked={value === o.v} onChange={() => onChange(o.v)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const THEMES: { v: Settings['theme']; label: Key }[] = [
  { v: 'auto', label: 'settings.themeAuto' },
  { v: 'light', label: 'settings.themeLight' },
  { v: 'dark', label: 'settings.themeDark' },
];

export function SettingsSheet({ active, onClose }: SheetProps) {
  const { t, tp } = useI18n();
  const { settings, setSettings, groups, push, confirm, removeAll, toast } = useApp();
  const { available, install } = useInstallPrompt();
  const [damaged, setDamaged] = useState(damagedKeys);

  const downloadDamaged = () => {
    // Tal cual se guardaron (texto en bruto): sirve para recuperar datos a mano o para pedir ayuda.
    const items = damaged.map((k) => ({ fecha: new Date(Number(k.slice(DAMAGED_PREFIX.length))).toISOString(), datos: localStorage.getItem(k) }));
    downloadText(`amedias-apartados-${today()}.json`, JSON.stringify({ app: 'amedias', apartados: items }, null, 1), 'application/json');
    toast(t('toast.downloaded'), 'info');
  };

  const removeDamaged = () =>
    confirm({
      title: t('settings.damagedRemoveTitle'),
      body: t('settings.damagedRemoveBody'),
      confirmLabel: t('settings.damagedRemove'),
      danger: true,
      onConfirm: () => {
        for (const k of damaged) localStorage.removeItem(k);
        setDamaged(damagedKeys());
      },
    });

  const askWipe = () =>
    confirm({
      title: t('settings.wipeTitle'),
      body: t('settings.wipeBody'),
      confirmLabel: t('settings.wipeNext'),
      danger: true,
      onConfirm: () =>
        confirm({
          title: t('settings.wipeSure'),
          body: t('settings.wipeSureBody'),
          confirmLabel: t('settings.wipeConfirm'),
          danger: true,
          onConfirm: () => {
            removeAll();
            toast(t('toast.wiped'));
          },
        }),
    });

  return (
    <Sheet title={t('settings.title')} active={active} onClose={onClose}>
      <section className="form">
        <Radios
          legend={t('settings.lang')}
          name="lang"
          value={settings.lang}
          options={[
            { v: 'es', label: 'Español' },
            { v: 'en', label: 'English' },
          ]}
          onChange={(lang) => setSettings({ lang })}
        />
        <Radios legend={t('settings.theme')} name="theme" value={settings.theme} options={THEMES.map((x) => ({ v: x.v, label: t(x.label) }))} onChange={(theme) => setSettings({ theme })} />
      </section>

      <section className="form" aria-labelledby="set-data">
        <h3 id="set-data" className="section-title">
          {t('settings.data')}
        </h3>
        <p className="muted small">{t('settings.backupHint')}</p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn--soft"
            disabled={groups.length === 0}
            onClick={() => {
              downloadText(`amedias-copia-${today()}.json`, backupJson(groups), 'application/json');
              toast(t('toast.downloaded'), 'info');
            }}
          >
            <Icon name="download" />
            {t('settings.backup')}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => push({ t: 'import', restore: true })}>
            <Icon name="upload" />
            {t('settings.restore')}
          </button>
        </div>
        {damaged.length > 0 && (
          <div className="damaged-box">
            <p className="small">{tp('settings.damaged', damaged.length)}</p>
            <div className="btn-row">
              <button type="button" className="btn btn--soft btn--sm" onClick={downloadDamaged}>
                <Icon name="download" size={18} />
                {t('settings.damagedDownload')}
              </button>
              <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={removeDamaged}>
                <Icon name="trash" size={18} />
                {t('settings.damagedRemove')}
              </button>
            </div>
          </div>
        )}
        {available && (
          <button type="button" className="btn btn--ghost" onClick={() => void install()}>
            <Icon name="phone" />
            {t('settings.install')}
          </button>
        )}
        <button type="button" className="btn btn--ghost btn--danger-text" onClick={askWipe} disabled={groups.length === 0}>
          <Icon name="trash" />
          {t('settings.wipe')}
        </button>
      </section>

      <section className="about" aria-labelledby="set-about">
        <SplitDisc size={44} />
        <h3 id="set-about" className="section-title">
          {t('about.title')}
        </h3>
        <p>{t('about.privacy')}</p>
        <p className="muted small">{t('about.how')}</p>
        <a className="btn btn--ghost btn--sm" href="https://github.com/BertMarti/amedias" target="_blank" rel="noopener noreferrer">
          <Icon name="external" size={18} />
          {t('about.code')}
        </a>
      </section>
    </Sheet>
  );
}
