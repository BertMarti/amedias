/**
 * Hoja modal (de abajo arriba en el móvil, diálogo centrado en escritorio). Gestiona el foco: lo mueve
 * dentro al abrir, lo atrapa con Tab, cierra con Escape y lo devuelve a donde estaba al cerrar.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { Icon } from './icons';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Solo la hoja de arriba es interactiva. */
  active: boolean;
  size?: 'md' | 'sm';
  description?: string;
}

export function Sheet({ title, onClose, children, footer, active, size = 'md', description }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>('h2');
    first?.focus({ preventScroll: true });
    return () => {
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const node = ref.current;
      if (!node) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);

  return (
    <div className={`layer${active ? '' : ' layer--under'}`} inert={!active}>
      <div className="backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        className={`sheet sheet--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <header className="sheet-head">
          <h2 id={titleId} tabIndex={-1}>
            {title}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('close')}>
            <Icon name="close" />
          </button>
        </header>
        <div className="sheet-body">
          {description && (
            <p id={descId} className="sheet-desc">
              {description}
            </p>
          )}
          {children}
        </div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>
  );
}
