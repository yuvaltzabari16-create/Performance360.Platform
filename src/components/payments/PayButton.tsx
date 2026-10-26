import { Icon } from "@/components/ui/Icon";

/** Link to the external provider's hosted checkout page (opens in a new tab). */
export function PayButton({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-describedby={undefined}
      title={hint}
      className="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
    >
      {label} <Icon name="external" className="ms-1 size-3.5" />
      <span className="sr-only"> — {hint}</span>
    </a>
  );
}
