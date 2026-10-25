/** El motivo de la marca: un círculo partido en diagonal en dos mitades. */
import type { CSSProperties } from 'react';

interface DiscProps {
  size?: number;
  /** Separación entre mitades (en unidades del viewBox de 40). */
  gap?: number;
  className?: string;
  style?: CSSProperties;
}

export function SplitDisc({ size = 32, gap = 1.2, className, style }: DiscProps) {
  const o = gap / 2 / Math.SQRT2;
  return (
    <svg className={className ? `disc ${className}` : 'disc'} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false" style={style}>
      <path className="disc-a" d="M32.73 7.27A18 18 0 0 0 7.27 32.73Z" transform={`translate(${-o} ${-o})`} />
      <path className="disc-b" d="M32.73 7.27A18 18 0 0 1 7.27 32.73Z" transform={`translate(${o} ${o})`} />
    </svg>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      <SplitDisc size={size * 1.05} className="wordmark-disc" />
      <span className="wordmark-text">repartito</span>
    </span>
  );
}
