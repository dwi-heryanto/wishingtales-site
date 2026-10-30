import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdultGate } from "@/components/AdultGate";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { EntryList } from "@/components/EntryList";
import { JsonLd } from "@/components/JsonLd";
import { genreShelvesAt } from "@/lib/browse";
import {
  getAdultSeries,
  getEntriesAtTier,
  getKidsSeries,
  type SeriesHub,
} from "@/lib/content";
import { ageLabel } from "@/lib/format";
import { indexAllowed } from "@/lib/gate";
import { TIER_COPY, shelfDescription, shelfFacts, shelfStats } from "@/lib/shelf-copy";
import { breadcrumbJsonLd, collectionJsonLd, type Crumb } from "@/lib/jsonld";
import { AGE_TIERS, isAdult, type AgeTier } from "@/lib/tiers";
import { tierFromSegment, tierPath } from "@/lib/urls";

export const dynamicParams = false;

/**
 * Only tiers that hold something get a shelf.
 *
 * "An empty shelf is worse than no shelf" is ADR-0001's reason for withholding `4-8`
 * entirely, and it applies to a tier that has merely run dry too: a page promising
 * `13+` stories and listing none is a worse promise than no page. A tier's shelf appears
 * the day its first story does.
 */
function tiersWithContent(): AgeTier[] {
  const filled = new Set<AgeTier>();
  for (const tier of AGE_TIERS) if (getEntriesAtTier(tier).length > 0) filled.add(tier);
  for (const hub of [...getKidsSeries(), ...getAdultSeries()]) filled.add(hub.ageTier);
  return AGE_TIERS.filter((tier) => filled.has(tier));
}

export function generateStaticParams() {
  return tiersWithContent().map((tier) => ({ tier }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tier: string }>;
}): Promise<Metadata> {
  const { tier } = await params;
  const parsed = tierFromSegment(tier);
  if (!parsed) return {};

  const stats = shelfStats(getEntriesAtTier(parsed));
  const copy = TIER_COPY[parsed];
  return {
    title: `Stories for ${ageLabel(parsed).toLowerCase()}`,
    description: copy
      ? shelfDescription(copy, stats)
      : `${stats.count === 1 ? "One story" : `${stats.count} stories`} written for ${ageLabel(parsed).toLowerCase()} — read aloud or read alone.`,
    alternates: { canonical: tierPath(parsed) },
    // The adult shelves are out of the index until the owner flips the switch (ADR-0002).
    robots: indexAllowed(parsed) ? undefined : "noindex, nofollow",
  };
}

export default async function TierShelfRoute({ params }: { params: Promise<{ tier: string }> }) {
  const { tier } = await params;
  const parsed = tierFromSegment(tier);
  if (!parsed) notFound();

  /* Read from the tier the shelf is *about*, which is what makes this a children's page
     or an adult one — the same question a story answers about itself (ADR-0002). */
  const adult = isAdult(parsed);
  const entries = getEntriesAtTier(parsed);
  /* The shelf's own measurements, which its intro and its meta description both quote. */
  const stats = shelfStats(entries);
  const series: SeriesHub[] = adult
    ? getAdultSeries().filter((hub) => hub.ageTier === parsed)
    : getKidsSeries().filter((hub) => hub.ageTier === parsed);
  /*
   * Only genres with something on them, fullest first: thirteen empty shelves is not a
   * browse surface (ADR-0001). The same helper the header and `/browse/` read, so the
   * count beside a genre cannot disagree with the number of cards behind it.
   */
  const genres = genreShelvesAt(parsed);

  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: ageLabel(parsed), path: tierPath(parsed) },
  ];

  return (
    <div className="page" data-adult={adult ? "" : undefined}>
      {adult ? <AdultGate what="shelf" /> : null}
      <div className="adult-gated">
        <JsonLd
          data={[
            breadcrumbJsonLd(crumbs),
            collectionJsonLd({
              name: `Stories for ${ageLabel(parsed).toLowerCase()}`,
              description: `Stories written for ${ageLabel(parsed).toLowerCase()}.`,
              path: tierPath(parsed),
              entries,
            }),
          ]}
        />

        <section className="section">
          <Breadcrumbs crumbs={crumbs} />
          <h1 className="lede" style={{ marginBlockStart: "var(--space-sm)" }}>
            Stories for {ageLabel(parsed).toLowerCase()}
          </h1>
          <p className="lede__note">
            {TIER_COPY[parsed]?.body ??
              "Every story here is written for this age band — the tier is the story's own, not a guess about who is reading."}
          </p>
          <p className="shelf-facts">
            {shelfFacts(stats)} Pick a genre below, or{" "}
            <Link href="/browse/">browse the whole library</Link>.
          </p>
        </section>

        {genres.length > 0 ? (
          <section className="section section--tight" aria-labelledby="tier-genres">
            <div className="section__head">
              <h2 className="section__title" id="tier-genres">
                By genre
              </h2>
              <span className="section__note">Pick a shelf, or read straight down</span>
            </div>
            <ul className="tags">
              {genres.map((shelf) => (
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

        <section className="section section--tight" aria-labelledby="tier-stories">
          <div className="section__head">
            <h2 className="section__title" id="tier-stories">
              {entries.length === 1 ? "1 story" : `${entries.length} stories`}
            </h2>
          </div>
          <EntryList
            entries={entries}
            emptyNote="The first story for this shelf is still being written."
          />
        </section>

        {series.length > 0 ? (
          <section className="section section--tight" aria-labelledby="tier-series">
            <h2 className="section__title" id="tier-series">
              Series
            </h2>
            <ul className="entry-list">
              {series.map((hub) => (
                <li className="entry-list__item" key={hub.slug}>
                  <Link className="entry-list__link" href={hub.url}>
                    <span className="entry-list__meta">
                      {hub.episodes.length === 1 ? "1 part" : `${hub.episodes.length} parts`}
                    </span>
                    <span className="entry-list__title">{hub.title}</span>
                    <span className="entry-list__summary">{hub.summary}</span>
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
