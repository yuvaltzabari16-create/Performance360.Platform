"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { useDraft } from "@/lib/autosave/useDraft";

/**
 * A textarea that remembers unsent text on this device. The draft is cleared when the form it
 * belongs to is submitted. `draftKey` must be unique per place (for example "note:<athleteId>").
 */
export function DraftTextarea({ draftKey, restoredLabel, className, ...props }: { draftKey: string; restoredLabel: string } & Omit<ComponentProps<"textarea">, "value" | "onChange" | "defaultValue">) {
  const { value, setValue, restored, clear } = useDraft(draftKey);
  const ref = useRef<HTMLTextAreaElement>(null);

  // Clear the stored draft when the surrounding form is submitted. Clearing must wait until the
  // submit event has finished: the form data is read during the event, and clearing earlier
  // would send an empty note.
  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onSubmit = () => { setTimeout(clear, 0); };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [clear]);

  return (
    <div>
      <textarea ref={ref} value={value} onChange={(e) => setValue(e.target.value)} className={className} {...props} />
      {restored && <p className="mt-1 text-xs text-muted" role="status">{restoredLabel}</p>}
    </div>
  );
}
