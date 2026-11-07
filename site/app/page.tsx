import type { Metadata } from "next";
import Link from "next/link";
import { ContinueReading } from "@/components/ContinueReading";
import { JsonLd } from "@/components/JsonLd";
import { CoverImage } from "@/components/CoverImage";
import { StoryCard } from "@/components/StoryCard";
import { genreShelvesAt, kidsLibrary } from "@/lib/browse";
import { getKidsClassics, getKidsEntries, getKidsSeries, getKidsThemes } from "@/lib/content";
import { ageLabel, readingLabel } from "@/lib/format";
import { DEFAULT_TIER } from "@/lib/tiers";
import { websiteJsonLd } from "@/lib/jsonld";
import { SITE, ogImagePath } from "@/lib/site";

/*
 * One line, everywhere (ADR-0009). The brand line is general because the library will not
 * stay children's-only; the audience promise lives on the shelf ("Ages 8-12" beside the
 * featured story) rather than in the title. `absolute` because the layout's title template
 * would append the brand a second time otherwise (issue #111).
 *
 * The social card is the featured story's 1200x630 OG image: the homepage had none, so a
 * shared link showed no picture at all. `generateMetadata` rather than a constant because
 * the featured story is the first children's entry and changes with every publish.
 */
const HOME_TITLE = SITE.tagline + " · " + SITE.name;

export function generateMetadata(): Metadata {
  const featured = getKidsEntries()[0];
  return {
    title: { absolute: HOME_TITLE },
    description: SITE.description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      title: HOME_TITLE,
      description: SITE.description,
      url: "/",
      images: featured
        ? [{ url: ogImagePath(featured.slug), width: 1200, height: 630, alt: featured.coverAlt }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: HOME_TITLE,
      description: SITE.description,
      images: featured ? [{ url: ogImagePath(featured.slug), alt: featured.coverAlt }] : undefined,
    },
  };
}

export default function HomePage() {
  const entries = getKidsEntries();
  const featured = entries[0];
  const latest = entries.slice(1, 5);
  const stories = kidsLibrary().stories;
  const classics = getKidsClassics();
  /* The genres with something on them, fullest first — the site's own classification. */
  const genres = genreShelvesAt(DEFAULT_TIER);
  // Keep the classics shelf from repeating what the latest row already shows.
  const latestSlugs = new Set(latest.map((entry) => entry.slug));
  const shelfClassics = classics.filter((entry) => !latestSlugs.has(entry.slug)).slice(0, 4);
  const series = getKidsSeries();
  const themes = getKidsThemes();
  /*
   * Undefined for a standalone story, which is the ordinary case rather than a gap: the
   * featured line then says "Latest story" and nothing pretends otherwise (ADR-0004).
   */
  const featuredHub = series.find((hub) => hub.slug === featured?.series);

  return (
    <div className="page">
      <JsonLd data={websiteJsonLd()} />

      {featured ? (
        <section className="featured" aria-labelledby="featured-title">
          <div className="featured__cover">
            {/* The home page's largest paint: eager, high priority, at most 15rem wide. */}
            <CoverImage entry={featured} sizes="(min-width: 48rem) 15rem, 60vw" priority />
          </div>
          <div>
            <p className="eyebrow">
              {[
                featured.kind === "classic" ? "Latest classic" : (featuredHub?.title ?? "Latest story"),
                ageLabel(featured.ageTier),
              ].join(" · ")}
            </p>
            <h1 className="featured__title" id="featured-title">
              A story for tonight, in about ten minutes.
            </h1>
            <p className="featured__summary">{featured.summary}</p>
            <p className="featured__meta" style={{ marginBlockStart: "var(--space-xs)" }}>
              <Link href={featured.url}>{featured.title}</Link> · {readingLabel(featured.readingTime)} ·{" "}
              {featured.byline}
            </p>
            <div className="actions">
              <Link className="btn btn--primary" href={featured.url}>
                Read “{featured.title}” ({featured.readingTime} min)
              </Link>
              <Link className="btn btn--quiet" href="/browse/">
                Browse all stories
              </Link>
            </div>
            {/* The quick picker answers the bedtime question without a genre guess
                (ADR-0009). Each link is the wall with the matching filter already on. */}
            <nav className="picker" aria-label="Find a story quickly">
              <Link href="/browse/?time=short">Under 10 minutes</Link>
              <Link href="/browse/?theme=home">Cozy</Link>
              <Link href="/browse/?genre=funny">Funny</Link>
              <Link href="/browse/?genre=spooky">A little spooky</Link>
              <Link href="/themes/night/">Night stories</Link>
            </nav>
          </div>
        </section>
      ) : (
        <section className="section" aria-labelledby="empty-title">
          <h1 className="lede" id="empty-title">
            Stories to read aloud, or read alone
          </h1>
          <p className="lede__note">
            Stories you can read in one sitting, written to be read aloud. The first ones are being
            written now — each is checked by a model, and no person reads it, before it goes up.
          </p>
          <div className="actions">
            <Link className="btn" href="/about/">
              How we make stories
            </Link>
            <Link className="btn btn--quiet" href="/sources/">
              Where the classics come from
            </Link>
          </div>
        </section>
      )}

      <ContinueReading
        entries={entries.slice(0, 12).map((entry) => ({
          slug: entry.slug,
          title: entry.title,
          url: entry.url,
          cover: entry.cover,
          coverAlt: entry.coverAlt,
        }))}
      />

      {latest.length > 0 ? (
        <section className="section" aria-labelledby="latest-heading">
          <div className="section__head">
            <h2 className="section__title" id="latest-heading">
              Latest stories
            </h2>
            <Link className="section__link" href="/browse/">
              All stories
            </Link>
          </div>
          <div className="grid">
            {latest.map((entry) => (
              <StoryCard
                key={entry.slug}
                entry={entry}
                seriesTitle={series.find((hub) => hub.slug === entry.series)?.title}
              />
            ))}
          </div>
        </section>
      ) : null}

      {genres.length > 0 ? (
        <section className="section section--tight" aria-labelledby="genres-heading">
          <div className="section__head">
            <h2 className="section__title" id="genres-heading">
              By genre
            </h2>
            <Link className="section__link" href="/browse/#genres">
              All genres
            </Link>
          </div>
          <ul className="tags">
            {genres.map((shelf) => (
              <li key={shelf.genre}>
                <Link className="tag" href={shelf.href}>
                  {shelf.label}
                  <span className="tag__count">
                    {shelf.count}
                    <span className="visually-hidden"> {shelf.count === 1 ? "story" : "stories"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {series.length > 0 ? (
        <section className="section section--tight" aria-labelledby="series-heading">
          <div className="section__head">
            <h2 className="section__title" id="series-heading">
              Series
            </h2>
            <Link className="section__link" href="/series/">
              All series
            </Link>
          </div>
          <ul className="entry-list">
            {series.slice(0, 4).map((hub) => (
              <li className="entry-list__item" key={hub.slug}>
                <Link className="entry-list__link" href={hub.url}>
                  <span className="entry-list__meta">
                    {hub.episodes.length === 1 ? "1 part" : hub.episodes.length + " parts"}
                  </span>
                  <span className="entry-list__title">{hub.title}</span>
                  <span className="entry-list__summary">{hub.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {shelfClassics.length > 0 && stories.length > 0 ? (
        <section className="section section--tight" aria-labelledby="classics-heading">
          <div className="section__head">
            <h2 className="section__title" id="classics-heading">
              Classics, retold
            </h2>
            <Link className="section__link" href="/classics/">
              All classics
            </Link>
          </div>
          <div className="grid">
            {shelfClassics.map((entry) => (
              <StoryCard key={entry.slug} entry={entry} />
            ))}
          </div>
        </section>
      ) : null}

      {themes.length > 0 ? (
        <section className="section section--tight" aria-labelledby="themes-heading">
          <div className="section__head">
            <h2 className="section__title" id="themes-heading">
              By theme
            </h2>
            <Link className="section__link" href="/themes/">
              All themes
            </Link>
          </div>
          <ul className="tags">
            {themes.map((hub) => (
              <li key={hub.slug}>
                <Link className="tag" href={hub.url}>
                  {hub.title}
                  <span className="tag__count">
                    {hub.entries.length}
                    <span className="visually-hidden">
                      {" "}
                      {hub.entries.length === 1 ? "story" : "stories"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
