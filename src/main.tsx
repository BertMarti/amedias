import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/manrope';
import './styles/tokens.css';
import './styles/base.css';
import './styles/controls.css';
import './styles/chips.css';
import './styles/screens.css';
import './styles/group.css';
import './styles/tabs.css';
import './styles/summary.css';
import './styles/sheets.css';
import './styles/sheet-parts.css';
import App from './App';
import { listenForInstall, registerServiceWorker } from './ui/platform';

listenForInstall();
if (import.meta.env.PROD) registerServiceWorker(import.meta.env.BASE_URL);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
