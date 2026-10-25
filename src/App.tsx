import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { I18nProvider, makeI18n } from './i18n';
import { AppContext, type AppApi } from './ui/context';
import { GroupScreen } from './ui/group/GroupScreen';
import { Home } from './ui/home/Home';
import { LayerView } from './ui/Layers';
import { useOnline } from './ui/platform';
import { AppStore } from './ui/store';
import { Toasts } from './ui/Toasts';

const THEME_COLORS = { light: '#FBF7F0', dark: '#15120F' } as const;

export default function App() {
  const [store] = useState(() => new AppStore());
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const online = useOnline();

  // Antes de pintar: lee (y borra) un posible enlace #g=…, genera los gastos fijos y abre el último grupo.
  useLayoutEffect(() => store.boot(), [store]);

  useEffect(() => {
    window.addEventListener('hashchange', store.onHashChange);
    window.addEventListener('popstate', store.onPopState);
    window.addEventListener('storage', store.onStorage);
    return () => {
      window.removeEventListener('hashchange', store.onHashChange);
      window.removeEventListener('popstate', store.onPopState);
      window.removeEventListener('storage', store.onStorage);
    };
  }, [store]);

  const { theme, lang } = state.settings;
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = theme;
    root.lang = lang;
    const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light);
    document.title = makeI18n(lang).t('app.title');
  }, [theme, lang]);

  const api = useMemo<AppApi>(() => ({ ...state, online, ...store.actions }), [state, online, store]);

  let groupIndex = -1;
  state.layers.forEach((l, i) => {
    if (l.t === 'group') groupIndex = i;
  });
  const groupLayer = groupIndex >= 0 ? state.layers[groupIndex] : undefined;
  const group = groupLayer?.t === 'group' ? state.groups.find((g) => g.id === groupLayer.id) : undefined;
  const sheets = state.layers.map((l, i) => ({ l, i })).filter(({ l }) => l.t !== 'group');
  const top = sheets[sheets.length - 1];

  return (
    <I18nProvider lang={lang}>
      <AppContext.Provider value={api}>
        <div className="app" inert={sheets.length > 0}>
          {group && groupLayer?.t === 'group' ? <GroupScreen group={group} tab={groupLayer.tab} /> : <Home />}
        </div>
        {sheets.map(({ l, i }) => (
          <LayerView key={`${i}-${l.t}`} layer={l} active={top?.i === i} />
        ))}
        {state.storageError && (
          <div className="banner" role="alert">
            {makeI18n(lang).t('error.storageFull')}
          </div>
        )}
        <Toasts toasts={state.toasts} />
      </AppContext.Provider>
    </I18nProvider>
  );
}
