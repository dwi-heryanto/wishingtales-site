/**
 * Build-time story similarity (ADR-0016 A2).
 *
 * "More like this" is computed once, at index build, and stored — never ranked at
 * runtime, never ranked by reader votes (no data source on a static site, and
 * anonymous voting is a spam surface the research rejected). The rule is the ADR's,
 * in its order:
 *
 * 1. **The same age tier, exactly.** This is the no-link rule (ADR-0002) encoded as
 *    data: a kids story never recommends a gated story and vice versa, because the
 *    candidate pool is the tier before anything else happens.
 * 2. **A shared genre or theme** preferred — the tags are the honest version of
 *    similarity at this corpus size.
 * 3. **Nearest reading time** — the bedtime constraint the library already answers
 *    with `timeSiblingFor` (reading-time.ts).
 *
 * Deterministic throughout: a rebuild of the same corpus produces the same four
 * candidates, which is what makes the index's drift gate meaningful. Where the ADR
 * says "feeling", this data model's word is `themes` — the theme hubs are feelings
 * with a page.
 */

/** The most candidates a strip can hold; the ADR's number. */
export const RELATED_COUNT = 4;

/**
 * The shape of one entry as the rule reads it. Structural on purpose: the index
 * carries a subset of the frontmatter, and the rule must not force the index to
 * carry more than it needs.
 */
export type SimilarityEntry = {
  title: string;
  ageTier?: string;
  genres?: string[];
  themes?: string[];
  readingTime?: number;
};

function overlaps(a?: string[], b?: string[]): boolean {
  if (!a || a.length === 0 || !b || b.length === 0) return false;
  return a.some((item) => b.includes(item));
}

/**
 * Up to `count` slugs for one story, or fewer when its tier is smaller than that.
 * An entry missing from the map gets an empty list, not a guess.
 */
export function relatedFor(
  slug: string,
  entries: Record<string, SimilarityEntry>,
  count: number = RELATED_COUNT,
): string[] {
  const self = entries[slug];
  if (!self) return [];

  const selfMinutes = self.readingTime ?? 0;
  return Object.entries(entries)
    .filter(([key, entry]) => key !== slug && (entry.ageTier ?? "") === (self.ageTier ?? ""))
    .map(([key, entry]) => ({
      slug: key,
      title: entry.title,
      minutes: entry.readingTime ?? 0,
      shares: overlaps(entry.genres, self.genres) || overlaps(entry.themes, self.themes),
    }))
    .sort(
      (a, b) =>
        (b.shares ? 1 : 0) - (a.shares ? 1 : 0) ||
        Math.abs(a.minutes - selfMinutes) - Math.abs(b.minutes - selfMinutes) ||
        (a.title < b.title ? -1 : a.title > b.title ? 1 : 0) ||
        (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
    )
    .slice(0, count)
    .map((candidate) => candidate.slug);
}
