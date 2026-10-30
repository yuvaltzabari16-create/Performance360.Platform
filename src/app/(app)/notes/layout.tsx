import { requireSection } from "@/lib/auth";

/** Part of the athlete login; the guard keeps the menu and the routes in step. */
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  await requireSection("notes");
  return children;
}
