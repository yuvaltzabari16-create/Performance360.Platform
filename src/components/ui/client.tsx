"use client";

import { useState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button, cx } from "./index";

/** Submit button that disables itself while the form is pending (prevents double submits). */
export function SubmitButton({ children, pendingText, ...props }: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? pendingText ?? children : children}
    </Button>
  );
}

/** Submit button that asks for confirmation first. */
export function ConfirmSubmit({ message, children, ...props }: ComponentProps<typeof Button> & { message: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...props}
    >
      {children}
    </Button>
  );
}

export function CopyButton({ value, label, copiedLabel, className }: { value: string; label: string; copiedLabel: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? copiedLabel : label}
    </Button>
  );
}

export function ShareButton({ title, text, url, label, fallbackLabel }: { title: string; text: string; url: string; label: string; fallbackLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      onClick={async () => {
        if (navigator.share) {
          try {
            await navigator.share({ title, text, url });
            return;
          } catch {
            // user cancelled; fall through to copy
          }
        }
        try {
          await navigator.clipboard.writeText(`${text} ${url}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
    >
      {copied ? fallbackLabel : label}
    </Button>
  );
}

/** Select that submits its form on change (used in filter bars). */
export function AutoSubmitSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cx(
        "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100",
        className,
      )}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    />
  );
}

export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
