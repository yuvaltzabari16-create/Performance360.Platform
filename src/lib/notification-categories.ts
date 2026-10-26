/** Kinds of in-app notification a person can switch off. The database names a notification "<category>.<event>". */
export const NOTIFICATION_CATEGORIES = ["injury", "message", "program", "team", "connection"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Categories the person has muted, from the stored preferences. */
export function mutedCategories(prefs: { muted?: unknown } | null | undefined): NotificationCategory[] {
  const list = Array.isArray(prefs?.muted) ? (prefs!.muted as unknown[]) : [];
  return NOTIFICATION_CATEGORIES.filter((c) => list.includes(c));
}
