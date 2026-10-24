"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import type { NavIcon, NavItem } from "./nav";

const paths: Record<NavIcon, string> = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  team: "M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM21 20v-1a4 4 0 0 0-3-3.9M16 4.1a4 4 0 0 1 0 7.8",
  users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8",
  group: "M4 6h16M4 12h16M4 18h10",
  calendar: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
  library: "M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8 1 -3.9 15-3.8-1z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  pulse: "M2 12h4l3-8 4 16 3-8h6",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  pin: "M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  key: "M15 7a4 4 0 1 0-3.9 5L4 19v2h3v-2h2v-2h2l1.1-1.1A4 4 0 0 0 15 7z",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  bell: "M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16zM10 20a2 2 0 0 0 4 0",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14.1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10.3 5V5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V11a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
};

export function NavLinks({ items, unread }: { items: NavItem[]; unread: number }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-white/10 font-medium text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <svg viewBox="0 0 24 24" className={cx("size-4 shrink-0", active && "text-brand-300")} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={paths[item.icon]} />
              </svg>
              <span className="flex-1 truncate">{item.label}</span>
              {item.icon === "bell" && unread > 0 && (
                <span className="num rounded-full bg-brand-500 px-1.5 text-[11px] font-semibold text-white">{unread > 99 ? "99+" : unread}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
