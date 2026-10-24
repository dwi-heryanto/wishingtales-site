import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryPage } from "@/components/StoryPage";
import { getClassics, getEntries, getEntriesAt, getSeriesHub, getStories } from "@/lib/content";
import { secondName } from "@/lib/retold";
import type { Entry, SeriesHub } from "@/lib/content";
import { ageLabel, genreLabel } from "@/lib/format";
import { ogImagePath } from "@/lib/site";
import { indexAllowed } from "@/lib/gate";
import { timeSiblingFor } from "@/lib/reading-time";
import { isAdult } from "@/lib/tiers";
import { genreFromSlug, genreSlug, tierFromSegment, tierPath } from "@/lib/urls";

export const dynamicParams = false;

type Params = { tier: string; genre: string; slug: string };

/**
 * The entry at this address, or nothing.
 *
 * Resolved through the URL builder rather than by matching the segments against the
 * entry's own fields, so the page a reader lands on is the same page `entry.url` names —
 * one definition of where a story lives, checked in both directions. A slug that resolves
 * to a *different* tier or genre is a 404 here, not a second address for the same story:
 * two addresses for one story is the duplicate content this structure exists to avoid.
 */
function entryAt(tier: string, genre: string, slug: string): Entry | undefined {
  const parsedTier = tierFromSegment(tier);
  const parsedGenre = genreFromSlug(genre);
  let decodedSlug = slug;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    /* a malformed escape matches no story */
  }
  if (!parsedTier || !parsedGenre) return undefined;
  return [...getStories(), ...getClassics()].find(
    (entry) =>
      entry.slug === decodedSlug &&
      entry.ageTier === parsedTier &&
      genreSlug(entry.genres[0]) === genreSlug(parsedGenre),
  );
}

/**
 * What to offer at the end of a story.
 *
 * An episode offers the next episode of its own series. A standalone story — the default
 * shape, not a series waiting for a part two (ADR-0004) — offers the next story on the
 * shelf, because "belongs to no series" is not the same as "nothing to read next".
 *
 * A story whose series cannot be resolved falls through to the shelf offer as well: a
 * dangling reference never prints a part number, and never leaves the reader at a dead
 * end. `getSeries()` fails the build for that case, so this is the belt to its braces.
 *
 * Both offers stay on the reader's own side of the gate. For a children's page that is the
 * "never linked from kids pages" rule (ADR-0002) at the last place a link could appear;
 * for an adult entry it is the reverse — an adult who came here for horror is not sent to
 * a bedtime story, and a children's story is not linked from a page the site cannot vouch
 * for. `shelf` is the collection the entry belongs to, so a retold classic is offered the
 * next classic rather than the next original — and neither kind can reach across the gate.
 */
function nextAfter(entry: Entry, seriesHub: SeriesHub | undefined, shelf: Entry[]): Entry | undefined {
  const gated = isAdult(entry.ageTier);
  const sameSide = (candidate: Entry) => isAdult(candidate.ageTier) === gated;

  const order = entry.seriesOrder;
  if (seriesHub && order) {
    return seriesHub.episodes.find((episode) => episode.seriesOrder === order + 1 && sameSide(episode));
  }
  return shelf.filter(sameSide).find((candidate) => candidate.slug !== entry.slug);
}

/**
 * The stories either side of this one **on its own shelf**.
 *
 * `nextAfter` answers "what should I read next" — the next episode of a series, or the
 * newest story on the reader's side of the gate. This answers a narrower question: what is
 * adjacent to this story on the shelf a reader would browse, which is the page link graph
 * Google follows and the way a reader moves sideways instead of going back to an index
 * (issue #113). An episode walks its own series order; a standalone story walks the shelf
 * that its address names, so the neighbours are the rows above and below it on that page.
 */
function shelfNeighbours(
  entry: Entry,
  seriesHub: SeriesHub | undefined,
): { previous?: Entry; next?: Entry; also?: Entry } {
  const onShelf = getEntriesAt(entry.ageTier, entry.genres[0]);
  const index = onShelf.findIndex((candidate) => candidate.slug === entry.slug);

  /* A series episode walks its own parts first; everything else walks the shelf. */
  const part = (delta: number) =>
    seriesHub && entry.seriesOrder
      ? seriesHub.episodes.find((episode) => episode.seriesOrder === entry.seriesOrder! + delta)
      : undefined;

  /*
   * An episode's neighbours are its parts, and only its parts: the shelf row above the
   * first part is the second part, and using it as "previous" printed the same story under
   * two headings. A standalone story walks the shelf on both sides.
   */
  const isEpisode = Boolean(seriesHub && entry.seriesOrder);
  const previous = isEpisode ? part(-1) : index > 0 ? onShelf[index - 1] : undefined;
  const next = isEpisode ? part(1) : index >= 0 ? onShelf[index + 1] : undefined;

  /*
   * A story at one end — the newest row on its shelf, the first part of a series — has no
   * neighbour on that side, and a page with one link out is a dead end for a reader and for
   * a crawler. The nearest other row on the same shelf supplies the second link: a real
   * neighbour, not an invented one.
   */
  const taken = new Set([entry.slug, previous?.slug, next?.slug].filter(Boolean) as string[]);
  const also =
    previous && next
      ? undefined
      : [onShelf[index + 1], onShelf[index - 1], onShelf[index + 2], onShelf[index - 2]].find(
          (candidate) => candidate && !taken.has(candidate.slug),
        );

  return { previous, next, also };
}

/**
 * One route for every story and every retold classic.
 *
 * They share it because they are the same page to a reader — a title, a body, a byline —
 * and only the provenance block tells them apart. It was two routes once, and then one
 * route with a `collection` segment; the collection is not part of where a story lives
 * any more, so it is not part of the address either.
 */
export function generateStaticParams(): Params[] {
  return [...getStories(), ...getClassics()].map((entry) => {
    const [tier, genre, slug] = entry.url.replace(/^\/|\/$/g, "").split("/");
    return { tier, genre, slug };
  });
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { tier, genre, slug } = await params;
  const entry = entryAt(tier, genre, slug);
  if (!entry) return {};

  /*
   * A retold classic answers to two names: the one it has been told under for a century,
   * and the one it is told under here. Search engines only know the first — the source
   * tale is the query ("cinderella story") and the retold title deliberately is not — so
   * the source leads the title and the story's own title follows it. An original gets one
   * name alone, and so does a classic that keeps the tale's own title — one name twice in
   * a tag is a stutter, not two names (issue #110; the pair is asked through secondName).
   */
  const second = secondName(entry);
  const title = second ? second + " — " + entry.title : entry.title;
  const description = second ? "A retelling of " + second + ". " + entry.summary : entry.summary;

  return {
    title,
    description,
    alternates: { canonical: entry.url },
    /*
     * `noindex, nofollow` while the switch is off (ADR-0002). `nofollow` as well as
     * `noindex`, because the switch is about the whole area staying out of the crawl
     * rather than one page staying out of the index — a crawler that walks the adult
     * shelf is the thing the owner asked not to happen yet.
     */
    robots: indexAllowed(entry.ageTier) ? undefined : "noindex, nofollow",
    openGraph: {
      type: "article",
      title,
      description,
      url: entry.url,
      publishedTime: entry.publishedAt,
      /*
       * The 1200x630 card, not the portrait cover: every platform crops a 512x768 image,
       * and the card carries the title (and the source tale, for a classic) so a shared
       * link says what it is before anyone taps it (issue #112).
       */
      images: [{ url: ogImagePath(entry.slug), width: 1200, height: 630, alt: entry.coverAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: ogImagePath(entry.slug), alt: entry.coverAlt }],
    },
  };
}

export default async function StoryRoute({ params }: { params: Promise<Params> }) {
  const { tier, genre, slug } = await params;
  const entry = entryAt(tier, genre, slug);
  if (!entry) notFound();

  const isClassic = entry.kind === "classic";
  const seriesHub = entry.series ? getSeriesHub(entry.series) : undefined;
  const neighbours = shelfNeighbours(entry, seriesHub);
  /*
   * "Next" is the neighbour on the shelf; at the end of a shelf it falls back to the newest
   * story on the reader's side, which is what the page did before it had neighbours at all —
   * a reader at the last row is not left with no way on (issue #113).
   */
  const nextEntry = neighbours.next ?? nextAfter(entry, seriesHub, isClassic ? getClassics() : getStories());

  /*
   * A story of about the same length, on the reader's own side of the gate. The links
   * already on the page are excluded so the closing block cannot show the same title
   * twice; a gated story is never offered to a children's page (ADR-0002, ADR-0009).
   */
  const taken = new Set(
    [entry.slug, neighbours.previous?.slug, neighbours.next?.slug, neighbours.also?.slug, nextEntry?.slug].filter(
      (slug): slug is string => Boolean(slug),
    ),
  );
  const sideEntries = getEntries().filter((candidate) => isAdult(candidate.ageTier) === isAdult(entry.ageTier));
  const timeSibling = timeSiblingFor(entry, sideEntries, taken);

  /*
   * The trail a reader is on, and the one a crawler reads: home, the age shelf, the genre
   * shelf, the story. The tier and the genre are the two pages this structure exists for
   * ("spooky stories for 8-12 year olds" is a page), so they are the two the breadcrumb
   * names — a shape link like "Stories" would be a third tree beside the two a reader
   * actually browses (ADR-0001).
   */
  const crumbs = [
    { name: "Home", path: "/" },
    { name: ageLabel(entry.ageTier), path: tierPath(entry.ageTier) },
    { name: genreLabel(entry.genres[0]), path: `${tierPath(entry.ageTier)}${genreSlug(entry.genres[0])}/` },
    { name: entry.title, path: entry.url },
  ];

  return (
    <StoryPage
      entry={entry}
      crumbs={crumbs}
      section={isClassic ? "Classics" : (seriesHub?.title ?? "Stories")}
      seriesHub={seriesHub}
      previousEntry={neighbours.previous}
      alsoEntry={neighbours.also}
      nextEntry={nextEntry}
      timeSibling={timeSibling}
    />
  );
}
