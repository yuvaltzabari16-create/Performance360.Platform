import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { dirFor, getDictionary } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCookieLocale } from "@/lib/i18n";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme, themeAttr } from "@/lib/theme/theme";

export const metadata: Metadata = {
  title: { default: "Performance360", template: "%s · Performance360" },
  description: "Athletic performance management for coaches, practitioners and athletes.",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f3f6f4" }, { media: "(prefers-color-scheme: dark)", color: "#0b0f0d" }],
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = isSupabaseConfigured ? (await getSession()).locale : await getCookieLocale();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang={locale} dir={dirFor(locale)} data-theme={themeAttr(theme)}>
      <body className="min-h-dvh">
        {/* Keyboard users can jump past the navigation; visible only while focused. */}
        <a href="#main-content" className="sr-only z-50 rounded-xl bg-surface px-4 py-2 text-sm font-medium text-brand-800 shadow focus:not-sr-only focus:fixed focus:start-3 focus:top-3">
          {getDictionary(locale).legal.skipToContent}
        </a>
        {children}
      </body>
    </html>
  );
}
