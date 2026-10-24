import type { MetadataRoute } from "next";
import { getEntriesAt, getEntriesAtTier, getKidsEntries, getKidsSeries, getKidsThemes } from "@/lib/content";
import { indexAllowed } from "@/lib/gate";
import { AUTHOR_COLLECTIONS, entriesForCollection } from "@/lib/authors";
import { TIME_SHELVES, entriesForTimeShelf } from "@/lib/reading-time";
import { absUrl } from "@/lib/site";
import { AGE_TIERS, GENRES } from "@/lib/tiers";
import { tierGenrePath, tierPath } from "@/lib/urls";

export const dynamic = "force-static";

/**
 * Published content only. Drafts live on their own branch and are never part of
 * a build, so they cannot leak into the sitemap (D7).
 *
 * Gated content is excluded for the same kind of reason, from the other direction: an
 * adult page is `noindex`, and a page that says `noindex` while the sitemap asks for it to
 * be crawled is a contradiction Google resolves by trusting the page (ADR-0002). Both
 * sides read `indexAllowed`, so flipping the switch moves the pages and this list
 * together.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const entries = getKidsEntries();
  const newest = entries[0]?.publishedAt;

  const staticPages: MetadataRoute.Sitemap = [
    { url: absUrl("/"), lastModified: newest, changeFrequency: "daily", priority: 1 },
    { url: absUrl("/stories/"), lastModified: newest, changeFrequency: "weekly", priority: 0.8 },
    { url: absUrl("/classics/"), lastModified: newest, changeFrequency: "weekly", priority: 0.8 },
    { url: absUrl("/series/"), lastModified: newest, changeFrequency: "monthly", priority: 0.6 },
    { url: absUrl("/authors/"), lastModified: newest, changeFrequency: "monthly", priority: 0.6 },
    { url: absUrl("/reading-time/"), lastModified: newest, changeFrequency: "monthly", priority: 0.6 },
    { url: absUrl("/themes/"), lastModified: newest, changeFrequency: "monthly", priority: 0.5 },
    { url: absUrl("/about/"), changeFrequency: "yearly", priority: 0.4 },
    { url: absUrl("/sources/"), changeFrequency: "monthly", priority: 0.4 },
    { url: absUrl("/privacy/"), changeFrequency: "yearly", priority: 0.2 },
    { url: absUrl("/terms/"), changeFrequency: "yearly", priority: 0.2 },
  ];

  /*
   * The age and genre shelves, which are the search traffic this structure exists for:
   * "spooky stories for 8-12 year olds" is a page, not a query parameter (ADR-0001). Only
   * shelves that hold something are listed, matching the pages that were built, and the
   * gated ones are left out while the switch is off (ADR-0002).
   */
  const shelves: MetadataRoute.Sitemap = [];
  for (const tier of AGE_TIERS) {
    if (!indexAllowed(tier)) continue;
    if (getEntriesAtTier(tier).length > 0) {
      shelves.push({
        url: absUrl(tierPath(tier)),
        lastModified: newest,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
    for (const genre of GENRES) {
      const onShelf = getEntriesAt(tier, genre);
      if (onShelf.length === 0) continue;
      shelves.push({
        url: absUrl(tierGenrePath(tier, genre)),
        lastModified: onShelf[0].publishedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  }

  return [
    ...staticPages,
    ...shelves,
    /*
     * Every story carries its cover as an image entry. The art is the most distinctive
     * thing about a story page and image search is a real way into a children's library —
     * "cinderella illustration" is a query this site can answer, and without the image
     * entry Google has to guess which picture on the page is the subject (issue #113).
     */
    ...entries.map((entry) => ({
      url: absUrl(entry.url),
      lastModified: entry.publishedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      images: [absUrl(entry.cover)],
    })),
    ...getKidsSeries().map((hub) => ({
      url: absUrl(hub.url),
      lastModified: newest,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    /*
     * The time shelves, which answer "a story that fits before lights out" — the second
     * question a parent asks after the age (issue #115).
     */
    ...TIME_SHELVES.filter((shelf) => entriesForTimeShelf(shelf, entries).length > 0).map((shelf) => ({
      url: absUrl("/reading-time/" + shelf.slug + "/"),
      lastModified: newest,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...getKidsThemes().map((hub) => ({
      url: absUrl(hub.url),
      lastModified: newest,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    /*
     * The writer collections, for the queries that name a writer rather than a title
     * ("grimm fairy tales"). Only the ones with stories on the shelf: a collection page with
     * nothing under it is a page that cannot keep its promise (issue #115).
     */
    ...AUTHOR_COLLECTIONS.filter((collection) => entriesForCollection(collection, entries).length > 0).map(
      (collection) => ({
        url: absUrl("/authors/" + collection.slug + "/"),
        lastModified: newest,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      }),
    ),
  ];
}
