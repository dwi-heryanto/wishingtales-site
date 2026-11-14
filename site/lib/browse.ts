import { getEntriesAt, getKidsClassics, getKidsEntries, getKidsSeries, getKidsStories, getKidsThemes } from "./content";
import { genreLabel } from "./format";
import { DEFAULT_TIER, GENRES, type AgeTier, type Genre } from "./tiers";
import { tierGenrePath } from "./urls";

/**
 * The browse surfaces: one genre list and one census, so the header, the footer and
 * `/browse/` cannot disagree about what the library holds.
 *
 * The counts are the point. A menu that says "Genres" and hands over thirteen names —
 * eleven of them empty — is a menu a reader has to try rather than read; a genre with a
 * number beside it says what is behind the door before it is opened (ADR-0001: an empty
 * shelf is worse than no shelf, and that is true of a link as much as of a page).
 */

export type GenreShelf = {
  genre: Genre;
  label: string;
  count: number;
  href: string;
};

/**
 * The genre shelves at one tier that actually hold something, fullest first.
 *
 * Ties are broken by label so the order is stable between builds: a list that reshuffles
 * itself between two identical builds is a list that cannot be checked.
 */
export function genreShelvesAt(tier: AgeTier = DEFAULT_TIER): GenreShelf[] {
  return GENRES.map((genre) => ({
    genre,
    label: genreLabel(genre),
    count: getEntriesAt(tier, genre).length,
    href: tierGenrePath(tier, genre),
  }))
    .filter((shelf) => shelf.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * What the children's library holds, in one read.
 *
 * Read through the `Kids` accessors rather than filtered here, because that is the one
 * place the adult gate is applied (ADR-0002) and a browse page that counted its own way
 * would be the page that links a child to a gated shelf.
 */
export function kidsLibrary() {
  const entries = getKidsEntries();
  return {
    entries,
    stories: getKidsStories(),
    classics: getKidsClassics(),
    series: getKidsSeries(),
    themes: getKidsThemes(),
    count: entries.length,
  };
}
