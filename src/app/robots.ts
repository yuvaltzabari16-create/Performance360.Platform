import type { MetadataRoute } from "next";
import { PRIVATE_PREFIXES, PUBLIC_PAGES, publicBaseUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: [...PUBLIC_PAGES], disallow: PRIVATE_PREFIXES.map((p) => `${p}/`).concat(PRIVATE_PREFIXES) },
    sitemap: `${publicBaseUrl()}/sitemap.xml`,
  };
}
