/** Confeti de formas CSS (medios círculos, círculos y rombos). Con movimiento reducido no se muestra. */
import type { CSSProperties } from 'react';

const SHAPES = ['half', 'dot', 'diamond'] as const;
const COLORS = ['tomato', 'mint', 'saffron', 'ink'] as const;

// Posiciones fijas (deterministas): el mismo confeti cada vez, sin Math.random en el render.
const PIECES = Array.from({ length: 26 }, (_, i) => {
  const x = (i * 37) % 100;
  return {
    shape: SHAPES[i % SHAPES.length]!,
    color: COLORS[(i * 7) % COLORS.length]!,
    style: {
      '--x': `${x}%`,
      '--drift': `${((i * 53) % 60) - 30}px`,
      '--delay': `${(i % 9) * 45}ms`,
      '--spin': `${((i * 97) % 540) - 270}deg`,
      '--fall': `${150 + ((i * 29) % 90)}px`,
    } as CSSProperties,
  };
});

export function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {PIECES.map((p, i) => (
        <span key={i} className={`confetti-piece confetti--${p.shape} confetti--${p.color}`} style={p.style} />
      ))}
    </div>
  );
}
