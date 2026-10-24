import Link from "next/link";
import { Badge, Card, EmptyState, Field, FlashMessage, PageHeader, Select, Textarea, cx } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { requireSection } from "@/lib/auth";
import { isUuid } from "@/lib/forms";
import { sendMessage } from "./actions";

export const metadata = { title: "Messages" };

interface Message { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null }
interface Contact { user_id: string; full_name: string; label: string }

export default async function MessagesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user, profile, t } = await requireSection("messages");
  const tm = t.messages;

  const [{ data: contactRows }, { data: messageRows }] = await Promise.all([
    supabase.rpc("message_contacts"),
    supabase.from("direct_messages").select("id, sender_id, recipient_id, body, created_at, read_at").order("created_at", { ascending: false }).limit(400),
  ]);
  const contacts = (contactRows ?? []) as Contact[];
  const messages = (messageRows ?? []) as Message[];
  const contactOf = (id: string) => contacts.find((c) => c.user_id === id);
  const labelOf = (c: Contact) => (t.orgRoles as Record<string, string>)[c.label] ?? (t.roles as Record<string, string>)[c.label] ?? (c.label === "athlete" ? t.roles.athlete : c.label);

  // One conversation per counterpart, newest first.
  const threads = new Map<string, { last: Message; unread: number }>();
  for (const m of messages) {
    const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
    const th = threads.get(other) ?? { last: m, unread: 0 };
    if (m.recipient_id === user.id && !m.read_at) th.unread += 1;
    threads.set(other, th);
  }
  const withId = isUuid(sp.with) ? sp.with : null;
  const active = withId ? contactOf(withId) ?? (threads.has(withId) ? { user_id: withId, full_name: tm.unknown, label: "" } : null) : null;
  const thread = withId ? messages.filter((m) => (m.sender_id === withId && m.recipient_id === user.id) || (m.sender_id === user.id && m.recipient_id === withId)).reverse() : [];
  if (withId && thread.some((m) => m.recipient_id === user.id && !m.read_at)) await supabase.rpc("mark_messages_read", { p_with: withId });

  return (
    <>
      <PageHeader title={tm.title} subtitle={tm.subtitle} />
      <FlashMessage error={sp.error} ok={sp.ok} />
      {contacts.length === 0 && threads.size === 0 ? (
        <EmptyState title={tm.empty} body={tm.noContacts} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card title={tm.conversations}>
              {threads.size === 0 ? <p className="text-sm text-muted">{tm.emptyHelp}</p> : (
                <ul className="-my-2 divide-y divide-line" data-testid="threads">
                  {[...threads.entries()].map(([id, th]) => {
                    const c = contactOf(id);
                    return (
                      <li key={id}>
                        <Link href={`/messages?with=${id}`} className={cx("block rounded-lg px-2 py-2.5 text-sm hover:bg-canvas", id === withId && "bg-brand-50")}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-ink"><bdi>{c?.full_name ?? tm.unknown}</bdi></span>
                            {th.unread > 0 && <Badge tone="green">{th.unread}</Badge>}
                          </div>
                          <div className="truncate text-xs text-muted"><bdi>{th.last.body}</bdi></div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
            {contacts.length > 0 && (
              <Card title={tm.newConversation}>
                <form action="/messages" method="get" className="space-y-3">
                  <Field label={tm.to}>
                    <Select name="with" defaultValue="" required>
                      <option value="" disabled>{tm.choose}</option>
                      {contacts.map((c) => <option key={c.user_id} value={c.user_id}>{c.full_name} · {labelOf(c)}</option>)}
                    </Select>
                  </Field>
                  <SubmitButton variant="secondary">{tm.newConversation}</SubmitButton>
                </form>
              </Card>
            )}
          </div>

          <Card title={active ? <>{active.full_name}{active.label && <span className="ms-2 text-xs font-normal text-muted">{labelOf(active)}</span>}</> : tm.title}>
            {!active ? <p className="text-sm text-muted">{tm.selectThread}</p> : (
              <div className="flex min-h-80 flex-col">
                <ul className="flex-1 space-y-3" data-testid="thread">
                  {thread.map((m) => {
                    const mine = m.sender_id === user.id;
                    return (
                      <li key={m.id} className={cx("flex", mine ? "justify-end" : "justify-start")}>
                        <div className={cx("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm", mine ? "bg-brand-600 text-white" : "bg-canvas text-ink")}>
                          <p className="whitespace-pre-line break-words"><bdi>{m.body}</bdi></p>
                          <div className={cx("num mt-1 text-[10px]", mine ? "text-white/70" : "text-muted")}>{new Date(m.created_at).toLocaleString(profile.locale, { dateStyle: "short", timeStyle: "short" })}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {contactOf(active.user_id) && (
                  <form action={sendMessage} className="mt-4 flex flex-col gap-2 border-t border-line pt-4 sm:flex-row">
                    <input type="hidden" name="to" value={active.user_id} />
                    <Textarea name="body" rows={2} required maxLength={4000} aria-label={tm.placeholder} placeholder={tm.placeholder} className="flex-1" />
                    <SubmitButton>{tm.send}</SubmitButton>
                  </form>
                )}
                <p className="mt-3 text-xs text-muted">{tm.privacy}</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
