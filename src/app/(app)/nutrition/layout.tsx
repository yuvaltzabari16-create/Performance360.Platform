import { requireSection } from "@/lib/auth";

/** Athletes log meals; staff read their athletes' logs. The guard keeps the menu and the routes in step. */
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  await requireSection("nutrition");
  return children;
}
