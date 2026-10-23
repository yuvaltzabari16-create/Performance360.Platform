import { headers } from "next/headers";
import { HONEYPOT_FIELD, TIMESTAMP_FIELD, issueFormToken, turnstileEnabled } from "@/lib/security/bot-guard";

/**
 * Hidden anti-bot inputs for a public form. Drop it inside the <form>; the matching server
 * action calls `verifyBotGuard(formData)`.
 */
export async function BotGuardFields() {
  const token = await issueFormToken();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      {/* Honeypot: off-screen, not focusable, ignored by assistive tech. Humans leave it empty. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Leave this field empty
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <input type="hidden" name={TIMESTAMP_FIELD} value={token} />
      {turnstileEnabled() && (
        <>
          <div className="cf-turnstile" data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer nonce={nonce} />
        </>
      )}
    </>
  );
}
