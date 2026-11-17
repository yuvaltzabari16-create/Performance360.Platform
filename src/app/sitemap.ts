import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, publicBaseUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = publicBaseUrl();
  return PUBLIC_PAGES.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" ? "monthly" : "yearly",
    priority: path === "/" ? 1 : path === "/login" || path === "/signup" ? 0.6 : 0.3,
  }));
}
