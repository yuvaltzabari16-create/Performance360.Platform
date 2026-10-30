import { AssistantChat } from "@/components/assistant/AssistantChat";
import { PageHeader } from "@/components/ui";
import { requireProfile } from "@/lib/auth";
import { assistantRole } from "@/lib/assistant/roles";

export const metadata = { title: "AI Assistant" };

/**
 * The assistant full size. Same engine and permissions as the floating chat: the role and language come from the
 * account, and questions about numbers are answered only from rows this person may read.
 */
export default async function AssistantPage() {
  const { profile, org, t } = await requireProfile();
  const { starters, ...labels } = t.assistant;
  const role = assistantRole(profile.role, org?.org_role ?? null);
  return (
    <>
      <PageHeader title={t.assistantPage.title} subtitle={t.assistantPage.subtitle} />
      <section aria-label={t.assistantPage.title} data-testid="assistant-page" data-role={role} className="flex h-[min(46rem,calc(100dvh-14rem))] flex-col overflow-hidden rounded-3xl bg-surface/90 shadow-[var(--shadow-card)] ring-1 ring-line/60">
        <AssistantChat labels={labels} starters={starters[role]} autoFocus className="flex-1" />
      </section>
    </>
  );
}
