import { AGE_TIERS, GENRES, type AgeTier, type Genre } from "./tiers.ts";

/**
 * Where a shelf and a story live.
 *
 * The age tier is the first segment everywhere, because the tier is the promise a reader
 * browses on: "spooky stories for 8-12 year olds" is a page, not a query parameter
 * (ADR-0001). One module builds every one of these paths, so a canonical, a breadcrumb,
 * a sitemap entry and a redirect cannot disagree about where a story is.
 */

/** `/8-12/` — the shelf for one tier. */
export function tierPath(tier: AgeTier): string {
  return `/${tier}/`;
}

/**
 * The tier a URL segment names.
 *
 * Next hands a dynamic segment back still percent-encoded — the tier `13+` arrives as
 * `"13%2B"` — so the segment is decoded before it is matched against the vocabulary.
 * Anything that is not a tier answers `undefined` and becomes a 404, which is what
 * `dynamicParams = false` is for.
 */
export function tierFromSegment(segment: string): AgeTier | undefined {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    /* a malformed escape is not a tier either */
  }
  return AGE_TIERS.find((tier) => tier === decoded);
}

/**
 * `folk tale` → `folk-tale`.
 *
 * A genre is a phrase a reader reads and a URL segment is a word a server matches, so
 * the space has to go somewhere. Derived from the closed vocabulary rather than written
 * out a second time, so a genre cannot end up with one spelling on the shelf and another
 * in the address bar.
 */
export function genreSlug(genre: Genre): string {
  return genre.replace(/ /g, "-");
}

/** The genre a URL segment names, or undefined for anything the vocabulary does not hold. */
export function genreFromSlug(slug: string): Genre | undefined {
  return GENRES.find((genre) => genreSlug(genre) === slug);
}

/** `/8-12/folk-tale/` — the shelf for one genre at one tier. */
export function tierGenrePath(tier: AgeTier, genre: Genre): string {
  return `${tierPath(tier)}${genreSlug(genre)}/`;
}

/**
 * `/8-12/folk-tale/the-snow-queen/` — where a story lives.
 *
 * The genre here is the story's **primary** genre, the first one its frontmatter lists.
 * A story may sit on three shelves, but it has one address — and the promise the writer
 * wrote first is the one the address names. That rule is this module's, not the ADR's:
 * ADR-0001 fixes the shape (`/8-12/horror/...`) and says nothing about a story with
 * three genres, so the tie is broken in the one place that can break it consistently.
 */
export function entryPath(tier: AgeTier, genre: Genre, slug: string): string {
  return `${tierGenrePath(tier, genre)}${slug}/`;
}
