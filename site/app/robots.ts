import type { MetadataRoute } from "next";
import { SITE, absUrl } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: absUrl("/sitemap.xml"),
    host: SITE.url,
  };
}
