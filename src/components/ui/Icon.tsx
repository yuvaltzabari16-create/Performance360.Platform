import type { SVGProps } from "react";

/** Small outline icons used instead of text symbols or emoji, so every icon looks the same and follows the text colour. */
const PATHS = {
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  play: "M8 5.5v13l11-6.5z",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  check: "M5 12.5l5 5 9-10.5",
  warning: "M12 4l9 16H3zM12 10v4M12 17.3v.1",
  up: "M12 19V5M6 11l6-6 6 6",
  down: "M12 5v14M6 13l6 6 6-6",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  send: "M4 12l16-8-6 16-2.5-6.5z",
  restart: "M4 12a8 8 0 1 0 3-6.2M4 4v5h5",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  list: "M4 6h16M4 12h16M4 18h16",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, filled = false, className = "size-4", ...rest }: { name: IconName; filled?: boolean; className?: string } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg viewBox="0 0 24 24" className={`inline-block shrink-0 align-[-0.15em] ${className}`} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}
