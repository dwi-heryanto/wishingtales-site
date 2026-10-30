import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { StoryWall } from "@/components/StoryWall";
import { genreShelvesAt, kidsLibrary } from "@/lib/browse";
import { ageLabel } from "@/lib/format";
import { collectionJsonLd } from "@/lib/jsonld";
import { TIME_SHELVES, entriesForTimeShelf } from "@/lib/reading-time";
import { DEFAULT_TIER } from "@/lib/tiers";
import { tierPath } from "@/lib/urls";

/**
 * The library in one page: every shelf, every genre, then every story.
 *
 * This is where the header's *All stories* goes, and it exists because the old menu could
 * not answer the question it looked like it answered — "Stories" was originals, the
 * classics were elsewhere, and the genres (the site's real classification, since a story's
 * address names one) were three levels down with no way in. A reader who wants "something
 * spooky" should not have to guess that spooky lives under an age.
 *
 * Reads through the children's accessors only (ADR-0002): this is a kids page, so the
 * adult shelf is not counted here, not mentioned here, and not linked from here.
 */
export const metadata: Metadata = {
  title: "All stories",
  description:
    "Every story in the library, newest first — browse by shelf, by genre or by theme, or start reading from the top.",
  alternates: { canonical: "/browse/" },
};

export default function BrowseIndex() {
  const { entries, stories, classics, series, themes } = kidsLibrary();
  const genres = genreShelvesAt(DEFAULT_TIER);
  const seriesTitles = new Map(series.map((hub) => [hub.slug, hub.title]));
  const timeShelves = TIME_SHELVES.map((shelf) => ({
    slug: shelf.slug,
    name: shelf.name,
    count: entriesForTimeShelf(shelf, entries).length,
  })).filter((shelf) => shelf.count > 0);

  const shelves = [
    {
      href: tierPath(DEFAULT_TIER),
      title: `Stories for ${DEFAULT_TIER}`,
      note: "The whole children's shelf",
      count: entries.length,
      unit: entries.length === 1 ? "story" : "stories",
    },
    {
      href: "/stories/",
      title: "Original stories",
      note: "Written for WishingTales",
      count: stories.length,
      unit: stories.length === 1 ? "story" : "stories",
    },
    {
      href: "/classics/",
      title: "Retold classics",
      note: "Old tales, in new words",
      count: classics.length,
      unit: classics.length === 1 ? "classic" : "classics",
    },
    {
      href: "/series/",
      title: "Series",
      note: "One story at a time",
      count: series.length,
      unit: series.length === 1 ? "series" : "series",
    },
    {
      href: "/themes/",
      title: "Themes",
      note: "Courage, night, home",
      count: themes.length,
      unit: themes.length === 1 ? "theme" : "themes",
    },
  ];

  return (
    <div className="page">
      <JsonLd
        data={collectionJsonLd({
          name: "All stories",
          description: "Every story in the WishingTales children's library.",
          path: "/browse/",
          entries,
        })}
      />

      <section className="section">
        <h1 className="lede">All stories</h1>
        <p className="lede__note">
          {entries.length === 1 ? "One story" : `${entries.length} stories`} — each one written
          for {ageLabel(DEFAULT_TIER).toLowerCase()} and complete in a single sitting. Pick a shelf, search
          for a title or a character, or read straight down.
        </p>
        {/* The tools sit under the shelves, which is a scroll away on a laptop. This is a
            plain in-page link — it works without JavaScript, and lands on the section
            rather than on a control that only exists after hydration (ADR-0009). */}
        <p className="lede__jump">
          <Link href="#every-story">Search or filter the library</Link>
        </p>
      </section>

      <section className="section section--tight" aria-labelledby="browse-shelves">
        <h2 className="section__title" id="browse-shelves">
          Start from a shelf
        </h2>
        <ul className="shelf-grid">
          {shelves.map((shelf) => (
            <li key={shelf.href}>
              <Link className="shelf-card" href={shelf.href}>
                <span className="shelf-card__count">
                  {shelf.count} <span className="shelf-card__unit">{shelf.unit}</span>
                </span>
                <span className="shelf-card__title">{shelf.title}</span>
                <span className="shelf-card__note">{shelf.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {genres.length > 0 ? (
        <section className="section section--tight" id="genres" aria-labelledby="browse-genres">
          <div className="section__head">
            <h2 className="section__title" id="browse-genres">
              By genre
            </h2>
            <span className="section__note">A story can sit on more than one shelf</span>
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

      {/*
        * Reading time is the second question after the age — "something that fits before
        * lights out" — so it is a way in from here, not a filter hidden on a story page
        * (issue #115).
        */}
      {timeShelves.length > 0 ? (
        <section className="section section--tight" id="reading-time" aria-labelledby="browse-time">
          <div className="section__head">
            <h2 className="section__title" id="browse-time">
              By reading time
            </h2>
            <span className="section__note">Every story is one sitting long</span>
          </div>
          <ul className="tags">
            {timeShelves.map((shelf) => (
              <li key={shelf.slug}>
                <Link className="tag" href={"/reading-time/" + shelf.slug + "/"}>
                  {shelf.name}
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

      <section
        className="section section--tight"
        id="every-story"
        aria-labelledby="browse-everything"
      >
        <div className="section__head">
          <h2 className="section__title" id="browse-everything">
            Every story
          </h2>
        </div>
        <StoryWall
          entries={entries}
          seriesTitles={seriesTitles}
          genres={genres.map((shelf) => ({
            genre: shelf.genre,
            label: shelf.label,
            count: shelf.count,
          }))}
          themes={themes.map((hub) => ({ slug: hub.slug, title: hub.title, count: hub.entries.length }))}
        />
      </section>
    </div>
  );
}
