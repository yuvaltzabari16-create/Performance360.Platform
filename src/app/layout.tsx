import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { dirFor } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCookieLocale } from "@/lib/i18n";

export const metadata: Metadata = {
  title: { default: "Performance360", template: "%s · Performance360" },
  description: "Athletic performance management for coaches, practitioners and athletes.",
};

export const viewport: Viewport = { themeColor: "#157a4a", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = isSupabaseConfigured ? (await getSession()).locale : await getCookieLocale();
  return (
    <html lang={locale} dir={dirFor(locale)}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
