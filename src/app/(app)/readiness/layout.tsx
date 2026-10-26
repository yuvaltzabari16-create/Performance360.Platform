import { requireSection } from "@/lib/auth";

/** Only logins with access to this section get past here. */
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  await requireSection("readiness");
  return children;
}
