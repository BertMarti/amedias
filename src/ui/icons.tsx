/** Iconos propios (SVG en JSX, trazo redondeado). Decorativos: el texto de al lado da el significado. */
import type { ReactNode } from 'react';
import type { Category } from '../core';

const P: Record<string, ReactNode> = {
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="M15 5l-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  share: <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />,
  sliders: (
    <>
      <path d="M4 7h9M19 7h1M4 17h3M13 17h7" />
      <circle cx="16" cy="7" r="2.5" />
      <circle cx="10" cy="17" r="2.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.8-3.2 3-4.8 5.5-4.8s4.7 1.6 5.5 4.8" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M16.2 14.7c2.2.1 3.7 1.6 4.3 4.3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c1-3.8 3.8-5.8 7.5-5.8s6.5 2 7.5 5.8" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.5" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  trash: <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 12.5A1.6 1.6 0 0 0 9.1 21h5.8a1.6 1.6 0 0 0 1.6-1.5l1-12.5M10 11v6M14 11v6" />,
  receipt: <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3" />,
  scale: <path d="M12 4v16M7.5 20h9M5 7.5h14M5 7.5 2.5 13a2.6 2.6 0 0 0 5 0zM19 7.5 16.5 13a2.6 2.6 0 0 0 5 0z" />,
  chart: <path d="M4 20h16M7 16.5V12M12 16.5V6M17 16.5V9" />,
  repeat: <path d="m17 3 3 3-3 3M4 11.5V10a4 4 0 0 1 4-4h12M7 21l-3-3 3-3M20 12.5V14a4 4 0 0 1-4 4H4" />,
  arrow: <path d="M4.5 12h15M13.5 6l6 6-6 6" />,
  download: <path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" />,
  upload: <path d="M12 20V9M7 13.5l5-5 5 5M5 4h14" />,
  link: <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />,
  offline: <path d="M3 3l18 18M8.6 8.7A5 5 0 0 0 7 18.5h10M11.4 6.1A5.2 5.2 0 0 1 17.2 10a4.2 4.2 0 0 1 3.1 6.7" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  pencil: <path d="M4 20l4.2-1L19 8.2 15.8 5 5 15.8zM13.8 7l3.2 3.2" />,
  swap: <path d="M7 7h13M16 3l4 4-4 4M17 17H4M8 13l-4 4 4 4" />,
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2.5" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M12 7v7M9.5 11.5 12 14l2.5-2.5" />
    </>
  ),
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  qr: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18v2M18 18h2v2" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 1.9 1.8.6-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.6z" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  equal: <path d="M5 9h14M5 15h14" />,
  minus: <path d="M5 12h14" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.6v.1" />
    </>
  ),
  // Categorías
  compra: <path d="M4 9.5h16l-1.6 9.6a2 2 0 0 1-2 1.7H7.6a2 2 0 0 1-2-1.7zM8.5 9.5l3-5.5M15.5 9.5l-3-5.5M9.5 13.5v3.5M14.5 13.5v3.5" />,
  casa: <path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5h4v5" />,
  facturas: <path d="M13.5 2.5 5 13.5h6.2L10 21.5l8.5-11h-6.2z" />,
  restaurante: <path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17.5 21V3c-2.2 1.4-3.5 4-3.5 7.5V14h3.5" />,
  ocio: <path d="M3 9V7a1.5 1.5 0 0 1 1.5-1.5h15A1.5 1.5 0 0 1 21 7v2a3 3 0 0 0 0 6v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17v-2a3 3 0 0 0 0-6zM14.5 6v1.5M14.5 11v2M14.5 16.5V18" />,
  transporte: (
    <>
      <rect x="5" y="3" width="14" height="15" rx="3" />
      <path d="M5 11h14M8 18v2.5M16 18v2.5M8.5 14.5h1M14.5 14.5h1" />
    </>
  ),
  viaje: (
    <>
      <rect x="4" y="7" width="16" height="13" rx="2.5" />
      <path d="M9 7V5a1.2 1.2 0 0 1 1.2-1.2h3.6A1.2 1.2 0 0 1 15 5v2M9 7v13M15 7v13" />
    </>
  ),
  salud: <path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20zM8 12h2l1-2 2 4 1-2h2" />,
  regalos: (
    <>
      <rect x="3.5" y="8.5" width="17" height="4.5" rx="1" />
      <path d="M5.5 13v7.5h13V13M12 8.5v12M12 8.5S10.5 4 8 4.5 7 8.5 12 8.5zM12 8.5S13.5 4 16 4.5s1 4-4 4z" />
    </>
  ),
  otros: (
    <>
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18" cy="12" r="1.3" />
    </>
  ),
};

export type IconName = keyof typeof P & string;

export function Icon({ name, size = 22, className }: { name: IconName | Category; size?: number; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {P[name]}
    </svg>
  );
}
