import { createContext, useContext } from "react";
import type { Dictionary } from "@/lib/i18n/en";
import type { Lang, LiteState } from "./model";
import type { LITE } from "./strings";

export interface Ctx {
  s: LiteState;
  update: (fn: (s: LiteState) => LiteState) => void;
  lang: Lang;
  L: (typeof LITE)["en"];
  d: Dictionary;
  today: string;
  go: (screen: Screen) => void;
}
export type Screen = { name: "overview" | "athletes" | "training" | "library" | "assistant" | "settings"; athleteId?: string; programId?: string };

export const AppCtx = createContext<Ctx | null>(null);
export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("outside provider");
  return c;
}
