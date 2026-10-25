import { Icon } from "@/components/ui/Icon";
import Link from "next/link";
import { safeInternalPath } from "@/lib/security/url";
import { revalidatePath } from "next/cache";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { requireProfile } from "@/lib/auth";
import { safeNext, uuid } from "@/lib/forms";
import { redirect } from "next/navigation";

export const metadata = { title: "Notifications" };

async function markRead(formData: FormData) {
  "use server";
  const { supabase } = await requireProfile();
  const id = uuid(formData, "id");
  const q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  await (id ? q.eq("id", id) : q);
  revalidatePath("/", "layout");
  const link = formData.get("link");
  redirect(typeof link === "string" && link ? safeNext(link) : "/notifications");
}

export default async function NotificationsPage() {
  const { supabase, profile, t } = await requireProfile();
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <>
      <PageHeader
        title={t.notifications.title}
        actions={unread > 0 && (
          <form action={markRead}><SubmitButton variant="secondary">{t.notifications.markAll}</SubmitButton></form>
        )}
      />
      {items.length === 0 ? (
        <EmptyState title={t.notifications.empty} />
      ) : (
        <Card>
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {!n.read_at && <span className="size-2 rounded-full bg-brand-500" aria-hidden />}
                    <span className={n.read_at ? "text-ink-soft" : "font-medium text-ink"}>{t.notifications.kinds[n.kind] ?? n.title}</span>
                  </div>
                  {n.body && <div className="text-sm text-ink-soft">{n.body}</div>}
                  <div className="num mt-0.5 text-xs text-muted">{new Date(n.created_at).toLocaleString(profile.locale)}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {safeInternalPath(n.link) && (
                    n.read_at
                      ? <Link href={safeInternalPath(n.link)!} className="text-xs text-brand-700 hover:underline">{t.common.open}</Link>
                      : (
                        <form action={markRead}>
                          <input type="hidden" name="id" value={n.id} />
                          <input type="hidden" name="link" value={n.link} />
                          <button className="text-xs text-brand-700 hover:underline">{t.common.open}</button>
                        </form>
                      )
                  )}
                  {!n.read_at && (
                    <form action={markRead}>
                      <input type="hidden" name="id" value={n.id} />
                      <button className="text-xs text-muted hover:text-ink">{t.notifications.markRead}</button>
                    </form>
                  )}
                  {n.read_at && <Badge><Icon name="check" className="size-3.5" /></Badge>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
