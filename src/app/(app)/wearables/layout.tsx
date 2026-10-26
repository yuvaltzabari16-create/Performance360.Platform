import { requireSection } from "@/lib/auth";

/** Athletes manage their wearables here; staff and the director see what athletes chose to share. */
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  await requireSection("wearables");
  return children;
}
