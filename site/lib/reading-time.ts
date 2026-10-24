import type { Entry } from "./content";

/**
 * Shelves by how long a story takes, which is how a bedtime gets decided.
 *
 * "A story that fits before lights out" is a real constraint and the library has the data
 * for it: every story carries a reading time, and the kids' shelf runs from nine to fifteen
 * minutes. Two bands are enough — under ten minutes, and twelve and up — because the middle
 * is most of the library and a "ten to eleven minutes" page is a shelf for nobody
 * (issue #115).
 *
 * The bands are written here rather than derived, so the copy and the boundaries cannot
 * drift; the entries come from the content at build time.
 */
export type TimeShelf = {
  slug: string;
  name: string;
  /** Lower bound in minutes, inclusive. */
  min: number;
  /** Upper bound in minutes, inclusive; absent means open-ended. */
  max?: number;
  /** One sentence, written to stand alone: it opens the meta description. */
  summary: string;
  /** The intro above the list. */
  body: string;
};

export const TIME_SHELVES: TimeShelf[] = [
  {
    slug: "short-reads",
    name: "Short reads",
    min: 1,
    max: 9,
    summary: "Short stories that finish in one sitting: nine minutes or less, start to end.",
    body: "These are the stories for the last ten minutes before lights out, or the bus ride home: a whole arc, a real ending, and nothing left hanging. Every one takes nine minutes or less to read aloud, which is the difference between a story and a promise to finish tomorrow.",
  },
  {
    slug: "longer-reads",
    name: "Longer reads",
    min: 12,
    summary: "Longer stories for a reader with more time: twelve minutes and up, still in one sitting.",
    body: "When there is time for a proper sit-down, these are the ones to pick: twelve minutes or more, with room for a slower opening and a second turn. They are still single-sitting stories — longer, not serialised — so the end is always in reach.",
  },
];

/** The stories in a band, in the order the shelf lists them (newest first). */
export function entriesForTimeShelf(shelf: TimeShelf, entries: Entry[]): Entry[] {
  return entries.filter(
    (entry) => entry.readingTime >= shelf.min && (shelf.max === undefined || entry.readingTime <= shelf.max),
  );
}
/**
 * The wall's time filters, using the shelves' own boundaries.
 *
 * Nine and twelve are `TIME_SHELVES`' edges on purpose: a filter that said "under ten"
 * while the shelf said "nine or less" would put the same story in two different answers.
 * The middle band exists only here, because it is a filter a parent uses ("I have eleven
 * minutes") rather than a shelf anybody would browse (issue #115).
 */
export type TimeFilter = {
  id: string;
  label: string;
  min: number;
  /** Inclusive upper bound; absent means open-ended. */
  max?: number;
};

export const TIME_FILTERS: TimeFilter[] = [
  { id: "short", label: "9 minutes or less", min: 1, max: 9 },
  { id: "mid", label: "10 to 11 minutes", min: 10, max: 11 },
  { id: "long", label: "12 minutes or more", min: 12 },
];

export function inTimeFilter(filter: TimeFilter, minutes: number): boolean {
  return minutes >= filter.min && (filter.max === undefined || minutes <= filter.max);
}

/**
 * A story of about the same length, for the end of a different one.
 *
 * "More like this" answers the shelf question; this answers the bedtime one, which the
 * library has data for and the end of a story did not offer. Candidates are already on
 * the reader's side of the gate, and the ones linked above are excluded so the same title
 * cannot appear twice in the closing block. Ties go to the shorter story.
 */
export function timeSiblingFor(entry: Entry, candidates: Entry[], taken: Set<string>): Entry | undefined {
  return candidates
    .filter((candidate) => candidate.slug !== entry.slug && !taken.has(candidate.slug))
    .sort(
      (a, b) =>
        Math.abs(a.readingTime - entry.readingTime) - Math.abs(b.readingTime - entry.readingTime) ||
        a.readingTime - b.readingTime,
    )[0];
}
