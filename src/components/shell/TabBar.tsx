"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui";
import { NavLinks, navIconPaths } from "./NavLinks";
import type { NavItem } from "./nav";

/**
 * iOS-style bottom tab bar for phones: the four main sections plus "More", which opens a sheet with every section.
 * Translucent material, large touch targets, safe-area aware.
 */
export function TabBar({ items, unread, moreLabel, closeLabel, children }: { items: NavItem[]; unread: number; moreLabel: string; closeLabel: string; children?: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const main = items.slice(0, 4);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const moreActive = open || !main.some((i) => isActive(i.href));

  return (
    <div className="no-print lg:hidden">
      {open && (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={moreLabel}>
          <button type="button" aria-label={closeLabel} className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="glass absolute inset-x-2 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] max-h-[70dvh] overflow-y-auto rounded-[28px] p-3 shadow-[var(--shadow-lift)] ring-1 ring-line/60">
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-muted/40" aria-hidden />
            <NavLinks items={items} unread={unread} />
            {children}
          </div>
        </div>
      )}
      <nav aria-label="Tabs" className="glass fixed inset-x-0 bottom-0 z-50 border-t border-line/60 pb-[env(safe-area-inset-bottom)]">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {main.map((item) => {
            const active = !open && isActive(item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={active ? "page" : undefined} className={cx("press flex flex-col items-center gap-0.5 px-1 pb-1.5 pt-2 text-[10.5px] font-medium", active ? "text-brand-600" : "text-muted")}>
                  <svg viewBox="0 0 24 24" className="size-6" fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.16 : 0} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={navIconPaths[item.icon]} /></svg>
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={cx("press relative flex w-full flex-col items-center gap-0.5 px-1 pb-1.5 pt-2 text-[10.5px] font-medium", moreActive && open ? "text-brand-600" : "text-muted")}>
              <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
              <span>{moreLabel}</span>
              {unread > 0 && <span className="num absolute end-3 top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{unread > 99 ? "99+" : unread}</span>}
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
