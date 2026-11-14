import { getLatest } from "@/lib/content";
import { SITE, absUrl } from "@/lib/site";

export const dynamic = "force-static";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Latest 30 published stories. Drafts are never built, so they cannot appear. */
export function GET() {
  const entries = getLatest(30);
  const items = entries
    .map((entry) =>
      [
        "    <item>",
        "      <title>" + escapeXml(entry.title) + "</title>",
        "      <link>" + absUrl(entry.url) + "</link>",
        '      <guid isPermaLink="true">' + absUrl(entry.url) + "</guid>",
        "      <pubDate>" + new Date(entry.publishedAt + "T06:00:00Z").toUTCString() + "</pubDate>",
        "      <description>" + escapeXml(entry.summary) + "</description>",
        "    </item>",
      ].join("\n"),
    )
    .join("\n");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    "    <title>" + escapeXml(SITE.name + " \u2014 " + SITE.tagline) + "</title>",
    "    <link>" + absUrl("/") + "</link>",
    '    <atom:link href="' + absUrl("/rss.xml") + '" rel="self" type="application/rss+xml" />',
    "    <description>" + escapeXml(SITE.description) + "</description>",
    "    <language>en</language>",
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
