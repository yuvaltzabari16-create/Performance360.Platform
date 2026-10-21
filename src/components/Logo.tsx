/** Performance360 mark: open ring, rising bars and a return arrow (vector redraw of the brand logo). */
export function LogoMark({ size = 32, title }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d="M19.2 61.6 A33.2 33.2 0 1 1 82.1 58.8" fill="none" stroke="var(--brand-dark)" strokeWidth="5.7" strokeLinecap="round" />
      <rect x="36.8" y="51.6" width="7.5" height="10" rx="1.5" fill="var(--brand-dark)" />
      <rect x="46.4" y="44.6" width="7.5" height="17" rx="1.5" fill="var(--brand-dark)" />
      <rect x="56" y="37.5" width="7.5" height="24.1" rx="1.5" fill="var(--brand-light)" />
      <path d="M77.8 68.1 A33.5 33.5 0 0 1 31 77.6" fill="none" stroke="var(--brand-light)" strokeWidth="4.9" />
      <polygon points="24,72.1 34.7,71.1 26.5,82.6" fill="var(--brand-light)" />
    </svg>
  );
}

/** Mark + wordmark, "Performance" in the dark brand green and "360" in the light one. */
export function Logo({ size = 30, compact = false }: { size?: number; compact?: boolean }) {
  return (
    <span className="logo" aria-label="Performance360">
      <LogoMark size={size} />
      {compact
        ? <span className="logo-word" aria-hidden="true"><b>P</b><i>360</i></span>
        : <span className="logo-word" aria-hidden="true"><b>Performance</b><i>360</i></span>}
    </span>
  );
}
