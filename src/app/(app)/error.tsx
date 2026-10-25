"use client";

import { Button } from "@/components/ui";

// Generic message only: server error details are never shown to users.
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-surface p-6 text-center">
      <h1 className="font-semibold text-ink">Something went wrong / משהו השתבש</h1>
      <p className="mt-2 text-sm text-ink-soft">Please try again. If the problem continues, contact support.</p>
      <Button className="mt-4" onClick={reset}>Try again / נסו שוב</Button>
    </div>
  );
}
