import Link from "next/link";
import { BotGuardFields } from "@/components/security/BotGuardFields";
import { redirect } from "next/navigation";
import { Field, FlashMessage, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/forms";
import { sectionsFor } from "@/lib/permissions";
import { LOGIN_ROLES, isLoginRole } from "@/lib/login-roles";
import { login } from "../actions";

export const metadata = { title: "Sign in" };

/** Profile role and team role of each login choice, to list what that login opens. */
const LOGIN_ACCOUNT: Record<(typeof LOGIN_ROLES)[number], Parameters<typeof sectionsFor>> = {
  director: ["org_admin", "director"],
  head_coach: ["performance_coach", "head_coach"],
  physiotherapist: ["physiotherapist", "physiotherapist"],
  head_of_performance: ["performance_coach", "head_of_performance"],
  athlete: ["athlete", null],
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t, user } = await getSession();
  const next = safeNext(sp.next);
  if (user) redirect(next);
  const chosen = isLoginRole(sp.as) ? sp.as : null;
  const roleName = (r: (typeof LOGIN_ROLES)[number]) => (r === "athlete" ? t.roles[r] : t.orgRoles[r]);
  const optionHref = (r: string | null) => `/login?${r ? `as=${r}&` : ""}next=${encodeURIComponent(next)}`;
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-ink">{t.auth.loginTitle}</h1>
      <FlashMessage error={sp.error} ok={sp.ok} />
      <nav aria-label={t.auth.loginAs} className="mb-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{t.auth.loginAs}</p>
        <ul className="flex flex-wrap gap-2" data-testid="login-roles">
          {[null, ...LOGIN_ROLES].map((r) => (
            <li key={r ?? "any"}>
              <Link
                href={optionHref(r)}
                aria-current={r === chosen ? "true" : undefined}
                className={`inline-block rounded-full px-3 py-1.5 text-sm ring-1 ring-inset ${r === chosen ? "bg-brand-600 font-medium text-white ring-brand-600" : "text-ink-soft ring-line hover:bg-canvas"}`}
              >
                {r ? roleName(r) : t.auth.loginAny}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {chosen && (
        <section aria-label={t.loginRole.sees} data-testid="login-role-panel" className="mb-5 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm">
          <p className="font-medium text-brand-800">{roleName(chosen)}</p>
          <p className="mt-1 text-ink-soft">{t.loginRole[chosen].blurb}</p>
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">{t.loginRole.sees}</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {sectionsFor(...LOGIN_ACCOUNT[chosen]).filter((x) => x !== "notifications" && x !== "settings").map((x) => (
              <li key={x} className="rounded-full bg-surface px-2 py-0.5 text-xs text-ink-soft ring-1 ring-inset ring-line">{x === "athletes" && chosen === "athlete" ? t.nav.myTraining : t.nav[x]}</li>
            ))}
          </ul>
          <p className="mt-3"><Link className="font-medium text-brand-700 hover:underline" href={t.loginRole[chosen].href}>{t.loginRole[chosen].newHere}</Link></p>
        </section>
      )}
      <form action={login} className="space-y-4">
        <BotGuardFields />
        {chosen && <input type="hidden" name="as" value={chosen} />}
        <input type="hidden" name="next" value={next} />
        <Field label={t.common.email}><Input type="email" name="email" autoComplete="email" required /></Field>
        <Field label={t.auth.password}><Input type="password" name="password" autoComplete="current-password" required /></Field>
        <SubmitButton className="w-full" pendingText={t.common.loading}>{t.auth.login}</SubmitButton>
      </form>
      <div className="mt-6 space-y-2 text-sm text-ink-soft">
        <p><Link className="text-brand-700 hover:underline" href="/forgot-password">{t.auth.forgot}</Link></p>
        <p>{t.auth.noAccount} <Link className="font-medium text-brand-700 hover:underline" href={`/signup?next=${encodeURIComponent(next === "/dashboard" ? "/onboarding" : next)}`}>{t.auth.signup}</Link></p>
      </div>
    </>
  );
}
