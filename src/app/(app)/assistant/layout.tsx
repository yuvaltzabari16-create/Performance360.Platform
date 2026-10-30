import { requireSection } from "@/lib/auth";

/** Every login has the assistant; the guard keeps the menu and the routes in step. */
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  await requireSection("assistant");
  return children;
}
