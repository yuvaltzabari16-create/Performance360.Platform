import { requireSection } from "@/lib/auth";

/** Payments are the academy director's; the guard keeps the menu and the routes in step. */
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  await requireSection("payments");
  return children;
}
