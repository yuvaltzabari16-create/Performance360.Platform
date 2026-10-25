import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-gradient-to-b from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700 shadow-[0_8px_18px_-8px_rgba(21,122,74,0.7)]",
  secondary: "bg-white/90 text-ink border border-line hover:bg-white hover:border-brand-200 shadow-[0_1px_2px_rgba(16,40,28,0.04)]",
  ghost: "text-ink-soft hover:bg-brand-50 hover:text-ink",
  danger: "bg-white/90 text-red-700 border border-red-200 hover:bg-red-50",
};
const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:pointer-events-none";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cx(base, variants[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(base, variants[variant], className)} {...props} />;
}

const field =
  "block w-full rounded-xl border border-line bg-white/90 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-canvas";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(field, className)} {...props} />;
}
export function Textarea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cx(field, className)} {...props} />;
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(field, "pe-8", className)} {...props} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block space-y-1.5", className)}>
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Checkbox({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-ink">
      <input type="checkbox" className="size-4 rounded border-line accent-brand-600" {...props} />
      {label}
    </label>
  );
}

export function Card({ className, children, title, action }: { className?: string; children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx("rounded-2xl border border-white/80 bg-white/85 shadow-[var(--shadow-card)] backdrop-blur-sm", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-line/60 px-6 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink"><bdi>{title}</bdi></h2>
          {action}
        </header>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/85 p-5 shadow-[var(--shadow-card)] backdrop-blur-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="num mt-2 text-3xl font-bold tracking-tight text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

const badgeTones = {
  green: "bg-brand-100/70 text-brand-800 ring-brand-200/70",
  gray: "bg-slate-100/80 text-ink-soft ring-slate-200/70",
  amber: "bg-amber-100/70 text-amber-900 ring-amber-200/70",
  red: "bg-red-100/70 text-red-800 ring-red-200/70",
  blue: "bg-sky-100/70 text-sky-900 ring-sky-200/70",
};
export function Badge({ tone = "gray", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", badgeTones[tone])}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions, crumbs }: { title: string; subtitle?: string; actions?: ReactNode; crumbs?: { href: string; label: string }[] }) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted">
            {crumbs.map((c) => (
              <span key={c.href} className="flex items-center gap-1">
                <Link href={c.href} className="hover:text-brand-700">{c.label}</Link>
                <span aria-hidden>/</span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-3xl font-bold tracking-tight text-ink"><bdi>{title}</bdi></h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-brand-200 bg-white/70 px-6 py-14 text-center backdrop-blur-sm">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-gradient-to-b from-brand-100 to-brand-50 text-brand-600 shadow-inner" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function FlashMessage({ error, ok, okText }: { error?: string; ok?: string; okText?: string }) {
  if (error) {
    return <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800 shadow-[var(--shadow-card)]">{error}</div>;
  }
  if (ok) {
    return <div role="status" className="mb-4 rounded-xl border border-brand-200 bg-brand-50/90 px-4 py-3 text-sm text-brand-800 shadow-[var(--shadow-card)]">{okText ?? ok}</div>;
  }
  return null;
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/80 bg-white/85 shadow-[var(--shadow-card)] backdrop-blur-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-brand-50/60 text-start text-xs font-medium uppercase tracking-wide text-muted">
          <tr>{head.map((h, i) => <th key={i} className="px-4 py-2.5 text-start font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line/60">{children}</tbody>
      </table>
    </div>
  );
}
export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cx("px-4 py-3.5 align-middle text-ink", className)}>{children}</td>;
}

export function DefinitionList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="mt-0.5 text-sm whitespace-pre-line text-ink"><bdi>{v ?? "—"}</bdi></dd>
        </div>
      ))}
    </dl>
  );
}

/** Round avatar with the person's initials, in a calm tint chosen from the name so the same person always looks the same. */
const AVATAR_TINTS = ["bg-brand-100 text-brand-800", "bg-sky-100 text-sky-800", "bg-amber-100 text-amber-900", "bg-violet-100 text-violet-800", "bg-rose-100 text-rose-800", "bg-teal-100 text-teal-800"];
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "")).toUpperCase();
}
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const tint = AVATAR_TINTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TINTS.length];
  const dim = size === "sm" ? "size-7 text-[11px]" : size === "lg" ? "size-12 text-base" : "size-9 text-xs";
  return <span aria-hidden className={cx("inline-grid shrink-0 place-items-center rounded-full font-semibold ring-2 ring-white", dim, tint, className)}>{initialsOf(name)}</span>;
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M16 3a13 13 0 0 1 12.6 9.8" fill="none" stroke="#23985e" strokeWidth="3" strokeLinecap="round" />
        <path d="M10 19l4-5 3 3 5-6" fill="none" stroke="#23985e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Performance<span className="text-brand-500">360</span></span>
    </span>
  );
}
