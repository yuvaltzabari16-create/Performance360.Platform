/**
 * Operator details shown on legal pages. They come from environment variables so they can be
 * set per deployment without code changes, and nothing is invented when they are missing.
 */
export interface AccessibilityContact {
  coordinator: string | null;
  email: string | null;
  phone: string | null;
}

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

/** Accessibility coordinator contact (ACCESSIBILITY_COORDINATOR / _EMAIL / _PHONE). */
export function accessibilityContact(): AccessibilityContact {
  return {
    coordinator: clean(process.env.ACCESSIBILITY_COORDINATOR),
    email: clean(process.env.ACCESSIBILITY_EMAIL),
    phone: clean(process.env.ACCESSIBILITY_PHONE),
  };
}
