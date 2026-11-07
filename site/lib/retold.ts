import type { Entry } from "@/lib/content";

/**
 * The second name of a retold classic: the tale it retells, when the tale's name is not
 * the name the retelling carries. A classic that keeps the tale's own traditional title
 * answers to a single name, and every surface that pairs the two — the page title tag,
 * the card line, the reader's retelling line and the drawn social card — asks here
 * instead of testing the pair separately. Added with the 2026-10-24 retitle of the
 * Aladdin retelling to the tale's own name, which doubled the title tag until the pair
 * was asked in one place.
 *
 * This lives apart from `@/lib/content` on purpose: that module reads the published
 * markdown from disk, which only a server build may do, while every card renders on the
 * client too. A client bundle that reaches `@/lib/content` by value drags `node:fs` into
 * a browser chunk and Turbopack panics on it; this module is pure data over the parsed
 * entry, so a value import from it is safe anywhere the type import already was.
 */
export function secondName(entry: Pick<Entry, "title" | "sourceTale">): string | undefined {
  if (!entry.sourceTale) return undefined;
  return entry.sourceTale.toLowerCase() === entry.title.toLowerCase() ? undefined : entry.sourceTale;
}
