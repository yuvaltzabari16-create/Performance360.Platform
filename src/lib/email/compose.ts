/** Builds the email for one notification. Text is escaped; the link must be a path inside the app. */
export interface MailItem {
  email: string;
  full_name: string | null;
  locale: string | null;
  title: string;
  body: string | null;
  link: string | null;
}

export interface Mail { to: string; subject: string; html: string; text: string; dir: "ltr" | "rtl" }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const COPY = {
  en: { hello: "Hello", open: "Open in Performance360 Academy", footer: "You get this email because email notifications are on. Change it in Settings." },
  he: { hello: "שלום", open: "פתיחה ב-Performance360 Academy", footer: "קיבלתם את המייל כי התראות במייל פעילות. אפשר לשנות בהגדרות." },
} as const;

/** Only same-site paths are linked, never an arbitrary address. */
export function safeLink(site: string, link: string | null): string | null {
  if (!link || !/^\/[A-Za-z0-9/_\-?=&.#%]*$/.test(link) || link.startsWith("//")) return null;
  return `${site.replace(/\/+$/, "")}${link}`;
}

export function composeMail(item: MailItem, site: string): Mail {
  const lang = item.locale === "he" ? "he" : "en";
  const c = COPY[lang];
  const dir = lang === "he" ? "rtl" : "ltr";
  const url = safeLink(site, item.link);
  const name = item.full_name?.trim() ? ` ${item.full_name.trim().split(/\s+/)[0]}` : "";
  const body = item.body ?? "";
  const html = `<div dir="${dir}" style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#12211a">`
    + `<p>${c.hello}${esc(name)},</p><p><b>${esc(item.title)}</b>${body ? `<br>${esc(body)}` : ""}</p>`
    + (url ? `<p><a href="${esc(url)}">${c.open}</a></p>` : "")
    + `<p style="color:#667;font-size:12px">${c.footer}</p></div>`;
  const text = [`${c.hello}${name},`, "", item.title, body, url ? `${c.open}: ${url}` : "", "", c.footer].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  return { to: item.email, subject: item.title.slice(0, 150), html, text, dir };
}
