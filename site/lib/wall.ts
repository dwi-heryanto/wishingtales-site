import type { Entry } from "./content";
import { TIME_FILTERS, inTimeFilter } from "./reading-time";

/**
 * The browse wall's state and matching rules, kept out of the component and free of
 * Node imports so the client bundle cannot pull `site/lib/content.ts` (which reads the
 * filesystem) in by accident. `import type` is erased, so the Entry type is safe here.
 */

export const SORTS = [
  { id: "newest", label: "Newest first" },
  { id: "shortest", label: "Shortest first" },
  { id: "title", label: "Title A to Z" },
] as const;

export type SortId = (typeof SORTS)[number]["id"];

export type WallState = {
  q: string;
  /** A TIME_FILTERS id, or "" for every length. */
  time: string;
  /** A primary or secondary genre id, or "". */
  genre: string;
  /** A theme slug, or "". */
  theme: string;
  sort: SortId;
};

export const EMPTY_WALL: WallState = { q: "", time: "", genre: "", theme: "", sort: "newest" };

/** Read the wall's state from a location.search string. Unknown values fall back. */
export function readWallState(search: string): WallState {
  const params = new URLSearchParams(search);
  const time = params.get("time") ?? "";
  const sort = params.get("sort") ?? "";
  return {
    q: params.get("q") ?? "",
    time: TIME_FILTERS.some((filter) => filter.id === time) ? time : "",
    genre: params.get("genre") ?? "",
    theme: params.get("theme") ?? "",
    sort: (SORTS.some((option) => option.id === sort) ? sort : "newest") as SortId,
  };
}

/** Serialise only what differs from the default, so a clean wall has a clean URL. */
export function writeWallState(state: WallState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.time) params.set("time", state.time);
  if (state.genre) params.set("genre", state.genre);
  if (state.theme) params.set("theme", state.theme);
  if (state.sort !== "newest") params.set("sort", state.sort);
  return params.toString();
}

/** Lowercase without accents, so "Bremen" and "bremen" and "Brémén" agree. */
export function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * What a search matches: the title, the summary, every genre, every theme's title (not
 * its slug), the tale a classic retells, and the series it belongs to. `sourceTale` is
 * the field that lets a search for a tale's own name — "Aladdin" — find the classic
 * that retells it, even where its display title does not carry that name.
 */
export function searchText(
  entry: Entry,
  seriesTitle: string | undefined,
  themeTitles: Map<string, string>,
): string {
  return normalise(
    [
      entry.title,
      entry.summary,
      entry.genres.join(" "),
      entry.themes.map((slug) => themeTitles.get(slug) ?? slug).join(" "),
      entry.sourceTale,
      seriesTitle,
      entry.kind === "classic" ? "retold classic" : "original story",
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function matchesWall(entry: Entry, state: WallState, haystack: string): boolean {
  if (state.q.trim() && !haystack.includes(normalise(state.q.trim()))) return false;
  const time = TIME_FILTERS.find((filter) => filter.id === state.time);
  if (time && !inTimeFilter(time, entry.readingTime)) return false;
  if (state.genre && !entry.genres.some((genre) => genre === state.genre)) return false;
  if (state.theme && !entry.themes.includes(state.theme)) return false;
  return true;
}

/**
 * The wall's order. Newest first is the wall's default — the reader's override — while the
 * shelves themselves sort by rating per ADR-0005 (`byRatingThenRecency`). The two are
 * deliberately different surfaces: "what is new" and "what is best" are different questions.
 */
export function sortEntries(entries: Entry[], sort: SortId): Entry[] {
  const copy = [...entries];
  if (sort === "shortest") {
    return copy.sort((a, b) => a.readingTime - b.readingTime || a.title.localeCompare(b.title));
  }
  if (sort === "title") {
    return copy.sort((a, b) => a.title.localeCompare(b.title));
  }
  return copy.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.title.localeCompare(b.title));
}
