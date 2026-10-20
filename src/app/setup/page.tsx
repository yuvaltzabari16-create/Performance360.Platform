import { Card, Logo } from "@/components/ui";
import { getCookieLocale, getDictionary } from "@/lib/i18n";

export default async function SetupPage() {
  const t = getDictionary(await getCookieLocale());
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Logo className="mb-8 text-xl text-ink" />
      <Card title={t.setup.title}>
        <p className="text-sm leading-6 text-ink-soft">{t.setup.body}</p>
      </Card>
    </main>
  );
}
