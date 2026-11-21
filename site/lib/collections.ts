import type { Entry } from "./content";

/**
 * The two length collections (ADR-0016 A5): "the two ends of the existing
 * reading-time data", as static pages under /collections/.
 *
 * They are deliberately not the reading-time shelves (`reading-time.ts` cuts at 9
 * and 12, the shelf split a parent browses). These are the extremes — the last five
 * minutes before lights out, and the story worth a slow evening — where a smaller
 * page is a better answer than the shelf. Like the shelves, the copy is written
 * here so it and the boundaries cannot drift; a collection with nothing in it
 * builds no page, no chip and no menu link.
 */
export type Collection = {
  slug: string;
  name: string;
  /** Lower bound in minutes, inclusive. */
  min: number;
  /** Inclusive upper bound; absent means open-ended. */
  max?: number;
  /** One sentence, written to stand alone: it opens the meta description. */
  summary: string;
  /** The intro above the list. */
  body: string;
};

export const COLLECTIONS: Collection[] = [
  {
    slug: "under-5-minutes",
    name: "Under 5 minutes",
    min: 1,
    max: 4,
    summary: "Very short stories that finish inside five minutes, start to end.",
    body: "Five minutes is a real amount of bedtime: the light is off, the water is drunk, and there is room for exactly one story. These fit it whole — a single small arc with a real ending, read aloud or alone, and nothing left hanging for tomorrow.",
  },
  {
    slug: "fifteen-minutes-or-more",
    name: "Fifteen minutes or more",
    min: 15,
    summary: "Longer stories for a slow evening: fifteen minutes and up, still one sitting.",
    body: "When the evening has room, these are the ones worth settling into: fifteen minutes or more, with space for a slower opening, a middle that turns, and an ending that lands. They are still single-sitting stories — longer, not serialised — so the end is always in reach.",
  },
];

/** The stories in a collection, in the order the shelf lists them (newest first). */
export function entriesForCollection(collection: Collection, entries: Entry[]): Entry[] {
  return entries.filter(
    (entry) =>
      entry.readingTime >= collection.min &&
      (collection.max === undefined || entry.readingTime <= collection.max),
  );
}
