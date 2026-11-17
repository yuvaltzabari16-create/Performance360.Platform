"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { entryToRestore, FORM_MEMORY_KEY, pickFields, type FormMemory as Entry } from "@/lib/form-memory";

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const store = {
  get: () => { try { return sessionStorage.getItem(FORM_MEMORY_KEY); } catch { return null; } },
  set: (v: string) => { try { sessionStorage.setItem(FORM_MEMORY_KEY, v); } catch { /* storage blocked: nothing to keep */ } },
  clear: () => { try { sessionStorage.removeItem(FORM_MEMORY_KEY); } catch { /* ignore */ } },
};

/**
 * Puts back what the person typed when a server action fails and redirects with `?error=` (see lib/form-memory.ts).
 * Mounted once in the root layout; renders nothing.
 */
export function FormMemory() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  // Before any form posts, keep its visible values for this page.
  useEffect(() => {
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form || form.method.toLowerCase() === "get" || form.dataset.noMemory !== undefined) return;
      const controls = [...form.elements].filter((el): el is Control => "name" in el && "value" in el);
      const fields = pickFields(controls.map((c) => ({ name: c.name, type: c.type, value: c.value, checked: "checked" in c ? c.checked : undefined, dataset: c.dataset })));
      if (fields.length === 0) return;
      const entry: Entry = { path: window.location.pathname, form: [...document.forms].indexOf(form), fields, at: Date.now() };
      store.set(JSON.stringify(entry));
    };
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  // After a navigation: restore on a failed submission, otherwise forget.
  useEffect(() => {
    const entry = entryToRestore(store.get(), pathname, `?${search}`);
    store.clear();
    if (!entry) return;
    const form = document.forms[entry.form];
    if (!form) return;
    for (const f of entry.fields) {
      const el = form.elements.namedItem(f.name);
      if (!el) continue;
      if (el instanceof RadioNodeList) {
        for (const node of el) if (node instanceof HTMLInputElement && node.value === f.value) node.checked = Boolean(f.checked);
      } else if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
        el.checked = Boolean(f.checked);
      } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        // What the person typed wins over the saved value an edit form starts with.
        el.value = f.value;
      }
    }
  }, [pathname, search]);

  return null;
}
