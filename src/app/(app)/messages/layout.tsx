import { requireSection } from "@/lib/auth";

/** Everyone with an account has messages; the guard keeps the menu and the routes in step. */
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  await requireSection("messages");
  return children;
}
