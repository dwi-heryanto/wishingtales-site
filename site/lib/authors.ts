import type { Entry } from "./content";

/**
 * The authors a reader can browse, and the words on each page.
 *
 * The classics come from fifteen writers, and three of them hold most of the shelf: the
 * Brothers Grimm wrote down eleven of the retellings, Hans Christian Andersen four, and
 * Andrew Lang three. Those are the names a parent searches for — "grimm fairy tales" is a
 * query, "the story the site retold" is not — so each is a page (issue #115).
 *
 * A curated list rather than a group-by on `provenance.source`: the pages need a name that
 * reads well ("The Brothers Grimm", not "Jacob and Wilhelm Grimm"), a slug and written copy,
 * and three entries of real copy beat fifteen generated ones. Writers with a single story
 * wait here until they have more — a one-story collection page is a thin page.
 */
export type AuthorCollection = {
  slug: string;
  /** The collection's name, as the page and the search result read it. */
  name: string;
  /** The `provenance.source` author this collects, exactly as the frontmatter writes it. */
  source: string;
  /** One sentence, written to stand alone: it opens the meta description. */
  summary: string;
  /** The intro above the list. */
  body: string;
};

export const AUTHOR_COLLECTIONS: AuthorCollection[] = [
  {
    slug: "grimm-brothers",
    name: "The Brothers Grimm",
    source: "Jacob and Wilhelm Grimm",
    summary: "The Brothers Grimm collected the tales that became the fairy tales everybody knows.",
    body: "Jacob and Wilhelm Grimm gathered these stories from friends, neighbours and older books between 1812 and 1857, and the retellings here keep the shape that made them last: three attempts, a task that must be finished before morning, and a kindness that is repaid later. The frightening parts are trimmed for a bedtime reader; the endings are the ones the brothers wrote down.",
  },
  {
    slug: "hans-christian-andersen",
    name: "Hans Christian Andersen",
    source: "Hans Christian Andersen",
    summary: "Hans Christian Andersen invented his tales rather than collecting them.",
    body: "Where the Grimms gathered stories, Andersen made them up — a duckling who does not belong, a mermaid who pays for a pair of legs, an emperor who cannot see his own clothes. These retellings keep his endings, which are often quieter and sadder than a modern picture book would allow.",
  },
  {
    slug: "andrew-lang",
    name: "Andrew Lang",
    source: "Andrew Lang",
    summary: "Andrew Lang collected fairy tales from around the world into his coloured fairy books.",
    body: "Lang's twelve fairy books gathered stories from French, Arabian, Norse and Japanese sources and retold them for English readers. The three here — Aladdin, Ali Baba, and the journey east of the sun and west of the moon — are the ones that travelled furthest from where they started.",
  },
];

/** The collection an entry belongs to, or nothing when its author has no page yet. */
export function collectionFor(entry: Entry): AuthorCollection | undefined {
  const source = entry.provenance?.source;
  if (!source) return undefined;
  return AUTHOR_COLLECTIONS.find((collection) => source.startsWith(collection.source + ","));
}

/** The stories on a collection page: every entry the collection claims, newest first. */
export function entriesForCollection(collection: AuthorCollection, entries: Entry[]): Entry[] {
  return entries.filter((entry) => collectionFor(entry)?.slug === collection.slug);
}

/** "11 stories" / "1 story", for copy and counts. */
export function storiesLabel(count: number): string {
  return count === 1 ? "1 story" : count + " stories";
}
