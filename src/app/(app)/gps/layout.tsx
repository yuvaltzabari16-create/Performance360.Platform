import { requireSection } from "@/lib/auth";

/** Only logins with access to GPS data get past here. */
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  await requireSection("gps");
  return children;
}
