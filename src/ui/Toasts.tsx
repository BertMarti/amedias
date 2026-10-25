import { Icon } from './icons';
import type { Toast } from './store';

/** Avisos breves. Las regiones existen siempre para que los lectores de pantalla anuncien los cambios. */
export function Toasts({ toasts }: { toasts: Toast[] }) {
  const polite = toasts.filter((x) => x.tone !== 'error');
  const errors = toasts.filter((x) => x.tone === 'error');
  return (
    <div className="toasts">
      <div role="status" aria-live="polite" className="toast-region">
        {polite.map((x) => (
          <p key={x.id} className={`toast toast--${x.tone}`}>
            <Icon name={x.tone === 'ok' ? 'check' : 'sparkle'} size={18} />
            <span>{x.text}</span>
          </p>
        ))}
      </div>
      <div role="alert" aria-live="assertive" className="toast-region">
        {errors.map((x) => (
          <p key={x.id} className="toast toast--error">
            <Icon name="info" size={18} />
            <span>{x.text}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
