/** Holdtil mark (logo A): two "hold" bars with the stock line running through them. */
export function Mark({ size = 28, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="14" fill="#0B0B0B" />
      <rect x="17" y="16" width="9" height="32" rx="3" fill="#fff" />
      <rect x="38" y="16" width="9" height="32" rx="3" fill="#fff" />
      <path d="M12 42 L24 34 L36 38 L52 22" fill="none" stroke="#0052FF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The wait glyph: the two hold bars on their own. Used wherever Holdtil chose to wait. */
export function HoldGlyph({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <rect x="2" y="1" width="3" height="10" rx="1" fill="currentColor" />
      <rect x="7" y="1" width="3" height="10" rx="1" fill="currentColor" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="logo">
      <Mark size={28} />
      <span className="logo-word">Holdtil</span>
    </span>
  );
}
