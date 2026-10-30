/** The Performance360 logo as inline SVG: dark parts follow the theme, the light green parts are fixed. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="235 255 715 715" width={size} height={size} aria-hidden="true" style={{ flex: "none" }}>
      <path d="M309 715A303 303 0 1 1 886 690" fill="none" stroke="var(--brand-700)" strokeWidth="53" strokeLinecap="round" />
      <path d="M848 775A303 303 0 0 1 415 855" fill="none" stroke="#40ae4f" strokeWidth="53" />
      <path d="M355 811L454 803L378 908Z" fill="#40ae4f" />
      <rect x="472" y="625" width="69" height="91" rx="16" fill="var(--brand-700)" />
      <rect x="559" y="561" width="69" height="155" rx="16" fill="var(--brand-700)" />
      <rect x="647" y="496" width="69" height="220" rx="16" fill="#40ae4f" />
    </svg>
  );
}
