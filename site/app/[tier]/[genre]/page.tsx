import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdultGate } from "@/components/AdultGate";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EntryList } from "@/components/EntryList";
import { JsonLd } from "@/components/JsonLd";
import { genreShelvesAt } from "@/lib/browse";
import { getEntriesAt } from "@/lib/content";
import { ageLabel, genreLabel } from "@/lib/format";
import { indexAllowed } from "@/lib/gate";
import { GENRE_COPY, shelfDescription, shelfFacts, shelfStats } from "@/lib/shelf-copy";
import { breadcrumbJsonLd, collectionJsonLd, type Crumb } from "@/lib/jsonld";
import { AGE_TIERS, GENRES, isAdult, type AgeTier, type Genre } from "@/lib/tiers";
import { genreFromSlug, genreSlug, tierFromSegment, tierGenrePath, tierPath } from "@/lib/urls";

export const dynamicParams = false;

type Params = { tier: string; genre: string };

function resolve(tier: string, genre: string): { tier: AgeTier; genre: Genre } | undefined {
  const parsedTier = tierFromSegment(tier);
  const parsedGenre = genreFromSlug(genre);
  return parsedTier && parsedGenre ? { tier: parsedTier, genre: parsedGenre } : undefined;
}

/**
 * The shelf the whole structure is for: "spooky stories for 8-12 year olds" is a page.
 *
 * Only shelves that hold something get built. A genre is in the closed vocabulary whether
 * or not a story has been written for it yet, so enumerating the vocabulary would ship
 * thirteen empty pages per tier and an empty shelf is worse than no shelf (ADR-0001) —
 * the same reason `4-8` has no shelf at all.
 */
export function generateStaticParams(): Params[] {
  const shelves = new Map<string, Params>();
  for (const tier of AGE_TIERS) {
    for (const genre of GENRES) {
      if (getEntriesAt(tier, genre).length > 0) {
        shelves.set(tierGenrePath(tier, genre), { tier, genre: genreSlug(genre) });
      }
    }
  }
  return [...shelves.values()];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { tier, genre } = await params;
  const parsed = resolve(tier, genre);
  if (!parsed) return {};

  const stats = shelfStats(getEntriesAt(parsed.tier, parsed.genre));
  const label = `${genreLabel(parsed.genre)} stories for ${ageLabel(parsed.tier).toLowerCase()}`;
  return {
    title: label,
    /*
     * The shelf's own sentences plus the facts only it has — how many stories and how long
     * they run — so no two shelves describe themselves the same way (issue #111).
     */
    description: shelfDescription(GENRE_COPY[parsed.genre], stats),
    alternates: { canonical: tierGenrePath(parsed.tier, parsed.genre) },
    // A genre shelf at an adult tier is behind the gate like everything else there.
    robots: indexAllowed(parsed.tier) ? undefined : "noindex, nofollow",
  };
}

export default async function GenreShelfRoute({ params }: { params: Promise<Params> }) {
  const { tier, genre } = await params;
  const parsed = resolve(tier, genre);
  if (!parsed) notFound();

  /* The tier decides whether this is a children's page; the genre only decides what is on
     it. A `spooky` shelf at 8-12 is a children's page and a `spooky` shelf at 18+ is not
     (ADR-0002). */
  const adult = isAdult(parsed.tier);
  const entries = getEntriesAt(parsed.tier, parsed.genre);
  /* The shelf's own measurements, which its intro and its meta description both quote. */
  const stats = shelfStats(entries);
  /*
   * The other shelves at the same age, so a reader who liked this one can move sideways
   * instead of going back to an index to find out what else exists.
   */
  const siblings = genreShelvesAt(parsed.tier).filter((shelf) => shelf.genre !== parsed.genre);
  const heading = `${genreLabel(parsed.genre)} stories for ${ageLabel(parsed.tier).toLowerCase()}`;

  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: ageLabel(parsed.tier), path: tierPath(parsed.tier) },
    { name: genreLabel(parsed.genre), path: tierGenrePath(parsed.tier, parsed.genre) },
  ];

  return (
    <div className="page" data-adult={adult ? "" : undefined}>
      {adult ? <AdultGate what="shelf" /> : null}
      <div className="adult-gated">
        <JsonLd
          data={[
            breadcrumbJsonLd(crumbs),
            collectionJsonLd({
              name: heading,
              description: `${parsed.genre} stories written for ${ageLabel(parsed.tier).toLowerCase()}.`,
              path: tierGenrePath(parsed.tier, parsed.genre),
              entries,
            }),
          ]}
        />

        <section className="section">
          <Breadcrumbs crumbs={crumbs} />
          <h1 className="lede" style={{ marginBlockStart: "var(--space-sm)" }}>
            {heading}
          </h1>
          <p className="lede__note">{GENRE_COPY[parsed.genre].body}</p>
          <p className="shelf-facts">
            {shelfFacts(stats)} Start with <Link href={entries[0]!.url}>{entries[0]!.title}</Link>
            {entries[1] ? (
              <>
                {" "}or <Link href={entries[1].url}>{entries[1].title}</Link>
              </>
            ) : null}
            .
          </p>
        </section>

        <section className="section section--tight" aria-labelledby="genre-stories">
          <h2 className="section__title" id="genre-stories">
            {entries.length === 1 ? "1 story" : `${entries.length} stories`}
          </h2>
          <EntryList
            entries={entries}
            emptyNote="The first story for this shelf is still being written."
          />
        </section>

        {siblings.length > 0 ? (
          <section className="section section--tight" aria-labelledby="genre-siblings">
            <h2 className="section__title" id="genre-siblings">
              Other genres at this age
            </h2>
            <ul className="tags">
              {siblings.map((shelf) => (
                <li key={shelf.genre}>
                  <Link className="tag" href={shelf.href}>
                    {shelf.label}
                    <span className="tag__count">{shelf.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
