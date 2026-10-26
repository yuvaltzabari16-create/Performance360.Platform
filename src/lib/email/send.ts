import type { Mail } from "./compose";

/** Sends through Resend (https://resend.com). EMAIL_PROVIDER=mock accepts everything without sending (tests only). */
export function mailConfigured(): boolean {
  return process.env.EMAIL_PROVIDER === "mock" || Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(mail: Mail): Promise<boolean> {
  if (process.env.EMAIL_PROVIDER === "mock") return true;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
