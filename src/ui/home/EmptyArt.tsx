/** Ilustración del estado vacío: una galleta partida a medias (el logo hecho galleta), con sus migas. */
export function EmptyArt() {
  return (
    <svg className="empty-art" viewBox="0 0 320 220" aria-hidden="true" focusable="false">
      <ellipse className="art-shadow" cx="160" cy="200" rx="104" ry="9" />
      <g className="art-half art-half--a" transform="translate(-9 -5) rotate(-6 160 110)">
        <path d="M213.74 56.26A76 76 0 0 0 106.26 163.74Z" className="art-fill-a" />
        <circle cx="132" cy="88" r="6" className="art-chip" />
        <circle cx="156" cy="70" r="4" className="art-chip" />
        <circle cx="116" cy="124" r="4.5" className="art-chip" />
        <circle cx="146" cy="106" r="3" className="art-chip" />
      </g>
      <g className="art-half art-half--b" transform="translate(9 5) rotate(5 160 110)">
        <path d="M213.74 56.26A76 76 0 0 1 106.26 163.74Z" className="art-fill-b" />
        <circle cx="192" cy="128" r="6.5" className="art-chip" />
        <circle cx="170" cy="156" r="4" className="art-chip" />
        <circle cx="210" cy="100" r="4.5" className="art-chip" />
        <circle cx="178" cy="122" r="3" className="art-chip" />
      </g>
      <circle cx="160" cy="190" r="3" className="art-crumb" />
      <circle cx="146" cy="194" r="2" className="art-crumb" />
      <circle cx="175" cy="195" r="2.2" className="art-crumb" />
      <path d="M58 52l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" className="art-spark" />
      <path d="M262 36l2 5.5 5.5 2-5.5 2-2 5.5-2-5.5-5.5-2 5.5-2z" className="art-spark art-spark--b" />
      <circle cx="270" cy="150" r="4" className="art-dot" />
      <circle cx="46" cy="150" r="3" className="art-dot art-dot--b" />
    </svg>
  );
}
